import { button } from '../core/dom.js';
import { initDataTables } from './data-table.js';
import { initMarkdownEditors } from './markdown-editor.js';
import { initEnterpriseSuite } from './enterprise-suite.js';
import { showToast } from '../core/session-guard.js';
import { initCollectionLayouts } from './collection-layout.js';
export function initCatalogContracts(root=document) {
 const heading=root.querySelector('#heading-component-contracts');if(!heading||!document.body.hasAttribute('data-component-catalog')||root.querySelector('[data-repeat-init]'))return;
 const repeat=button('Uji inisialisasi ulang',()=>{initDataTables();initMarkdownEditors();initEnterpriseSuite();initCollectionLayouts();showToast('Initializer dipanggil ulang. Nilai dan listener instance yang sudah aktif dipertahankan.');});repeat.setAttribute('data-repeat-init','');heading.after(repeat);
}
