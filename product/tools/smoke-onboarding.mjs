import assert from "node:assert/strict";
import {mkdir,readFile,chmod} from "node:fs/promises";
import {pathToFileURL} from "node:url";
const {chromium}=await import(pathToFileURL(process.env.NEXUS_PLAYWRIGHT));
const browser=await chromium.launch();
const resume=process.argv.includes("--resume");
const context=await browser.newContext({viewport:{width:1280,height:800},...(resume?{storageState:process.env.NEXUS_STATE_DIR+"/browser-test.json"}:{})});
const page=await context.newPage();
const password="Nexus-CI-"+crypto.randomUUID();
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
await mkdir("product/qa/onboarding",{recursive:true});
async function shot(name){
 assert.doesNotMatch(await page.locator("body").innerText(),/home assistant|home assist\b/i);
 await page.screenshot({path:"product/qa/onboarding/"+name+".png",fullPage:true,animations:"disabled"});
}
try {
 if(resume){
  await page.goto("http://127.0.0.1:8099");
  await page.getByRole("heading",{name:"Casa Nexus",exact:true}).waitFor({timeout:60000});
  await shot("09-restart");
  process.stdout.write("PASS: authenticated dashboard restored after core and portal restart.\n");
 }else{
 await page.goto("http://127.0.0.1:8099");
 await page.getByRole("button",{name:"Português",exact:true}).click();
 await shot("01-language");
 await page.getByRole("button",{name:"Avançar",exact:true}).click();
 await page.locator("#country").selectOption("BR");
 await page.locator('[name="time_zone"]').selectOption("America/Sao_Paulo");
 await shot("02-region");
 await page.getByRole("button",{name:"Avançar",exact:true}).click();
 await page.getByRole("button",{name:"Buscar redes",exact:true}).click();
 await page.waitForFunction(()=>document.querySelector("#networks option")?.value==="Nexus test Wi-Fi");
 await page.getByLabel("Nome da rede",{exact:true}).fill("Nexus test Wi-Fi");
 await page.getByLabel("Senha",{exact:true}).fill("incorrect-password");
 await page.getByRole("button",{name:"Conectar",exact:true}).click();
 await page.getByRole("status").filter({hasText:"Não foi possível conectar"}).waitFor();
 await shot("03-network-retry");
 await page.getByRole("button",{name:"Avançar",exact:true}).click();
 await page.getByLabel("Seu nome",{exact:true}).fill("Nexus owner");
 await page.getByLabel("Usuário",{exact:true}).fill("nexus_owner");
 await page.getByLabel("Senha",{exact:true}).fill(password);
 await page.getByLabel("Confirme a senha",{exact:true}).fill(password);
 await shot("04-account");
 await page.getByRole("button",{name:"Avançar",exact:true}).click();
 await page.getByLabel("Nome da casa",{exact:true}).fill("Casa Nexus");
 await shot("05-home");
 await page.getByRole("button",{name:"Concluir configuração",exact:true}).click();
 await page.getByRole("button",{name:"Abrir minha casa",exact:true}).waitFor({timeout:60000});
 await shot("06-complete");
 await page.getByRole("button",{name:"Abrir minha casa",exact:true}).click();
 await page.getByRole("heading",{name:"Casa Nexus",exact:true}).waitFor();
 await shot("07-dashboard");
 assert.doesNotMatch(await page.locator("#app").innerText(),/Backup Manager|backup manager/i);
 const result=await page.evaluate(async()=>{
  const token=(await(await fetch("/session")).json()).token;
  return (await(await fetch("/app/snapshot",{method:"POST",headers:{"Content-Type":"application/json","X-Nexus-Token":token},body:"{}"})).json());
 });
 assert.equal(result.config.country,"BR");assert.equal(result.config.time_zone,"America/Sao_Paulo");assert.equal(result.preferences.setup,true);
 assert.equal(result.preferences.language,"pt");
 assert.equal(await page.evaluate(()=>document.cookie.includes("nexus-session")),false);
 const stored=await page.evaluate(()=>JSON.stringify(localStorage));
 assert.ok(!stored.includes(password));assert.doesNotMatch(stored,/access_token|refresh_token/);
 await page.reload();await page.getByRole("heading",{name:"Casa Nexus",exact:true}).waitFor();
 await page.getByRole("button",{name:"Configurações",exact:true}).click();
 page.once("dialog",d=>d.accept());
 await page.getByRole("button",{name:"Sair da conta",exact:true}).click();
 await page.getByLabel("Usuário",{exact:true}).fill("nexus_owner");
 await page.getByLabel("Senha",{exact:true}).fill("wrong-password");
 await page.getByRole("button",{name:"Entrar",exact:true}).click();
 await page.getByRole("status").filter({hasText:"Confira suas credenciais"}).waitFor();
 await page.getByLabel("Senha",{exact:true}).fill(password);
 await page.getByRole("button",{name:"Entrar",exact:true}).click();
 await page.getByRole("heading",{name:"Casa Nexus",exact:true}).waitFor();
 await page.setViewportSize({width:800,height:480});
 await shot("08-touch-800x480");
 const server=JSON.parse(await readFile(process.env.NEXUS_STATE_DIR+"/session.json","utf8"));
 assert.ok(server.refresh);assert.ok(server.cookie);assert.ok(!JSON.stringify(server).includes(password));
 // A regular user must enter management, not be trapped in owner-only setup.
 const regular={...result,user:{...result.user,is_admin:false,is_owner:false},preferences:{language:"pt",setup:false}};
 await page.route("**/state",route=>route.fulfill({json:{ready:true,authenticated:true,new:false,...regular}}));
 await page.route("**/app/snapshot",route=>route.fulfill({json:regular}));
 await page.reload();
 await page.getByRole("heading",{name:"Casa Nexus",exact:true}).waitFor();
 await page.getByRole("button",{name:"Configurações",exact:true}).click();
 assert.equal(await page.getByRole("button",{name:"Casa e região",exact:true}).count(),0);
 await page.unroute("**/state");await page.unroute("**/app/snapshot");
 await context.storageState({path:process.env.NEXUS_STATE_DIR+"/browser-test.json"});
 await chmod(process.env.NEXUS_STATE_DIR+"/browser-test.json",0o600);
 assert.deepEqual(errors,[]);
 process.stdout.write("PASS: real owner creation, country/timezone, onboarding completion, native dashboard, reload, logout/login, failed login, Wi-Fi recovery and secret isolation.\n");
 }
}catch(error){
 await page.screenshot({path:"product/qa/onboarding/failure.png",fullPage:true});
 throw error;
}finally{await browser.close()}

