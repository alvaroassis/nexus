import { copy } from "./copy.mjs";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let draft = {language:"en",country:"US",time_zone:"America/New_York",home:""};
try { draft = {...draft,...JSON.parse(localStorage.getItem("nexus-draft") || "{}")}; } catch {}
if (!copy[draft.language]) draft.language = "en";
let page="boot", token="", regions={}, state={}, network={interfaces:[]}, snapshot=null, busy=false, flow="", room="", tab="dashboard", editing=false, online=true;
const t = key => copy[draft.language][key] || copy[draft.language].invalid;
const saveDraft = () => {try{localStorage.setItem("nexus-draft",JSON.stringify(draft))}catch{}};
const button = (action,key,kind="primary",extra="") => '<button type="button" data-action="'+action+'" class="'+kind+'" '+extra+'>'+t(key)+'</button>';
const field = (name,key,type="text",extra="") => '<label>'+t(key)+'<input name="'+name+'" type="'+type+'" required '+extra+'></label>';
const message = key => {$("message").textContent=key?t(key):""};
async function request(path, data) {
  const r=await fetch(path,{method:data?"POST":"GET",headers:data?{"Content-Type":"application/json","X-Nexus-Token":token}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(45000)});
  const v=await r.json(); if(!r.ok) throw new Error(v.error || "invalid"); return v;
}
async function run(fn) {
  if(busy)return;
  busy=true;message("");
  const buttons=[...document.querySelectorAll("button")].map(b=>[b,b.disabled]);
  buttons.forEach(([b])=>b.disabled=true);
  try{await fn()}catch(e){message(e.message==="signIn"?"authFailed":e.message)}
  finally{busy=false;buttons.forEach(([b,disabled])=>{if(b.isConnected)b.disabled=disabled})}
}
function go(next){page=next;message("");render();$("app").focus();if(!matchMedia("(prefers-reduced-motion: reduce)").matches)$("app").animate([{opacity:0,transform:"translateY(8px)"},{opacity:1,transform:"none"}],{duration:220});saveDraft()}
function regionFields(){
  const names=new Intl.DisplayNames([draft.language],{type:"region"});
  const countries=Object.keys(regions).sort((a,b)=>names.of(a).localeCompare(names.of(b),draft.language));
  if(!regions[draft.country])draft.country=countries.includes("US")?"US":countries[0];
  if(!regions[draft.country]?.includes(draft.time_zone))draft.time_zone=regions[draft.country]?.[0];
  return '<div class="grid"><label>'+t("country")+'<select name="country" id="country">'+countries.map(c=>'<option value="'+c+'" '+(draft.country===c?"selected":"")+'>'+esc(names.of(c))+'</option>').join("")+'</select></label><label>'+t("zone")+'<select name="time_zone">'+(regions[draft.country]||[]).map(z=>'<option '+(z===draft.time_zone?"selected":"")+'>'+esc(z)+'</option>').join("")+'</select></label></div>';
}
function footer(previous,next="next",key="next"){return '<div class="actions">'+(previous?button(previous,"back","secondary back"):"")+button(next,key)+'</div>'}
function render(){
 document.documentElement.lang=draft.language;
 $("keyboard-button").hidden=page==="boot";$("keyboard-button").ariaLabel=t("keyboard");
 $("app").className=page==="dashboard"?"dashboard":"";
 const steps=["language","region","network","account","home","done"];
 const index=steps.indexOf(page);
 $("step-label").textContent=index>=0&&!editing?t("step")+" "+(index+1)+" / 6":"";
 let html="";
 if(page==="boot")html='<section class="splash"><span class="symbol" aria-hidden="true">N</span><h1>NEXUS</h1><div class="loader"></div><p>'+t("starting")+'</p></section>';
 if(page==="language")html='<h1>'+t("language")+'</h1><p>'+t("languageHelp")+'</p><div class="choices">'+[["en","English"],["pt","Português"],["es","Español"]].map(([v,n])=>'<button class="choice" data-lang="'+v+'" aria-pressed="'+(v===draft.language)+'">'+n+'<span>'+(v===draft.language?"✓":"")+'</span></button>').join("")+'</div>'+footer(editing?"cancel":null);
 if(page==="region")html='<h1>'+t("region")+'</h1><p>'+t("regionHelp")+'</p><form id="region-form">'+regionFields()+'<div class="actions">'+button("language","back","secondary back")+'<button class="primary">'+t("next")+'</button></div></form>';
 if(page==="network"){
   const wireless=network.interfaces.filter(i=>i.type==="wireless");
   html='<h1>'+t("network")+'</h1><p>'+t("networkHelp")+'</p><p id="connection" class="status '+(network.interfaces.some(i=>i.connected)?"good":"")+'">'+t(network.interfaces.some(i=>i.connected)?"connected":"disconnected")+'</p>';
   if(wireless.length)html+='<form id="wifi-form"><input type="hidden" name="interface" value="'+esc(wireless[0].interface)+'"><div class="grid"><label>'+t("ssid")+'<input name="ssid" list="networks" required maxlength="32" autocomplete="off"><datalist id="networks"></datalist></label><label>'+t("security")+'<select name="auth"><option value="wpa-psk">WPA / WPA2 / WPA3</option><option value="open">'+t("open")+'</option></select></label></div><label>'+t("password")+'<input name="password" type="password" autocomplete="off" maxlength="64"></label><div class="actions">'+button("scan","scan","secondary")+'<button class="primary">'+t("join")+'</button></div></form>';
   else html+='<p>'+t("noWifi")+'</p>';
   html+=footer(editing?"cancel":"region","network-next",editing?"save":network.interfaces.some(i=>i.connected)?"next":"offline");
 }
 if(page==="account"||page==="login"){
   const fresh=page==="account";
   html='<h1>'+t(fresh?"account":"login")+'</h1><p>'+t(fresh?"accountHelp":"languageHelp")+'</p><form id="account-form">';
   if(flow)html+=field("code","code","text",'inputmode="numeric" autocomplete="one-time-code"');
   else{
     if(fresh)html+=field("name","name","text",'maxlength="80" autocomplete="name"');
     html+=field("username","username","text",'maxlength="80" autocapitalize="none" autocomplete="username"');
     html+=field("password","password","password",'maxlength="128" '+(fresh?'minlength="12" autocomplete="new-password"':'autocomplete="current-password"'));
     if(fresh)html+='<p>'+t("passwordHelp")+'</p>'+field("confirmation","confirmPassword","password",'autocomplete="new-password"');
   }
   html+='<div class="actions">'+(fresh?button("network","back","secondary back"):"")+'<button class="primary">'+t(fresh?"next":"signIn")+'</button></div></form>';
 }
 if(page==="home")html='<h1>'+t("home")+'</h1><p>'+t("homeHelp")+'</p><form id="home-form">'+field("home","homeName","text",'maxlength="80" value="'+esc(draft.home)+'"')+'<div class="actions">'+button("region","back","secondary back")+'<button class="primary">'+t("finish")+'</button></div></form>';
 if(page==="done")html='<section class="splash"><span class="symbol" aria-hidden="true">N</span><h1 style="letter-spacing:-.04em">'+t("done")+'</h1><p>'+t("doneHelp")+'</p>'+button("enter","enter")+'</section>';
 if(page==="dashboard")html=dashboard();
 $("app").innerHTML='<section class="screen">'+html+'</section>';
}
function dashboard(){
 if(!snapshot)return '<p>'+t("starting")+'</p>';
 const nav='<nav>'+["dashboard","devices","settings"].map(k=>button("tab-"+k,k,"secondary",'aria-pressed="'+(tab===k)+'"')).join("")+'</nav>';
 let body='<h1>'+esc(snapshot.config.location_name)+'</h1>'+nav;
 if(!online)body+='<p role="status">'+t("connectionLost")+'</p>';
 if(tab==="settings")return body+'<div class="cards"><section class="card"><h2>'+esc(snapshot.user.name)+'</h2><p>'+esc(snapshot.config.time_zone)+'</p>'+button("logout","logout","secondary")+'</section><section class="card"><h2>'+t("settings")+'</h2><div class="choices">'+button("edit-language","languageHelp","secondary")+(snapshot.user.is_admin?button("edit-region","homeSettings","secondary")+button("edit-network","networkSettings","secondary"):"")+'</div></section></div>';
 const favorites=snapshot.preferences.favorites||[];
 const hidden=new Set(snapshot.entities.filter(e=>e.hidden_by||e.disabled_by||e.entity_category||e.platform==="backup").map(e=>e.entity_id));
 const registry=new Map(snapshot.entities.map(e=>[e.entity_id,e]));
 const devices=new Map((snapshot.devices||[]).map(d=>[d.id,d]));
 const areaOf=id=>{const e=registry.get(id);return e?.area_id||devices.get(e?.device_id)?.area_id};
 let entities=snapshot.states.filter(e=>!hidden.has(e.entity_id)&&["light","switch","fan","climate","cover","sensor","binary_sensor","media_player","scene"].includes(e.entity_id.split(".")[0]));
 if(tab==="dashboard"&&favorites.length)entities=entities.filter(e=>favorites.includes(e.entity_id));
 if(tab==="dashboard"&&!favorites.length)entities=entities.filter(e=>e.attributes.device_class!=="timestamp");
 if(room)entities=entities.filter(e=>areaOf(e.entity_id)===room);
 body+='<label>'+t("all")+'<select id="room"><option value="">'+t("all")+'</option>'+snapshot.areas.map(a=>'<option value="'+esc(a.area_id)+'" '+(room===a.area_id?"selected":"")+'>'+esc(a.name)+'</option>').join("")+'</select></label>';
 if(!entities.length)return body+'<section class="card"><h2>'+t("empty")+'</h2><p>'+t("emptyHelp")+'</p></section>';
 return body+'<div class="cards">'+entities.map(e=>{
 const domain=e.entity_id.split(".")[0], unavailable=["unavailable","unknown"].includes(e.state);
 let control=button("details","details","secondary",'data-entity="'+esc(e.entity_id)+'"');
 if(["light","switch","fan"].includes(domain))control=button("control",e.state==="on"?"off":"on","primary",'data-entity="'+esc(e.entity_id)+'" data-service="'+(e.state==="on"?"turn_off":"turn_on")+'" '+(!online||unavailable?"disabled":""));
 if(domain==="scene")control=button("control","activate","primary",'data-entity="'+esc(e.entity_id)+'" data-service="turn_on" '+(!online?"disabled":""));
 return '<article class="card '+(e.state==="on"?"on":"")+'"><div class="card-top"><small>'+esc(domain)+'</small><button class="star" data-action="favorite" data-entity="'+esc(e.entity_id)+'" aria-label="'+t("favorite")+': '+esc(e.attributes.friendly_name||e.entity_id)+'" aria-pressed="'+favorites.includes(e.entity_id)+'">'+(favorites.includes(e.entity_id)?"★":"☆")+'</button></div><h2>'+esc(e.attributes.friendly_name||e.entity_id)+'</h2><p>'+esc(unavailable?t("unavailable"):["on","off"].includes(e.state)?t(e.state):e.state)+' '+esc(e.attributes.unit_of_measurement||"")+'</p>'+control+'</article>';
 }).join("")+'</div>';
}
async function refreshNetwork(){
 try{network=await request("/network");if(page==="network")render()}catch{network={interfaces:[]};if(page==="network")render();message("networkFailed")}
}
async function loadDashboard(){
 snapshot=await request("/app/snapshot",{});
 draft.language=snapshot.preferences.language||draft.language;
 draft.home=snapshot.config.location_name;
 draft.country=snapshot.config.country||draft.country;
 draft.time_zone=snapshot.config.time_zone||draft.time_zone;
 online=true;
}
function detail(id){
 const e=snapshot.states.find(s=>s.entity_id===id);if(!e)return;
 const domain=id.split(".")[0],disabled=!online||["unavailable","unknown"].includes(e.state);
 let html='<h2>'+esc(e.attributes.friendly_name||id)+'</h2><p>'+esc(e.state)+'</p>';
 if(domain==="cover")html+='<div class="actions">'+[["open_cover","openCover"],["stop_cover","stop"],["close_cover","close"]].map(([s,k])=>button("control",k,"secondary",'data-entity="'+esc(id)+'" data-service="'+s+'" '+(disabled?"disabled":""))).join("")+'</div>';
 if(domain==="climate"||domain==="media_player"){
 const climate=domain==="climate";
 html+='<form id="detail-form" data-entity="'+esc(id)+'" data-service="'+(climate?"set_temperature":"volume_set")+'">'+field("value",climate?"temperature":"volume","number",'step="'+(climate?".5":".05")+'" min="'+(climate?esc(e.attributes.min_temp??7):"0")+'" max="'+(climate?esc(e.attributes.max_temp??35):"1")+'" value="'+esc(climate?e.attributes.temperature??20:e.attributes.volume_level??.5)+'"')+'<button class="primary" '+(disabled?"disabled":"")+'>'+t("save")+'</button></form>';
 if(!climate)html+=button("control","play","secondary",'data-entity="'+esc(id)+'" data-service="media_play_pause" '+(disabled?"disabled":""));
 }
 html+='<div class="actions">'+button("close","close","secondary")+'</div>';
 $("details").innerHTML=html;$("details").showModal();
}
document.addEventListener("change",e=>{
 if(e.target.id==="country"){draft.country=e.target.value;render()}
 if(e.target.id==="room"){room=e.target.value;render()}
});
document.addEventListener("click",e=>{
 const b=e.target.closest("button");if(!b||b.disabled)return;
 if(b.dataset.lang){draft.language=b.dataset.lang;saveDraft();render();return}
 const action=b.dataset.action;if(!action)return;
 void run(async()=>{
 if(action==="keyboard")await request("/keyboard",{});
 if(["language","region","network"].includes(action)){go(action);if(action==="network")await refreshNetwork()}
 if(action==="next"){
   if(editing&&page==="language"){await request("/app/preferences",{language:draft.language});await loadDashboard();go("dashboard");editing=false}
   else go("region");
 }
 if(action==="scan"){
   const result=await request("/scan",{interface:network.interfaces.find(i=>i.type==="wireless")?.interface});
   $("networks").replaceChildren(...[...new Set(result.accesspoints.map(p=>p.ssid))].map(s=>new Option(s,s)));
 }
 if(action==="network-next"){
   if(editing){editing=false;await loadDashboard();go("dashboard")}
   else{
     state=await request("/state");
     if(!state.ready)throw new Error("starting");
     go(state.authenticated?"home":state.new?"account":"login");
   }
 }
 if(action==="enter"||action==="cancel"){editing=false;await loadDashboard();go("dashboard")}
 if(action.startsWith("tab-")){tab=action.slice(4);render()}
 if(action.startsWith("edit-")){editing=true;go(action.slice(5));if(page==="network")await refreshNetwork()}
 if(action==="logout"&&confirm(t("logoutConfirm"))){await request("/app/logout",{});snapshot=null;flow="";editing=false;go("login")}
 if(action==="favorite"){
   const id=b.dataset.entity, favorites=snapshot.preferences.favorites||[];
   await request("/app/preferences",{favorites:favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id]});
   await loadDashboard();render();
 }
 if(action==="details")detail(b.dataset.entity);
 if(action==="close")$("details").close();
 if(action==="control"){
   if(b.dataset.entity.startsWith("scene.")&&!confirm(t("confirmScene")))return;
   await request("/app/control",{entity_id:b.dataset.entity,service:b.dataset.service});
   await loadDashboard();render();
 }
 });
});
document.addEventListener("submit",e=>{
 e.preventDefault();const form=e.target,data=Object.fromEntries(new FormData(form));
 void run(async()=>{
  if(form.id==="region-form"){draft.country=data.country;draft.time_zone=data.time_zone;go(editing?"home":"network");if(!editing)await refreshNetwork()}
  if(form.id==="wifi-form"){
   form.querySelector('[name="password"]').value="";
   try{
    await request("/join",data);message("requested");
    let connected=false;
    for(let i=0;i<20;i++){
     await new Promise(r=>setTimeout(r,1500));
     network=await request("/network");
     if(network.interfaces.some(n=>n.interface===data.interface&&n.connected)){connected=true;break}
    }
    render();message(connected?"connected":"networkFailed");
   }finally{data.password=""}
  }
  if(form.id==="account-form"){
   const fresh=page==="account";
   if(fresh&&data.password!==data.confirmation)throw new Error("mismatch");
   form.querySelectorAll('input[type="password"]').forEach(n=>n.value="");
   let result;
   try{result=await request(fresh?"/app/owner":"/app/login",{...data,language:draft.language,flow})}finally{data.password="";data.confirmation=""}
   if(result.flow){flow=result.flow;render();if(result.invalid)message("authFailed");return}
   flow="";state=await request("/state");
   if(state.preferences?.setup||!state.user?.is_admin){await loadDashboard();go("dashboard")}else go("home");
  }
  if(form.id==="home-form"){draft.home=data.home;saveDraft();message("saving");await request("/app/finish",draft);editing=false;go("done")}
  if(form.id==="detail-form"){await request("/app/control",{entity_id:form.dataset.entity,service:form.dataset.service,value:Number(data.value)});$("details").close();await loadDashboard();render()}
 });
});
async function boot(){
 render();
 try{
  token=(await request("/session")).token;
  regions=await request("/regions");
  for(let attempt=0;attempt<180;attempt++){
   try{state=await request("/state");if(state.ready)break}catch{}
   if(attempt===10)message("slow");
   // New setup can start while the core is still loading.
   if(attempt===0&&!localStorage.getItem("nexus-draft")){go("language");break}
   await new Promise(r=>setTimeout(r,2000));
  }
  if(page==="boot"){
   if(state.authenticated&&(state.preferences?.setup||!state.user?.is_admin)){await loadDashboard();go("dashboard")}
   else if(state.authenticated)go("language");
   else go(state.new?"language":"login");
  }
 }catch{message("starting");setTimeout(boot,3000)}
}
void boot();
setInterval(async()=>{
 if(page!=="dashboard"||busy||$("details").open)return;
 try{await loadDashboard();if(document.activeElement?.tagName!=="SELECT")render()}
 catch(e){online=false;render();if(e.message==="signIn"){snapshot=null;go("login")}else message("connectionLost")}
},5000);
