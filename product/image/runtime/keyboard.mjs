// SPDX-License-Identifier: Apache-2.0
// Local tablet keyboard. No suggestions, logging, network calls or persistence.
const labels = {
 en:{keyboard:"Keyboard",hide:"Hide keyboard",next:"Next",done:"Done",space:"Space",shift:"Uppercase",delete:"Delete",left:"Move left",right:"Move right",letters:"Letters",symbols:"Numbers and symbols",accents:"Accents"},
 pt:{keyboard:"Teclado",hide:"Recolher teclado",next:"Próximo",done:"Concluído",space:"Espaço",shift:"Maiúsculas",delete:"Apagar",left:"Mover à esquerda",right:"Mover à direita",letters:"Letras",symbols:"Números e símbolos",accents:"Acentos"},
 es:{keyboard:"Teclado",hide:"Ocultar teclado",next:"Siguiente",done:"Listo",space:"Espacio",shift:"Mayúsculas",delete:"Borrar",left:"Mover a la izquierda",right:"Mover a la derecha",letters:"Letras",symbols:"Números y símbolos",accents:"Acentos"}
};
const editable = el => el instanceof HTMLInputElement &&
 !el.disabled && !el.readOnly && !el.hidden &&
 ["text","password","search","email","url","tel","number"].includes(el.type);
const escape = text => String(text).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const css = "\n:host{--key-bg:#252b35;--key-text:#edebe9;--accent:#f4a825;display:block;position:fixed;inset:auto 0 0;z-index:1000;background:#0f1319;color:var(--key-text);border-top:1px solid #323944;box-shadow:0 -10px 35px #0003;padding:8px max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom));font:18px system-ui;user-select:none;touch-action:manipulation}\n:host([hidden]){display:none}\n*{box-sizing:border-box}.keyboard{max-width:1100px;margin:auto}.toolbar{height:32px;display:flex;align-items:center;justify-content:space-between;padding-inline:8px;color:#a6adba;font-size:12px;letter-spacing:.08em}\n.toolbar button{min-height:28px;font-size:13px;padding:2px 12px;background:transparent;color:#edebe9;flex:none}\n.row{display:flex;justify-content:center;gap:6px;margin-top:6px}\nbutton{min-width:0;min-height:52px;flex:1;border:0;border-bottom:2px solid #080a0c;border-radius:10px;background:var(--key-bg);color:var(--key-text);font:inherit;font-size:22px;padding:4px 2px;cursor:pointer;touch-action:manipulation}\nbutton:active{background:#4f3b1b;transform:translateY(1px)}button:focus-visible{outline:3px solid var(--accent);outline-offset:1px}\nbutton:disabled{opacity:.4}.wide{flex:1.45}.space{flex:5;font-size:15px}.meta{font-size:16px;background:#1b212b}\n.primary,button[aria-pressed=true]{background:var(--accent);color:#0f1319}.action{flex:2;font-size:16px}.inset{padding-inline:4%}\n@media(max-height:600px){:host{padding-top:4px;padding-bottom:4px}.toolbar{height:24px}.row{margin-top:4px;gap:4px}button{min-height:44px;font-size:20px;border-radius:8px}.meta,.action{font-size:14px}}\n@media(max-width:500px){.row{gap:3px}:host{padding-inline:4px}button{font-size:18px}.inset{padding-inline:2%}.meta,.action{font-size:12px}}\n@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}\n";
export class NexusKeyboard extends HTMLElement {
 constructor(){
  super(); this.attachShadow({mode:"open"});this.hidden=true;
  this.target=null;this.mode="letters";this.shift=0;this.numberDraft="";
  this.resize=new ResizeObserver(()=>this.measure());
  this.shadowRoot.addEventListener("pointerdown",e=>{if(e.target.closest("button"))e.preventDefault()});
  this.shadowRoot.addEventListener("click",e=>{
   const key=e.target.closest("[data-key]");if(key&&!key.disabled)this.press(key.dataset.key);
  });
  document.addEventListener("focusin",e=>{
   if(editable(e.target))this.show(e.target);
  });
  document.addEventListener("pointerup",e=>{
   if(editable(e.target))this.show(e.target);
  });
  document.addEventListener("pointerdown",e=>{this.inputGesture=editable(e.target)});
  document.addEventListener("click",e=>{
   const inputGesture=this.inputGesture;this.inputGesture=false;
   // Resize after the completed gesture, so moving the form cannot swallow a tap.
   if(this.hidden||inputGesture||e.composedPath().includes(this)||editable(e.target)||e.target.closest("#keyboard-button"))return;
   this.hide();
  });
  document.addEventListener("submit",()=>this.hide(),true);
  document.addEventListener("close",()=>this.hide(),true);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!this.hidden){e.preventDefault();this.hide();this.target?.blur()}},true);
  document.addEventListener("input",e=>{if(e.isTrusted&&e.target===this.target&&this.target.type==="number")this.numberDraft=this.target.value});
  new MutationObserver(()=>{if(!this.hidden&&(!this.target?.isConnected||!this.target.getClientRects().length))this.hide()}).observe(document.body,{subtree:true,childList:true});
 }
 connectedCallback(){this.resize.observe(this)}
 disconnectedCallback(){this.resize.disconnect()}
 get words(){return labels[document.documentElement.lang]||labels.en}
 fields(){return [...(this.target?.form||document).querySelectorAll("input")].filter(el=>editable(el)&&el.getClientRects().length)}
 nextField(){const fields=this.fields();return fields[fields.indexOf(this.target)+1]}
 show(input){
  if(!editable(input))return;
  if(this.hidden||this.target!==input){this.target=input;this.mode=input.type==="number"||input.inputMode==="numeric"?"numbers":"letters";this.shift=0;this.numberDraft=input.type==="number"?input.value:""}
  const dialog=input.closest("dialog");
  if(dialog){dialog.dataset.keyboardActive="true";if(this.parentElement!==dialog)dialog.append(this)}
  else if(this.parentElement!==document.body)document.body.append(this);
  this.hidden=false;document.documentElement.dataset.keyboardOpen="true";this.render();this.measure();
 }
 hide(){
  this.hidden=true;delete document.documentElement.dataset.keyboardOpen;
  document.documentElement.style.setProperty("--keyboard-height","0px");
  document.querySelectorAll("dialog[data-keyboard-active]").forEach(d=>delete d.dataset.keyboardActive);
  if(this.parentElement!==document.body)document.body.append(this);
  this.numberDraft="";this.mode="letters";this.shift=0;
 }
 toggle(){if(!this.hidden)this.hide();else{const input=editable(document.activeElement)?document.activeElement:editable(this.target)&&this.target.isConnected?this.target:document.querySelector('input:not([type="hidden"]):not([disabled])');if(editable(input)){input.focus();this.show(input)}}}
 measure(){
  const height=this.hidden?0:this.getBoundingClientRect().height;
  document.documentElement.style.setProperty("--keyboard-height",height+"px");
  if(!this.hidden)requestAnimationFrame(()=>this.target?.scrollIntoView({block:"nearest",inline:"nearest",behavior:"instant"}));
 }
 key(value,label=value,kind="",aria=label){return '<button type="button" class="'+kind+'" data-key="'+escape(value)+'" aria-label="'+escape(aria)+'">'+escape(label)+'</button>'}
 render(){
  const w=this.words,upper=this.shift>0,number=this.target?.type==="number";
  this.setAttribute("role","region");this.setAttribute("aria-label",w.keyboard);
  const row=keys=>'<div class="row">'+keys.map(k=>this.key(upper?k.toLocaleUpperCase():k)).join("")+'</div>';
  let keys="";
  if(number){
   keys='<div class="row">'+[..."123"].map(k=>this.key(k)).join("")+this.key("delete","⌫","meta",w.delete)+'</div>';
   keys+='<div class="row">'+[..."456"].map(k=>this.key(k)).join("")+this.key("-","−","meta")+'</div>';
   keys+='<div class="row">'+[..."789"].map(k=>this.key(k)).join("")+this.key(".",".","meta")+'</div>';
  }else if(this.mode==="letters"){
   keys=row([..."qwertyuiop"])+'<div class="row inset">'+[..."asdfghjkl"+(document.documentElement.lang==="pt"?"ç":document.documentElement.lang==="es"?"ñ":"")].map(k=>this.key(upper?k.toLocaleUpperCase():k)).join("")+'</div>';
   keys+='<div class="row">'+this.key("shift",this.shift===2?"⇪":"⇧","meta wide",w.shift)+[..."zxcvbnm"].map(k=>this.key(upper?k.toLocaleUpperCase():k)).join("")+this.key("delete","⌫","meta wide",w.delete)+'</div>';
  }else if(this.mode==="accents"){
   keys=row([..."áàâãäéèêëí"])+row([..."ìîïóòôõöú"])+'<div class="row">'+this.key("shift",this.shift===2?"⇪":"⇧","meta wide",w.shift)+[..."ùûüçñ¿¡"].map(k=>this.key(upper?k.toLocaleUpperCase():k)).join("")+'</div>';
   // Replace the last row with a delete key at its end.
   const index=keys.lastIndexOf("</div>");keys=keys.slice(0,index)+this.key("delete","⌫","meta wide",w.delete)+keys.slice(index);
  }else if(this.mode==="symbols"){
   keys=row([..."[]{}<>^~`|"])+row([..."\\\"€£¥§°©®™"])+ '<div class="row">'+[..."@#%&*-_+=/"].map(k=>this.key(k)).join("")+this.key("delete","⌫","meta wide",w.delete)+'</div>';
  }else{
   keys=row([..."1234567890"])+row([..."@#$%&*()-+"])+ '<div class="row">'+[..."_=/!?.,:;'"].map(k=>this.key(k)).join("")+this.key("delete","⌫","meta wide",w.delete)+'</div>';
  }
  const alternate=this.mode==="numbers"?this.key("symbols","#+=","meta"):this.mode==="symbols"?this.key("numbers","123","meta",w.symbols):this.key("accents","áéí","meta",w.accents);
  const bottom='<div class="row">'+(number?this.key("0","0","space"):this.key(this.mode==="letters"?"numbers":"letters",this.mode==="letters"?"123":"ABC","meta wide",this.mode==="letters"?w.symbols:w.letters)+alternate+this.key("left","‹","meta",w.left)+this.key("space",w.space,"space")+this.key("right","›","meta",w.right))+this.key("next",this.nextField()?w.next:w.done,"primary action")+'</div>';
  this.shadowRoot.innerHTML='<style>'+css+'</style><div class="keyboard"><div class="toolbar"><span>NEXUS · '+document.documentElement.lang.toUpperCase()+'</span>'+this.key("hide","⌄ "+w.hide,"",w.hide)+'</div>'+keys+bottom+'</div>';
  this.shadowRoot.querySelector('[data-key="shift"]')?.setAttribute("aria-pressed",String(upper));
 }
 press(key){
  const target=this.target;
  if(key==="hide"){this.hide();target?.blur();return}
  if(!editable(target)||!target.isConnected){this.hide();return}
  if(["letters","numbers","symbols","accents"].includes(key)){this.mode=key;this.render();return}
  if(key==="shift"){this.shift=(this.shift+1)%3;this.render();return}
  if(key==="next"){const next=this.nextField();if(next)next.focus();else{this.hide();target.blur()}return}
  target.focus({preventScroll:true});
  if(key==="left"||key==="right"){
   if(target.selectionStart!==null){const pos=key==="left"?Math.max(0,target.selectionStart-1):Math.min(target.value.length,target.selectionEnd+1);target.setSelectionRange(pos,pos)}return;
  }
  const deletion=key==="delete",value=key==="space"?" ":key;
  if(!target.dispatchEvent(new InputEvent("beforeinput",{bubbles:true,cancelable:true,inputType:deletion?"deleteContentBackward":"insertText",data:deletion?null:value})))return;
  if(target.type==="number"){
   const raw=deletion?this.numberDraft.slice(0,-1):this.numberDraft+value;
   if(!/^-?\d*\.?\d*$/.test(raw))return;
   this.numberDraft=raw;target.value=raw.replace(/\.$/,"");
  }else{
   let start=target.selectionStart??target.value.length,end=target.selectionEnd??start;
   if(deletion&&start===end&&start>0){const segments=[...new Intl.Segmenter(undefined,{granularity:"grapheme"}).segment(target.value.slice(0,start))];start=segments.at(-1)?.index??0}
   const replacement=deletion?"":value;
   if(target.maxLength>=0&&target.value.length-(end-start)+replacement.length>target.maxLength)return;
   if(target.selectionStart!==null)target.setRangeText(replacement,start,end,"end");
   else target.value=target.value.slice(0,start)+replacement+target.value.slice(end);
  }
  target.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:deletion?"deleteContentBackward":"insertText",data:deletion?null:value}));
  if(this.shift===1&&!deletion&&key!=="space"){this.shift=0;this.render()}
  this.measure();
 }
}
if(!customElements.get("nexus-keyboard"))customElements.define("nexus-keyboard",NexusKeyboard);

