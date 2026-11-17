import { appHref, routeContext } from '../core/environment.js';
import { USERS, AUDITS } from "../core/detail-fixtures.js";
import { readUrlState, onUrlStateChange } from "../core/url-state.js";
import { initTabsAndDetailViews } from './tabs.js';
import { initForms } from './forms.js';
const instances=new WeakSet();

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function card(label, value) {
  const el = node("article", "piui-card");
  el.append(node("h2", "piui-card__title", label), node("p", "piui-page-subtitle overflow-anywhere", value));
  return el;
}
export function resolveDetail(kind, id) { return (kind === "users" ? USERS : AUDITS).find((r) => r.id === id) || null; }
export function initEntityDetail() {
  const host = document.querySelector("[data-entity-detail]");
  if (!host || instances.has(host)) return;instances.add(host);
  const kind = host.getAttribute("data-entity-detail");
  let renderedId;
  const render = () => {
    const {id} = readUrlState();
    if (renderedId === id) return;
    renderedId = id;
    const record = resolveDetail(kind, id);
    const title = record ? (kind === "users" ? `${record.name} (${record.id})` : record.id) : "Data tidak ditemukan";
    host.querySelector("[data-detail-title]").textContent = `Detail ${title}`;
    host.querySelector("[data-detail-breadcrumb]").textContent = title;
    document.title = `Detail ${kind==='users'?'Pengguna':'Riwayat Aktivitas'} — PIUI Zero™`;
    host.querySelector("[data-detail-summary]").textContent = record ? "Data contoh lokal • identitas mengikuti ID yang dipilih." : "ID kosong atau tidak dikenal. Tidak ada entitas yang dipilih.";
    host.querySelector("[data-detail-error]").hidden = !!record;
    const cards = host.querySelector("[data-detail-cards]"), body = host.querySelector("[data-detail-body]");
    cards.replaceChildren(); body.replaceChildren(); cards.hidden = body.hidden = !record;
    const action = host.querySelector("[data-detail-action]");
    if (action) action.disabled = !record;
    if (!record) return;
    const pairs = kind === "users" ? [["ID akun", record.id], ["Peran", record.role], ["Status", record.status], ["Aktivitas terakhir", record.lastActivity]] : [["ID audit",record.id],["Aktor",record.actor],["Alamat IP",record.ip],["Tingkat risiko",record.severity]];
    cards.append(...pairs.map(([label,value]) => card(label,value)));
    if (kind === "users") {
      const heading = document.getElementById("suspend-single-title");
      if (heading) heading.textContent = `Konfirmasi penangguhan ${record.name} (${record.id})`;
      const known=document.getElementById("tpl-known-user-9041");
      if(record.id==="USR-9041"&&known instanceof HTMLTemplateElement){body.append(known.content.cloneNode(true));initTabsAndDetailViews();initForms(body);return;}
      const list = node("div", "piui-tablist"); list.setAttribute("role","tablist"); list.setAttribute("aria-label","Informasi pengguna");
      for (const [index, [key,label,text]] of [["profil","Profil",`${record.email} • ${record.pii}`],["rbac","Peran & izin",`Peran contoh: ${record.role}. Rincian izin untuk entitas ini belum tersedia; tidak menyatakan otorisasi server.`],["sesi","Aktivitas",`Aktivitas terakhir: ${record.lastActivity}. Rincian sesi aktif belum tersedia dalam fixture.`]].entries()) {
        const tab = node("button","piui-tab",label); tab.type="button";tab.id=`tab-${key}`;tab.setAttribute("role","tab");tab.setAttribute("data-tab-key",key);tab.setAttribute("aria-selected",String(index===0));tab.setAttribute("aria-controls",`panel-${key}`);tab.tabIndex=index===0?0:-1;
        const panel=node("div","piui-panel__body");panel.id=`panel-${key}`;panel.setAttribute("role","tabpanel");panel.setAttribute("aria-labelledby",tab.id);panel.hidden=index!==0;panel.append(node("h2","piui-panel__title",label),node("p","piui-page-subtitle overflow-anywhere",text));
        list.append(tab);body.append(panel);
      }
      body.prepend(list);
    } else {
      body.append(node("h2","piui-panel__title",record.action),node("p","piui-page-subtitle",`${record.time} WIB • ${record.hash}`));
      if (record.actorId) {
        const link=node("a","piui-btn piui-btn--secondary","Lihat profil aktor");link.href=appHref(`/app/users/detail.html?id=${record.actorId}&returnTo=${encodeURIComponent(routeContext())}`);body.append(link);
      }
      if (record.before && record.after) {
        const grid=node("div","piui-diff-grid");
        for(const [label,value] of [["Sebelum",record.before],["Sesudah",record.after]]) {
          const section=node("article","piui-card");section.append(node("h3","piui-card__title",label),node("pre","piui-code-block",value));grid.append(section);
        }
        body.append(grid);
      } else body.append(node("p","piui-page-subtitle","Payload sebelum/sesudah tidak tersedia untuk ID ini dalam fixture. Tidak menampilkan diff milik entitas lain."));
    }
    initTabsAndDetailViews();initForms(body);
  };
  render(); onUrlStateChange(render);
}
