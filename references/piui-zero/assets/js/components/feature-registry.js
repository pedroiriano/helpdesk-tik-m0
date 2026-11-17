import { el,button,actionGroup,contentStack } from '../core/dom.js';
import { loadStyle } from '../core/assets.js';
/** Explicit host/export contract: the gate checks consumers and regression fixtures. */
export const FEATURES = [
 {id:'entity-detail',phase:'entity',selector:'[data-entity-detail]',load:()=>import('./entity-detail.js'),init:'initEntityDetail'},
 {id:'tabs',selector:'[role="tablist"], nav.piui-breadcrumb, [data-auto-open]',load:()=>import('./tabs.js'),init:'initTabsAndDetailViews'},
 {id:'notifications',selector:'#notif-page-tbody',load:()=>import('./notifications-page.js'),init:'initNotificationsPageController'},
 {id:'dashboard',selector:'#piui-dashboard-workspace',load:()=>import('./dashboard-controller.js'),init:'initDashboardController'},
 {id:'tables',selector:'.piui-table',load:()=>import('./data-table.js'),init:'initDataTables'},
 {id:'dates',selector:'.piui-filter-bar',load:()=>import('./date-range.js'),init:'initDateRangePickers'},
 {id:'editor',selector:'[data-piui-md-editor]',style:'/assets/css/markdown-editor.css',load:()=>import('./markdown-editor.js'),init:'initMarkdownEditors'},
 {id:'collection-layout',selector:'[data-collection]',load:()=>import('./collection-layout.js'),init:'initCollectionLayouts'},
 {id:'gallery',selector:'#piui-masonry-grid',load:()=>import('./gallery.js'),init:'initMediaGallery'},
 {id:'kanban',selector:'#piui-kanban-board, [data-kanban]',load:()=>import('./kanban.js'),init:'initKanbanBoards'},
 {id:'enterprise',selector:'[data-component-catalog], [data-piui-rbac-tree], [data-piui-secret-box]',load:()=>import('./enterprise-suite.js'),init:'initEnterpriseSuite'},
 {id:'notification-launchers',phase:'shell',selector:'.piui-app-shell',load:()=>import('./notification-center.js'),init:'initNotificationLaunchers'},
 {id:'help',selector:'main',load:()=>import('./product-help.js'),init:'initProductHelp'},
 {id:'catalog-contracts',selector:'#heading-component-contracts',load:()=>import('./catalog-contracts.js'),init:'initCatalogContracts'},
 {id:'motion',selector:'[data-wow]',load:()=>import('./wow-motion.js'),init:'initWowAnimations'},
 {id:'lazy-media',selector:'[data-lazy-src], [data-lazy]',load:()=>import('./lazy-media.js'),init:'initLazyMedia'}
];
const states=new Map();
export async function initFeatures(phase='default') {
 for(const feature of FEATURES.filter(item=>(item.phase||'default')===phase)) {
  const host=document.querySelector(feature.selector);if(!host||states.get(feature.id)==='ready'||states.get(feature.id)==='loading')continue;
  const key=`data-feature-${feature.id}`,previous=document.querySelector(`[data-feature-error="${feature.id}"]`);previous?.remove();states.set(feature.id,'loading');
  try{if(feature.style)await loadStyle(feature.style);const module=await feature.load();if(typeof module[feature.init]!=='function')throw new Error('Initializer tidak tersedia');await module[feature.init]();states.set(feature.id,'ready');host.setAttribute(key,'ready');}
  catch(error){states.set(feature.id,'error');host.setAttribute(key,'error');const alert=contentStack();alert.classList.add('piui-alert','piui-data-feedback');alert.setAttribute('role','alert');alert.setAttribute('data-feature-error',feature.id);alert.append(el('p','',`${feature.id} belum dimuat. Draf/data halaman tidak dikirim. ${error.message}`),actionGroup(button('Coba lagi',async()=>{await initFeatures(phase);refreshHealth();})));(host.closest('section')||document.querySelector('main')||host).prepend(alert);}
 }
 refreshHealth();
}
function refreshHealth(){document.documentElement.setAttribute('data-ui-health',[...states.values()].includes('error')?'degraded':'healthy');}
