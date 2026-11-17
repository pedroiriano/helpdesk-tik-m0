import { heroes } from '../../hero-defaults.mjs';
import { api, durableIntent, errorText } from './transport';
import type { Components } from './business-types.generated';

const org = '10000000-0000-4000-8000-000000000001';
const base = '/assets/helpdesk/02_Hero_Tanpa_Teks/';
type Banner = Components['HeroBanner'];
type Candidate = Components['HeroCandidate'];
type CandidatePage = {items:Candidate[];next_cursor:string|null};

export async function showHeroEditor(section: HTMLElement, session: Components['Session']) {
  const grants = session.actor.memberships.filter(m=>m.organization_active && m.organization_id===org).flatMap(m=>m.permissions);
  const canWrite = grants.includes('hero.write');
  const canPublish = grants.includes('hero.publish');
  const form = section.querySelector<HTMLFormElement>('form')!;
  const list = form.querySelector<HTMLElement>('[data-hero-slots]')!;
  const reason = form.querySelector<HTMLTextAreaElement>('textarea')!;
  const feedback = form.querySelector<HTMLElement>('[role="status"]')!;
  const save = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
  const publish = form.querySelector<HTMLButtonElement>('[data-hero-publish]')!;
  const more = section.querySelector<HTMLButtonElement>('[data-hero-more]')!;
  const refresh = section.querySelector<HTMLButtonElement>('[data-hero-refresh]')!;
  const defaultBanners = heroes.map(([asset,title,alt])=>({asset,title,alt}));
  const saveIntent = durableIntent<Components['HeroDraftWrite']>();
  const publishIntent = durableIntent<Components['HeroPublishWrite']>();
  let banners: Banner[] = [];
  let candidates: Candidate[] = [];
  let cursor: string | null = null;
  let state: Components['HeroState'] | undefined;
  let busy = false;
  let dirty = false;

  const controls = () => {
    save.hidden = !canWrite;
    save.disabled = !state || busy || !dirty;
    publish.hidden = !canPublish;
    publish.disabled = !state?.draft.length || busy || dirty || state.version === state.published_version;
    more.hidden = !cursor;
    more.disabled = busy;
    refresh.disabled = busy;
  };
  const change = () => { dirty=true; controls(); };

  function render() {
    list.replaceChildren();
    banners.forEach((banner,index)=>{
      const card=document.createElement('fieldset');
      card.className='hd-hero-editor-slot piui-card';
      const legend=document.createElement('legend');
      legend.textContent='Banner '+(index+1);
      card.append(legend);
      const image=document.createElement('img');
      image.alt='';
      image.loading='lazy';
      image.src=banner.asset ? base+banner.asset : '/api/v1/media/'+banner.media_id+'/content';
      card.append(image);
      function field(label: string, node: HTMLInputElement | HTMLSelectElement) {
        const wrapper=document.createElement('label');
        wrapper.className='piui-field';
        node.className='piui-input';
        node.disabled=!canWrite || busy;
        wrapper.append(document.createTextNode(label),node);
        card.append(wrapper);
      }
      const media=document.createElement('select');
      for (const [asset,title] of heroes) media.add(new Option('Aset bawaan · '+title,'asset:'+asset));
      for (const candidate of candidates) media.add(new Option(candidate.alt,'media:'+candidate.id));
      const current=banner.asset ? 'asset:'+banner.asset : 'media:'+banner.media_id;
      if (![...media.options].some(o=>o.value===current)) media.add(new Option('Gambar tersimpan',current));
      media.value=current;
      media.addEventListener('change',()=>{
        const [type,id]=media.value.split(':');
        if (type==='asset') {banner.asset=id;delete banner.media_id;image.src=base+id;}
        else {banner.media_id=id;delete banner.asset;image.src='/api/v1/media/'+id+'/content';}
        change();
      });
      field('Gambar',media);
      for (const [key,label,max] of [['title','Judul',100],['alt','Teks alternatif',200]] as const) {
        const input=document.createElement('input');
        input.required=true; input.maxLength=max; input.value=banner[key];
        input.addEventListener('input',()=>{banner[key]=input.value;change();});
        field(label,input);
      }
      const actions=document.createElement('div');
      actions.className='hd-actions';
      for (const [offset,label] of [[-1,'Naikkan'],[1,'Turunkan']] as const) {
        const button=document.createElement('button');
        button.type='button';
        button.className='piui-btn piui-btn--secondary';
        button.textContent=label;
        button.setAttribute('aria-label',label+' banner '+(index+1));
        button.disabled=!canWrite || busy || index+offset<0 || index+offset>=banners.length;
        button.addEventListener('click',()=>{
          [banners[index],banners[index+offset]]=[banners[index+offset],banners[index]];
          change();
          render();
          list.querySelectorAll('fieldset')[index+offset]?.querySelector('select')?.focus();
        });
        actions.append(button);
      }
      card.append(actions);
      list.append(card);
    });
    controls();
  }

  async function candidatePage(next = '') {
    const page=await api<CandidatePage>('/admin/hero/media?limit=20'+(next?'&cursor='+encodeURIComponent(next):''));
    candidates=next ? [...candidates,...page.items] : page.items;
    cursor=page.next_cursor;
  }
  async function load() {
    if (busy) return;
    busy=true;
    controls();
    feedback.textContent='Memuat draf dan gambar…';
    try {
      state=await api<Components['HeroState']>('/admin/hero');
      await candidatePage();
      banners=structuredClone(state.draft.length===5?state.draft:defaultBanners);
      dirty=state.draft.length===0;
      feedback.textContent=state.published_version ? `Terbit versi ${state.published_version}. Draf versi ${state.version}.`
        : 'Beranda menggunakan lima banner bawaan. Simpan draf untuk mulai mengelola.';
    } catch (error) { feedback.textContent=errorText(error); }
    finally {busy=false;render();}
  }
  async function commit(publishing: boolean) {
    if (!state || busy || (publishing ? publish.disabled : save.disabled) || !form.reportValidity()) return;
    const version=state.version;
    const explanation=reason.value.trim();
    busy=true;
    render();
    try {
      const result = publishing
        ? await publishIntent('/admin/hero/publish',{expected_version:version,reason:explanation},
            (key,body)=>api<Components['Receipt']>('/admin/hero/publish','POST',body,key))
        : await saveIntent('/admin/hero',{expected_version:version,reason:explanation,banners},
            (key,body)=>api<Components['Receipt']>('/admin/hero','PUT',body,key));
      state.version=result.version;
      if (publishing) state.published_version=result.version;
      else state.draft=structuredClone(banners);
      dirty=false;
      reason.value='';
      feedback.textContent=publishing ? `Banner terbit. Versi ${result.version}.` : `Draf tersimpan. Versi ${result.version}.`;
    } catch (error) { feedback.textContent=errorText(error); }
    finally {busy=false;render();}
  }
  form.addEventListener('submit',event=>{event.preventDefault();void commit(false);});
  publish.addEventListener('click',()=>void commit(true));
  more.addEventListener('click',async()=>{
    if (!cursor || busy) return;
    busy=true;
    controls();
    try {await candidatePage(cursor);}
    catch (error) {feedback.textContent=errorText(error);}
    finally {busy=false;render();}
  });
  refresh.addEventListener('click',()=>{
    if (dirty && state?.draft.length && !window.confirm('Muat ulang draf dari server dan buang perubahan yang belum disimpan?')) {
      return;
    }
    void load();
  });
  await load();
}
