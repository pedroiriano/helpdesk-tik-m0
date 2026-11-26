import { openAdminConfirmDialog } from './admin-confirm';
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
  let initialDraft = false;
  let slot = 0;
  let view = 'draft';
  let size = 'desktop';
  const live = section.querySelector<HTMLElement>('[data-hero-live]')!;
  const frame = section.querySelector<HTMLElement>('[data-hero-preview-frame]')!;
  const frameImage = frame.querySelector<HTMLImageElement>('img')!;
  const caption = frame.querySelector<HTMLElement>('[data-hero-preview-caption]')!;
  const slots = section.querySelector<HTMLElement>('[data-hero-preview-slots]')!;
  const scan = section.querySelector<HTMLElement>('[data-hero-preview-scan]')!;
  const draftReady = () => state?.draft.length === 5;
  const imageURL = (banner: Banner, published = false) => banner.asset
    ? base+encodeURIComponent(banner.asset)
    : published ? '/api/v1/portal/hero/media/'+encodeURIComponent(banner.media_id!)+'?v='+state?.published_version
      : '/api/v1/media/'+encodeURIComponent(banner.media_id!)+'/content';
  const scanText = (banner: Banner, published = false) => banner.asset ? 'Aset bawaan Helpdesk'
    : published ? 'Gambar publikasi; status diperiksa saat gambar dimuat.'
    : candidates.some(candidate => candidate.id === banner.media_id) ? 'Lolos pemindaian · CLEAN'
    : 'Status pemindaian belum muncul di daftar kandidat yang dimuat.';
  for (let index = 0; index < 5; index++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'piui-btn piui-btn--secondary';
    button.textContent = String(index+1);
    button.setAttribute('aria-label','Pratinjau banner '+(index+1));
    button.addEventListener('click', () => { slot=index; preview(); });
    slots.append(button);
  }
  function preview() {
    const published = view === 'published';
    const hasPublication = state?.published.length === 5;
    const banner = (published ? hasPublication ? state!.published : defaultBanners : banners)[slot];
    live.textContent = !state ? 'Versi tayang belum dapat diperiksa.'
      : hasPublication ? 'Sedang tayang: versi '+state.published_version+'.'
      : 'Sedang tayang: lima banner bawaan.';
    frame.dataset.size = size;
    for (const button of section.querySelectorAll<HTMLButtonElement>('[data-hero-view]')) {
      button.setAttribute('aria-pressed',String(button.dataset.heroView === view));
    }
    for (const button of section.querySelectorAll<HTMLButtonElement>('[data-hero-size]')) {
      button.setAttribute('aria-pressed',String(button.dataset.heroSize === size));
    }
    [...slots.children].forEach((button,index) => button.setAttribute('aria-pressed',String(index===slot)));
    if (!banner) {
      frameImage.hidden = true;
      frameImage.removeAttribute('src');
      caption.textContent = 'Pratinjau belum tersedia.';
      scan.textContent = '';
      return;
    }
    frameImage.hidden = false;
    frameImage.alt = banner.alt;
    const src = imageURL(banner, published);
    if (frameImage.getAttribute('src') !== src) frameImage.src = src;
    caption.textContent = 'Banner '+(slot+1)+' · '+banner.title;
    scan.textContent = scanText(banner, published);
  }
  frameImage.addEventListener('error', () => {
    frameImage.hidden = true;
    scan.textContent = 'Gambar pratinjau tidak dapat dimuat. Periksa akses dan status pemindaian di Pustaka Media.';
  });
  for (const button of section.querySelectorAll<HTMLButtonElement>('[data-hero-view]')) {
    button.addEventListener('click',() => { view=button.dataset.heroView!; preview(); });
  }
  for (const button of section.querySelectorAll<HTMLButtonElement>('[data-hero-size]')) {
    button.addEventListener('click',() => { size=button.dataset.heroSize!; preview(); });
  }

  const controls = () => {
    save.hidden = !canWrite;
    save.disabled = !state || busy || !canWrite || !(dirty || initialDraft);
    publish.hidden = !canPublish;
    publish.disabled = !canPublish || !draftReady() || busy || dirty || state?.version === state?.published_version;
    more.hidden = !cursor;
    more.disabled = busy;
    refresh.disabled = busy;
  };
  const change = () => { dirty=true; view='draft'; controls(); preview(); };

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
      image.src=imageURL(banner);
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
      for (const candidate of candidates) media.add(new Option(candidate.alt + ' · CLEAN','media:'+candidate.id));
      const current=banner.asset ? 'asset:'+banner.asset : 'media:'+banner.media_id;
      if (![...media.options].some(o=>o.value===current)) media.add(new Option('Gambar tersimpan',current));
      media.value=current;
      const imageStatus = document.createElement('small');
      imageStatus.textContent = scanText(banner);
      media.addEventListener('change',()=>{
        const [type,id]=media.value.split(':');
        if (type==='asset') {banner.asset=id;delete banner.media_id;image.src=base+id;}
        else {banner.media_id=id;delete banner.asset;image.src='/api/v1/media/'+id+'/content';}
        imageStatus.textContent = scanText(banner);
        slot=index;
        change();
      });
      field('Gambar',media);
      card.append(imageStatus);
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
    preview();
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
      banners=structuredClone(draftReady()?state.draft:defaultBanners);
      dirty=false;
      initialDraft=!draftReady();
      await candidatePage();
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
      if (publishing) {
        state.published_version=result.version;
        state.published=structuredClone(state.draft);
        view='published';
      } else {
        state.draft=structuredClone(banners);
        initialDraft=false;
      }
      dirty=false;
      reason.value='';
      feedback.textContent=publishing ? `Banner terbit. Versi ${result.version}.` : `Draf tersimpan. Versi ${result.version}.`;
    } catch (error) {
      if (publishing) throw new Error(errorText(error));
      feedback.textContent=errorText(error);
    }
    finally {busy=false;render();}
  }
  form.addEventListener('submit',event=>{event.preventDefault();void commit(false);});
  publish.addEventListener('click',() => {
    if (!state || publish.disabled || !form.reportValidity()) return;
    openAdminConfirmDialog({
      title:'Terbitkan lima banner beranda?',
      description:'Draf versi '+state.version+' akan menggantikan '+(state.published_version ? 'versi '+state.published_version : 'lima banner bawaan')+'.',
      details:state.draft.map((banner,index) => 'Banner '+(index+1)+' · '+banner.title),
      confirmLabel:'Terbitkan Banner',
      onConfirm:() => commit(true),
    });
  });
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
