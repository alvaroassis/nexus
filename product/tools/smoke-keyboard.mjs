// Exercises actual touch input, selection, secure fields and viewport avoidance.
// Uses an isolated mock portal; never connects to a real home or network.
import assert from "node:assert/strict";
import {readFile,mkdir} from "node:fs/promises";
import {fileURLToPath,pathToFileURL} from "node:url";
import path from "node:path";
const {chromium}=await import(pathToFileURL(process.env.NEXUS_PLAYWRIGHT));
const root=fileURLToPath(new URL("../image/runtime/",import.meta.url));
const evidence=fileURLToPath(new URL("../qa/keyboard/",import.meta.url));
await mkdir(evidence,{recursive:true});
const browser=await chromium.launch(process.env.NEXUS_CHROME?{executablePath:process.env.NEXUS_CHROME}:{});
const page=await browser.newPage({viewport:{width:800,height:480},hasTouch:true,deviceScaleFactor:1});
const errors=[];page.on("pageerror",e=>errors.push(e.message));
const keyboard=page.locator("nexus-keyboard");
const key=name=>keyboard.getByRole("button",{name,exact:true});
async function soft(text){
 for(const char of text){
  if(char===" "){await key("Espaço").tap();continue}
  if(!await key(char).count()){
   if(/[áàâãäéèêëíìîïóòôõöúùûüçñ¿¡]/i.test(char)){if(!await key("Acentos").count())await key("Letras").tap();await key("Acentos").tap();if(char!==char.toLocaleLowerCase())await key("Maiúsculas").tap()}
   else if(/[A-Za-z]/.test(char)){if(await key("Letras").count())await key("Letras").tap();if(/[A-Z]/.test(char))await key("Maiúsculas").tap()}
   else {if(await key("Números e símbolos").count())await key("Números e símbolos").tap();if(!await key(char).count()&&await key("#+=").count())await key("#+=").tap()}
  }
  await key(char).tap();
 }
}
async function visibleField(locator){
 const field=await locator.boundingBox(),board=await keyboard.boundingBox();
 assert.ok(board&&field);
 assert.ok(field.y>=0,"Field must remain inside the visible viewport");
 assert.ok(field.y+field.height<=board.y+1,"Keyboard must not cover the active field");
 assert.ok(board.x>=0&&board.x+board.width<=page.viewportSize().width+1);
}
try{
 await page.route("http://nexus.test/**",async route=>{
  const name=new URL(route.request().url()).pathname;
  const fixtures={"/session":{token:"test-only"},"/state":{ready:true,new:true,authenticated:false},"/regions":{US:["America/New_York"],BR:["America/Sao_Paulo"]},"/network":{interfaces:[{interface:"eth0",type:"ethernet",connected:true},{interface:"wlan0",type:"wireless",connected:false}]},"/scan":{accesspoints:[{ssid:"Nexus test Wi-Fi",signal:90}]}};
  if(fixtures[name])return route.fulfill({json:fixtures[name]});
  const file=name==="/"?"portal.html":name.slice(1);
  if(!["portal.html","portal.css","portal.mjs","copy.mjs","keyboard.mjs","devices.mjs","brand-3fx.png"].includes(file))return route.fulfill({status:404,body:""});
  return route.fulfill({contentType:file.endsWith(".png")?"image/png":file.endsWith(".mjs")?"text/javascript":file.endsWith(".css")?"text/css":"text/html",body:await readFile(path.join(root,file))});
 });
 await page.goto("http://nexus.test/");
 await page.getByRole("button",{name:"Português",exact:true}).tap();
 await page.getByRole("button",{name:"Avançar",exact:true}).tap();
 await page.getByRole("button",{name:"Avançar",exact:true}).tap();
 await page.getByRole("button",{name:"Buscar redes",exact:true}).tap();
 await page.waitForFunction(()=>document.querySelector('#networks option')?.value==='Nexus test Wi-Fi');
 await page.getByLabel("Nome da rede",{exact:true}).tap();
 await soft("nexus");assert.equal(await page.getByLabel("Nome da rede",{exact:true}).inputValue(),"nexus");
 await key("Recolher teclado").tap();
 await page.getByRole("button",{name:"Avançar",exact:true}).tap();
 const name=page.getByLabel("Seu nome",{exact:true});
 await name.tap();
 await soft("Casa");
 assert.equal(await name.inputValue(),"Casa");
 await name.evaluate(el=>el.setSelectionRange(1,3));
 await soft("x");assert.equal(await name.inputValue(),"Cxa");
 await key("Apagar").tap();assert.equal(await name.inputValue(),"Ca");
 await name.evaluate(el=>{el.value="";el.setSelectionRange(0,0)});
 await soft("Álvaro");assert.equal(await name.inputValue(),"Álvaro");
 await visibleField(name);
 await key("Próximo").tap();
 const username=page.getByLabel("Usuário",{exact:true});
 await soft("nexus");
 assert.equal(await username.inputValue(),"nexus");
 await key("Próximo").tap();
 const password=page.getByLabel("Senha",{exact:true});
 await soft("nexus@2026+ok");
 assert.equal(await password.inputValue(),"nexus@2026+ok");
 assert.equal(await password.getAttribute("type"),"password");
 await visibleField(password);
 assert.ok(!(await keyboard.innerText()).includes("nexus@2026+ok"));
 assert.ok(!(await page.evaluate(()=>JSON.stringify(localStorage))).includes("nexus@2026+ok"));
 await page.screenshot({path:path.join(evidence,"tablet-800x480.png"),animations:"disabled"});
 await key("Recolher teclado").tap();
 assert.equal(await keyboard.isVisible(),false);
 await password.tap();
 await visibleField(password);
 await password.evaluate(el=>el.setSelectionRange(el.value.length,el.value.length));
 const extra='[]{}<>^~`|\\"';
 await soft(extra);assert.equal(await password.inputValue(),"nexus@2026+ok"+extra);
 await key("Próximo").tap();
 const confirmation=page.getByLabel("Confirme a senha",{exact:true});
 await soft("abc");
 assert.equal(await confirmation.inputValue(),"abc");
 await key("Concluído").tap();
 assert.equal(await keyboard.isVisible(),false);
 await name.tap();await name.evaluate(el=>{el.maxLength=3;el.value="";el.setSelectionRange(0,0)});
 await soft("abcd");assert.equal(await name.inputValue(),"abc");
 await page.setViewportSize({width:800,height:1280});
 await visibleField(name);
 await page.screenshot({path:path.join(evidence,"tablet-portrait.png"),animations:"disabled"});
 await key("Recolher teclado").tap();
 await page.setViewportSize({width:1280,height:800});
 await password.tap();await visibleField(password);
 await page.screenshot({path:path.join(evidence,"tablet-1280x800.png"),animations:"disabled"});
 await key("Recolher teclado").tap();
 await page.evaluate(()=>{
  const dialog=document.querySelector("#details");
  dialog.innerHTML='<div class="dialog-content"><h2>Volume</h2><form><label>Valor<input name="value" type="number" step=".05" min="0" max="1"></label></form></div>';
  dialog.showModal();
 });
 const number=page.getByLabel("Valor",{exact:true});
 await number.tap();
 await soft("0.5");assert.equal(await number.inputValue(),"0.5");
 await visibleField(number);
 await key("Recolher teclado").tap();
 await number.tap();await key("Apagar").tap();
 assert.equal(await number.inputValue(),"0");
 await soft("7");assert.equal(await number.inputValue(),"0.7");
 await page.setViewportSize({width:800,height:480});
 await visibleField(number);
 await page.screenshot({path:path.join(evidence,"tablet-dialog.png"),animations:"disabled"});
 await page.evaluate(()=>document.querySelector("#details").close());
 assert.equal(await keyboard.isVisible(),false);
 await page.evaluate(()=>document.documentElement.lang="es");
 await name.tap();await name.evaluate(el=>{el.removeAttribute("maxlength");el.value="";el.setSelectionRange(0,0)});
 await key("ñ").tap();assert.equal(await name.inputValue(),"ñ");
 await key("Ocultar teclado").tap();
 await page.evaluate(()=>document.documentElement.lang="en");
 await name.tap();await key("Space").tap();assert.equal(await name.inputValue(),"ñ ");
 await key("Hide keyboard").tap();
 await page.evaluate(()=>document.documentElement.lang="pt");
 await name.tap();
 await page.getByRole("button",{name:"Voltar",exact:true}).tap();
 assert.equal(await keyboard.isVisible(),false);
 assert.deepEqual(errors,[]);
 process.stdout.write("PASS: touch typing, caret editing, accents, symbols, passwords, max length, next/done, numeric dialog, dismissal and responsive viewport.\n");
}catch(error){
 await page.screenshot({path:path.join(evidence,"failure.png")});
 console.error(await page.evaluate(()=>({focus:document.activeElement?.outerHTML,keyboard:document.querySelector('nexus-keyboard')?.outerHTML,dialog:document.querySelector('#details')?.outerHTML})));
 throw error;
}finally{await browser.close()}

