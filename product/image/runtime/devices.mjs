// Native Nexus device controls and pairing forms. All backend text is escaped.
export const escape = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const volumePercent = value => Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100);
export const mediaFeatures = entity => Number(entity.attributes?.supported_features) || 0;
export const hasFeature = (entity,flag) => (mediaFeatures(entity)&flag)!==0;
export const icon = name => {
 const paths={power:'<path d="M12 3v9M6.3 5.8a9 9 0 1 0 11.4 0"/>',volume:'<path d="m11 5-6 4H2v6h3l6 4V5ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',tv:'<rect x="2" y="3" width="20" height="14" rx="3"/><path d="M8 21h8m-4-4v4"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',plus:'<path d="M12 4v16M4 12h16"/>'};
 return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(paths[name]||paths.tv)+'</svg>';
};
export function mediaControls(entity,t,online=true){
 const a=entity.attributes||{},id=escape(entity.entity_id),off=entity.state==="off";
 const disabled=!online||["unavailable","unknown"].includes(entity.state);
 const attrs=' data-action="control" data-entity="'+id+'" ';
 const button=(service,label,body=escape(label),extra="")=>'<button type="button" class="media-button" '+attrs+'data-service="'+service+'" aria-label="'+escape(label)+'" '+extra+(disabled?" disabled":"")+'>'+body+'</button>';
 let html='<div class="media-controls" data-media="'+id+'"><div class="media-actions">';
 const service=off?"turn_on":"turn_off",powerFlag=off?128:256;
 if(hasFeature(entity,powerFlag))html+=button(service,t(off?"powerOn":"powerOff"),icon("power")+'<span>'+t(off?"powerOn":"powerOff")+'</span>','aria-pressed="'+!off+'" ');
 if(hasFeature(entity,entity.state==="playing"?1:16384))html+=button(entity.state==="playing"?"media_pause":"media_play",t(entity.state==="playing"?"pauseMedia":"playMedia"));
 if(hasFeature(entity,8))html+=button("volume_mute",t(a.is_volume_muted?"unmute":"mute"),escape(t(a.is_volume_muted?"unmute":"mute")),'data-value="'+!a.is_volume_muted+'" aria-pressed="'+!!a.is_volume_muted+'" ');
 html+='</div>';
 if(hasFeature(entity,4)){
  const percent=volumePercent(a.volume_level);
  html+='<label class="volume-control"><span>'+icon("volume")+escape(t("volume"))+'<output>'+percent+'%</output></span><input type="range" min="0" max="100" step="1" value="'+percent+'" data-volume data-entity="'+id+'" aria-label="'+escape(t("volume"))+'" '+(disabled||off?"disabled":"")+'></label>';
 }else if(hasFeature(entity,1024)){
  html+='<div class="media-actions">'+button("volume_down",t("volumeDown"),"−")+button("volume_up",t("volumeUp"),"+")+'</div>';
 }
 if(hasFeature(entity,2048)&&a.source_list?.length)html+='<label class="source-control">'+escape(t("inputSource"))+'<select aria-label="'+escape(t("inputSource"))+'" data-source data-entity="'+id+'" '+(disabled||off?"disabled":"")+'>'+a.source_list.map(source=>'<option '+(source===a.source?"selected":"")+' value="'+escape(source)+'">'+escape(source)+'</option>').join("")+'</select></label>';
 return html+'</div>';
}
const pages=new Map();
export function shiftPage(key,delta){pages.set(key,Math.max(0,(pages.get(key)||0)+delta))}
export function paged(items,key,t,size=2){
 const total=Math.max(1,Math.ceil(items.length/size)),index=Math.min(pages.get(key)||0,total-1);pages.set(key,index);
 return {items:items.slice(index*size,index*size+size),footer:total>1?'<div class="list-pager"><button type="button" data-action="list-prev" data-list="'+key+'" '+(index===0?'disabled':'')+'>'+t("back")+'</button><span>'+(index+1)+' / '+total+'</span><button type="button" data-action="list-next" data-list="'+key+'" '+(index===total-1?'disabled':'')+'>'+t("next")+'</button></div>':""};
}
export function discoveryView(data,t,section="found"){
 let html='<div class="section-heading"><h2>'+t("discoverTitle")+'</h2><button type="button" data-action="discover-refresh">'+t("refreshDevices")+'</button></div>';
 if(!data)return html+'<p role="status">'+t("findingDevices")+'</p>';
 html+='<nav>'+[["found","nearbyDevices"],["catalog","addByBrand"],["configured","connectedIntegrations"],["diagnostics","discoveryDiagnostics"]].map(([key,label])=>'<button type="button" data-action="discovery-tab" data-tab="'+key+'" aria-pressed="'+(section===key)+'">'+t(label)+'</button>').join("")+'</nav>';
 if(section==="diagnostics"){
  const d=data.diagnostics||{};
  return html+'<section class="card"><p>'+t("discoveryExplanation")+'</p><p>'+t("discoveryServices")+': SSDP '+(d.ssdp?'✓':'—')+' · mDNS '+(d.zeroconf?'✓':'—')+'</p><p>'+t("nearbyDevices")+': '+data.found.length+' · '+t("connectedIntegrations")+': '+data.configured.length+'</p><p>'+t("discoveryNetworkHelp")+'</p></section>';
 }
 const list=paged(data[section]||[],section,t,section==="catalog"?6:2);
 if(section==="found")html+=list.items.length?'<div class="cards">'+list.items.map(d=>'<article class="card discovery-card"><small>'+escape(d.brand)+'</small><h3>'+escape(d.name)+'</h3><button type="button" class="primary" data-action="pair" data-flow="'+escape(d.flow_id)+'">'+t("addDevice")+'</button></article>').join("")+'</div>':'<div class="empty-state"><h3>'+t("noNearby")+'</h3><p>'+t("noNearbyHelp")+'</p></div>';
 if(section==="catalog")html+='<p>'+t("addByBrandHelp")+'</p><div class="brand-grid">'+list.items.map(d=>'<button type="button" data-action="pair" data-handler="'+escape(d.handler)+'">'+escape(d.name)+'</button>').join("")+'</div>';
 if(section==="configured")html+='<div class="integration-list">'+list.items.map(d=>'<div><strong>'+escape(d.name)+'</strong><span>'+escape(d.brand)+'</span><small>'+escape(d.state)+'</small></div>').join("")+'</div>';
 return html+list.footer;
}
const fieldLabel=(name,t)=>{
 const value=t("field_"+name);
 return value===t("invalid")?name.replaceAll("_"," "):value;
};
export function pairingView(step,t){
 const close='<button type="button" class="secondary" data-action="pair-close">'+t("close")+'</button>';
 let html='<div class="pair-heading"><span class="device-icon">'+icon("plus")+'</span><div><small>'+t("addDevice")+'</small><h2 id="pair-title">'+escape(step.title)+'</h2></div></div>';
 if(step.type==="create_entry")return html+'<p role="status" class="status good">'+t("deviceAdded")+'</p><p>'+t("deviceAddedHelp")+'</p><div class="actions">'+close+'</div>';
 if(step.type==="abort")return html+'<p role="status">'+t(["already_configured","already_in_progress"].includes(step.reason)?"alreadyAdded":"pairStopped")+'</p><div class="actions">'+close+'</div>';
 if(["progress","progress_done"].includes(step.type))return html+'<div class="loader"></div><p role="status">'+t("pairWaiting")+'</p><p>'+t("pairHelp")+'</p><div class="actions">'+close+'</div>';
 if(step.type==="menu")return html+'<div class="choices">'+step.menu.map(item=>'<button type="button" data-action="pair-menu" data-step="'+escape(item.value)+'">'+escape(fieldLabel(item.value,t))+'</button>').join("")+'</div><div class="actions">'+close+'</div>';
 if(step.type!=="form"||!step.supported)return html+'<p role="status">'+t("pairUnsupported")+'</p><div class="actions">'+close+'</div>';
 html+='<p>'+t("pairHelp")+'</p>';
 if(Object.keys(step.errors||{}).length)html+='<p role="alert" class="status error">'+t("pairError")+'</p>';
 html+='<form id="pair-form" autocomplete="off">';
 for(const f of step.fields){
  const name=escape(f.name),label=escape(fieldLabel(f.name,t)),required=f.required?' required':"",value=escape(f.default??"");
  if(f.kind==="boolean"){html+='<label class="check-field"><input type="checkbox" name="'+name+'" '+(f.default?"checked":"")+'>'+label+'</label>';continue}
  html+='<label>'+label;
  if(f.kind==="select")html+='<select aria-label="'+label+'" name="'+name+'" '+(f.multiple?"multiple ":"")+required+'>'+(!f.required&&!f.multiple?'<option value="">'+t("optional")+'</option>':"")+f.options.map((option,i)=>'<option value="'+i+'" '+(option.value===f.default?"selected":"")+'>'+escape(option.label)+'</option>').join("")+'</select>';
  else html+='<input name="'+name+'" type="'+(f.kind==="number"?"number":f.secret?"password":"text")+'" value="'+value+'" '+required+' '+(f.kind==="number"?['min','max'].filter(k=>f[k]!==undefined).map(k=>k+'="'+f[k]+'"').join(" ")+' step="'+(f.step??"any")+'"':'maxlength="1024" autocomplete="off" autocapitalize="none"')+'>';
  html+='</label>';
 }
 return html+'<div class="actions">'+close+'<button class="primary">'+t(step.fields.length?"next":"addDevice")+'</button></div></form>';
}
export function readPairValues(form,step){
 const data=new FormData(form),values={};
 for(const field of step.fields){
  const value=data.get(field.name);
  if(field.kind==="boolean"){values[field.name]=data.has(field.name);continue}
  if(!field.required&&(value===null||value===""))continue;
  if(field.kind==="select")values[field.name]=field.multiple?data.getAll(field.name).map(v=>field.options[Number(v)].value):field.options[Number(value)].value;
  else values[field.name]=field.kind==="number"?Number(value):String(value??"");
 }
 return values;
}

