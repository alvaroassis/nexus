// Touch interactions with isolated core fixtures; never controls a real home.
import assert from "node:assert/strict";
import {readFile,mkdir} from "node:fs/promises";
import {fileURLToPath,pathToFileURL} from "node:url";
import path from "node:path";
const {chromium}=await import(pathToFileURL(process.env.NEXUS_PLAYWRIGHT));
const root=fileURLToPath(new URL("../image/runtime/",import.meta.url));
const evidence=fileURLToPath(new URL("../qa/devices/",import.meta.url));
await mkdir(evidence,{recursive:true});
const browser=await chromium.launch(process.env.NEXUS_CHROME?{executablePath:process.env.NEXUS_CHROME}:{});
const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true});
const errors=[];page.on("pageerror",e=>errors.push(e.message));
const commands=[],pairValues=[];
let admin=true,added=false,manual=false,step=0;
const television={entity_id:"media_player.living_room",state:"on",attributes:{friendly_name:"TV da sala",supported_features:4|8|128|256|2048|16384|1,volume_level:.25,is_volume_muted:false,source_list:["HDMI 1","TV"],source:"HDMI 1"}};
const snapshot=()=>({user:{name:"Álvaro",is_admin:admin,is_owner:admin},config:{location_name:"Casa Nexus",country:"BR",time_zone:"America/Sao_Paulo"},preferences:{language:"pt",setup:true,favorites:[]},areas:[],entities:[],devices:[],states:[television,{entity_id:"media_player.readonly",state:"idle",attributes:{friendly_name:"Player sem controles",supported_features:0}}]});
const flow=()=>manual?{type:"form",title:"Roku",handler:"roku",flow_id:"manual",supported:true,fields:[{name:"host",kind:"text",required:true}],errors:{}}:step===0?{type:"form",title:"Samsung TV",handler:"samsungtv",flow_id:"found",supported:true,fields:[],errors:{}}:{type:"form",title:"Samsung TV",handler:"samsungtv",flow_id:"found",supported:true,fields:[{name:"pin",kind:"text",required:true,secret:true}],errors:{}};
await page.route("http://nexus.test/**",async route=>{
 const request=route.request(),url=new URL(request.url()).pathname;
 const data=request.method()==="POST"?request.postDataJSON():{};
 let json;
 if(url==="/session")json={token:"fixture"};
 else if(url==="/regions")json={BR:["America/Sao_Paulo"]};
 else if(url==="/state")json={ready:true,authenticated:true,new:false,...snapshot()};
 else if(url==="/app/snapshot")json=snapshot();
 else if(url==="/app/control"){
  commands.push(data);
  if(data.service==="volume_set")television.attributes.volume_level=data.value;
  if(data.service==="volume_mute")television.attributes.is_volume_muted=data.value;
  if(data.service==="turn_off")television.state="off";
  if(data.service==="turn_on")television.state="on";
  if(data.service==="select_source")television.attributes.source=data.value;
  json={ok:true};
 }else if(url==="/app/discover")json={found:added?[]:[{flow_id:"found",handler:"samsungtv",name:"TV do quarto",brand:"Samsung TV"}],configured:added?[{name:"TV do quarto",brand:"Samsung TV",state:"loaded"}]:[],catalog:[{handler:"roku",name:"Roku"}]};
 else if(url==="/app/pair"){manual=!!data.handler;step=0;json=flow()}
 else if(url==="/app/pair-step"){
  pairValues.push(data.values);
  if(step===0){step=1;json=flow()}
  else if(data.values.pin!=="1234")json={...flow(),errors:{base:"invalid_auth"}};
  else{added=true;json={type:"create_entry",title:"TV do quarto",flow_id:"found",handler:"samsungtv"}}
 }else if(url==="/app/pair-cancel")json={ok:true};
 if(json!==undefined)return route.fulfill({json});
 const file=url==="/"?"portal.html":url.slice(1);
 if(!["portal.html","portal.css","portal.mjs","copy.mjs","keyboard.mjs","devices.mjs","brand-3fx.png"].includes(file))return route.fulfill({status:404,body:""});
 return route.fulfill({body:await readFile(path.join(root,file)),contentType:file.endsWith(".png")?"image/png":file.endsWith(".mjs")?"text/javascript":file.endsWith(".css")?"text/css":"text/html"});
});
try{
 await page.goto("http://nexus.test/");
 await page.locator("#boot-splash").waitFor({state:"visible"});
 const transform=await page.locator(".boot-motion i").evaluate(el=>getComputedStyle(el).transform);
 await page.waitForTimeout(350);
 assert.notEqual(await page.locator(".boot-motion i").evaluate(el=>getComputedStyle(el).transform),transform);
 await page.screenshot({path:path.join(evidence,"01-animated-start.png")});
 await page.locator("#boot-splash").waitFor({state:"detached"});
 await page.getByRole("heading",{name:"Casa Nexus",exact:true}).waitFor();
 assert.equal(await page.locator("#keyboard-button").count(),0);
 assert.ok(await page.locator("footer img").evaluate(el=>el.complete&&el.naturalWidth>0));
 const tv=page.locator("article").filter({has:page.getByRole("heading",{name:"TV da sala",exact:true})});
 const slider=tv.getByRole("slider",{name:"Volume",exact:true});
 const box=await slider.boundingBox();
 await Promise.all([page.waitForResponse("**/app/snapshot"),page.touchscreen.tap(box.x+box.width*.6,box.y+box.height/2)]);
 assert.ok(commands.some(c=>c.service==="volume_set"&&c.value>.5&&c.value<.7));
 await tv.getByRole("button",{name:"Silenciar",exact:true}).tap();
 await tv.getByRole("button",{name:"Ativar som",exact:true}).waitFor();
 assert.equal(commands.at(-1).value,true);
 await tv.getByLabel("Entrada",{exact:true}).selectOption("TV");
 await tv.getByRole("button",{name:"Desligar",exact:true}).tap();
 await tv.getByRole("button",{name:"Ligar",exact:true}).waitFor();
 assert.equal(await slider.isEnabled(),false);
 await tv.getByRole("button",{name:"Ligar",exact:true}).tap();
 await tv.getByRole("button",{name:"Desligar",exact:true}).waitFor();
 assert.equal(await page.locator("article").filter({has:page.getByRole("heading",{name:"Player sem controles"})}).getByRole("slider").count(),0);
 await page.screenshot({path:path.join(evidence,"02-dashboard.png")});
 await page.getByRole("button",{name:"Dispositivos",exact:true}).tap();
 await page.getByRole("button",{name:"Adicionar dispositivo",exact:true}).tap();
 await page.getByRole("heading",{name:"TV do quarto",exact:true}).waitFor();
 await page.screenshot({path:path.join(evidence,"03-discovery.png")});
 await page.locator(".discovery-card").getByRole("button",{name:"Adicionar dispositivo",exact:true}).tap();
 await page.getByRole("dialog").getByRole("button",{name:"Adicionar dispositivo",exact:true}).tap();
 await page.getByLabel("PIN de pareamento",{exact:true}).fill("0000");
 await page.getByRole("dialog").getByRole("button",{name:"Avançar",exact:true}).tap();
 await page.getByRole("alert").waitFor();
 await page.getByLabel("PIN de pareamento",{exact:true}).fill("1234");
 await page.getByRole("dialog").getByRole("button",{name:"Avançar",exact:true}).tap();
 await page.getByRole("status").filter({hasText:"Dispositivo adicionado"}).waitFor();
 assert.equal(pairValues.at(-1).pin,"1234");
 assert.ok(!(await page.evaluate(()=>JSON.stringify(localStorage))).includes("1234"));
 await page.getByRole("dialog").getByRole("button",{name:"Fechar",exact:true}).tap();
 await page.getByRole("heading",{name:"Nenhum novo dispositivo ainda",exact:true}).waitFor();
 await page.getByRole("button",{name:"Escolha uma marca",exact:true}).tap();
 await page.getByRole("button",{name:"Roku",exact:true}).tap();
 await page.getByLabel("Endereço IP ou nome do dispositivo",{exact:true}).waitFor();
 await page.getByRole("dialog").getByRole("button",{name:"Fechar",exact:true}).tap();
 await page.getByRole("button",{name:"Voltar",exact:true}).tap();
 await page.setViewportSize({width:800,height:480});
 await page.screenshot({path:path.join(evidence,"04-tablet.png")});
 assert.ok(await page.locator("#app-viewport").evaluate(el=>el.scrollHeight<=el.clientHeight+1),"Tablet dashboard must fit without scrolling");
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 admin=false;await page.reload();
 await page.locator("#boot-splash").waitFor({state:"detached"});
 await page.getByRole("button",{name:"Dispositivos",exact:true}).tap();
 assert.equal(await page.getByRole("button",{name:"Adicionar dispositivo",exact:true}).count(),0);
 assert.deepEqual(errors,[]);
 process.stdout.write("PASS: animated startup, local brand, touch volume, mute, power, source selection, feature gating, discovery, pairing retry, cancellation and admin visibility.\n");
}catch(error){await page.screenshot({path:path.join(evidence,"failure.png")});throw error}
finally{await browser.close()}


