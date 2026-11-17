/** Small safe DOM primitives shared by composed components. */
export function el(tag, className, text) {
 const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=String(text);return node;
}
export function button(label, action, className='piui-btn piui-btn--secondary piui-btn--sm') {
 const node=el('button',className,label);node.type='button';if(action)node.addEventListener('click',action);return node;
}
/** Compose existing nodes without cloning or replacing their handlers. */
export function actionGroup(...controls) {
 const group=el('div','piui-page-actions');group.append(...controls);return group;
}
export function contentStack(...children) {
 const stack=el('div','piui-content-stack');stack.append(...children);return stack;
}
let sequence=0;
export function field(label, {tag='input',type='text',value='',required=false,name='',options}={}) {
 const wrap=el('div','piui-field'),caption=el('label','piui-field__label',label),input=el(tag,tag==='select'?'piui-select':tag==='textarea'?'piui-textarea':'piui-input');
 input.id=`piui-field-${++sequence}`;caption.htmlFor=input.id;if(tag==='input')input.type=type;
 if(options)for(const [key,text] of options){const opt=el('option','',text);opt.value=key;input.append(opt);}
 if(type==='checkbox'||type==='radio')input.className='';input.value=value;input.name=name;input.required=required;wrap.append(caption,input);return {wrap,input};
}
