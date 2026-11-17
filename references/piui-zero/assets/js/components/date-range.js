import { bindPopup } from "./popup-layer.js";
import { readUrlState, updateUrlState, onUrlStateChange } from "../core/url-state.js";
import { tableState } from '../core/table-state.js';

let count=0;
export function initDateRangePickers(root=document) {
  root.querySelectorAll(".piui-filter-bar").forEach(bar=>{
    if(bar.querySelector(".piui-daterange")) return;
    const scope=bar.closest('[data-table-scope], .piui-panel, section'),table=scope?.querySelector('[data-table-state-index]');
    const state=table?tableState(table,scope,Number(table.getAttribute('data-table-state-index'))):{read:readUrlState,write:updateUrlState};
    const readUrlStateScoped=state.read,updateUrlStateScoped=state.write;
    const id=`date-range-${++count}`;
    const field=document.createElement("div");field.className="piui-field piui-daterange";
    const label=document.createElement("span");label.className="piui-field__label";label.textContent="Rentang tanggal";
    const trigger=document.createElement("button");trigger.type="button";trigger.className="piui-daterange__trigger";trigger.setAttribute("aria-haspopup","dialog");
    const panel=document.createElement("div");panel.className="piui-daterange__popover";panel.setAttribute("role","dialog");panel.setAttribute("aria-label","Pilih rentang tanggal");
    const inputs=[];
    for(const [key,title] of [["from","Tanggal mulai"],["to","Tanggal akhir"]]) {
      const wrap=document.createElement("div");wrap.className="piui-field";
      const lbl=document.createElement("label");lbl.htmlFor=`${id}-${key}`;lbl.className="piui-field__label";lbl.textContent=title;
      const input=document.createElement("input");input.type="date";input.id=lbl.htmlFor;input.className="piui-input";
      wrap.append(lbl,input);panel.append(wrap);inputs.push(input);
    }
    const presets=document.createElement("div");presets.className="piui-page-actions";
    for(const [days,title] of [[1,"Hari ini"],[7,"7 hari"],[30,"30 hari"]]) {
      const button=document.createElement("button");button.type="button";button.className="piui-btn piui-btn--secondary piui-btn--sm";button.textContent=title;
      button.addEventListener("click",()=>{
        const end=new Date(),start=new Date(end);start.setDate(start.getDate()-days+1);
        const iso=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
        inputs[0].value=iso(start);inputs[1].value=iso(end);inputs[1].setCustomValidity("");
      });presets.append(button);
    }
    const apply=document.createElement("button");apply.type="button";apply.className="piui-btn piui-btn--primary";apply.textContent="Terapkan rentang";
    const reset=document.createElement("button");reset.type="button";reset.className="piui-btn piui-btn--secondary";reset.textContent="Semua tanggal";
    panel.append(presets,apply,reset);field.append(label,trigger,panel);bar.append(field);
    const popup=bindPopup({panel,trigger});
    const sync=()=>{const state=readUrlStateScoped();inputs[0].value=state.from;inputs[1].value=state.to;trigger.textContent=state.from||state.to ? `${state.from||"Awal"} – ${state.to||"Sekarang"}`:"Semua tanggal";};
    trigger.addEventListener("click",event=>{event.preventDefault();if(popup.isOpen())popup.close();else{popup.show();inputs[0].focus();}});
    apply.addEventListener("click",()=>{
      inputs[1].setCustomValidity(inputs[0].value&&inputs[1].value&&inputs[0].value>inputs[1].value?"Tanggal akhir harus sama atau setelah tanggal mulai.":"");
      if(!inputs.every(input=>input.reportValidity()))return;
      updateUrlStateScoped({from:inputs[0].value,to:inputs[1].value,page:1});popup.close();trigger.focus();
    });
    reset.addEventListener("click",()=>{updateUrlStateScoped({from:"",to:"",page:1});popup.close();trigger.focus();});
    inputs.forEach(input=>input.addEventListener("input",()=>inputs[1].setCustomValidity("")));
    onUrlStateChange(sync);sync();
  });
}
