const copy = {
  en:{language:"Language",title:"Welcome to your new home.",intro:"Choose your language and connect to your home network.",network:"Your connection",refresh:"Check connection",adapter:"Wi-Fi adapter",scan:"Find networks",ssid:"Network name",auth:"Security",open:"Open network",password:"Wi-Fi password",join:"Connect",connected:"Connected",disconnected:"Not connected",noWifi:"No Wi-Fi adapter detected. Connect an Ethernet cable to your router.",waiting:"Starting Home Assistant. The first start can take several minutes.",ready:"Home Assistant is ready.",continue:"Continue to Nexus",account:"Next, create your owner account securely in Home Assistant. If you already have an account, sign in. Select Nexus in the sidebar after initial setup.",keyboard:"Use the on-screen keyboard for touch input. Connect a USB keyboard if your display does not expose touch input.",requested:"Connection requested. Check the connection status before continuing.",networkFailed:"Network operation failed. Check the password, Wi-Fi adapter, and connection, then try again.",invalidWifi:"Check the network name and password (8–63 characters for WPA).",busy:"Another network operation is in progress.",confirm:"Changing Wi-Fi may disconnect the device. Continue?"},
  pt:{language:"Idioma",title:"Bem-vindo à sua nova casa.",intro:"Escolha seu idioma e conecte-se à rede da casa.",network:"Sua conexão",refresh:"Verificar conexão",adapter:"Adaptador Wi-Fi",scan:"Buscar redes",ssid:"Nome da rede",auth:"Segurança",open:"Rede aberta",password:"Senha do Wi-Fi",join:"Conectar",connected:"Conectado",disconnected:"Desconectado",noWifi:"Nenhum adaptador Wi-Fi detectado. Conecte um cabo Ethernet ao roteador.",waiting:"Iniciando o Home Assistant. A primeira inicialização pode levar alguns minutos.",ready:"O Home Assistant está pronto.",continue:"Continuar para o Nexus",account:"A seguir, crie sua conta no Home Assistant com segurança. Se já tiver uma conta, entre. Selecione Nexus no menu lateral após a configuração inicial.",keyboard:"Use o teclado na tela para digitar por toque. Conecte um teclado USB se a tela não reconhecer o touch.",requested:"Conexão solicitada. Verifique o estado antes de continuar.",networkFailed:"Falha na operação de rede. Verifique a senha, o adaptador e a conexão e tente novamente.",invalidWifi:"Verifique o nome da rede e a senha (8–63 caracteres para WPA).",busy:"Outra operação de rede está em andamento.",confirm:"Alterar o Wi-Fi pode desconectar o dispositivo. Continuar?"},
  es:{language:"Idioma",title:"Bienvenido a tu nuevo hogar.",intro:"Elige tu idioma y conéctate a la red de tu hogar.",network:"Tu conexión",refresh:"Comprobar conexión",adapter:"Adaptador Wi-Fi",scan:"Buscar redes",ssid:"Nombre de la red",auth:"Seguridad",open:"Red abierta",password:"Contraseña de Wi-Fi",join:"Conectar",connected:"Conectado",disconnected:"Desconectado",noWifi:"No se detectó un adaptador Wi-Fi. Conecta un cable Ethernet al router.",waiting:"Iniciando Home Assistant. El primer inicio puede tardar varios minutos.",ready:"Home Assistant está listo.",continue:"Continuar a Nexus",account:"A continuación, crea tu cuenta de forma segura en Home Assistant. Si ya tienes una cuenta, inicia sesión. Selecciona Nexus en el menú lateral después de la configuración inicial.",keyboard:"Usa el teclado en pantalla para escribir. Conecta un teclado USB si la pantalla no reconoce la entrada táctil.",requested:"Conexión solicitada. Comprueba el estado antes de continuar.",networkFailed:"Falló la operación de red. Comprueba la contraseña, el adaptador y la conexión e inténtalo de nuevo.",invalidWifi:"Comprueba el nombre de red y la contraseña (8–63 caracteres para WPA).",busy:"Hay otra operación de red en curso.",confirm:"Cambiar el Wi-Fi puede desconectar el dispositivo. ¿Continuar?"}
};
const el=(id)=>document.getElementById(id);
let language="en", token="", info={interfaces:[]}, ready=false, opened=false;
try { opened=localStorage.getItem("nexus-initial-opened")==="true"; } catch {}
try { const saved=localStorage.getItem("nexus-language");if(copy[saved]) language=saved; } catch {}
const t=(key)=>copy[language][key]||copy[language].networkFailed;
function render(){
  document.documentElement.lang=language; el("language").value=language;
  for(const [id,key] of Object.entries({"language-label":"language",title:"title",intro:"intro","network-title":"network",refresh:"refresh","adapter-label":"adapter",scan:"scan","ssid-label":"ssid","auth-label":"auth","open-label":"open","password-label":"password",join:"join","keyboard-hint":"keyboard",continue:"continue","account-info":"account"})) el(id).textContent=t(key);
  el("ready").textContent=t(ready?"ready":"waiting");el("continue").hidden=!ready;
  el("continue").href=`http://127.0.0.1:8123/local/nexus/start.html?lang=${language}`;
  el("network-status").textContent=info.interfaces.map((item)=>`${item.interface} · ${t(item.connected?"connected":"disconnected")}`).join("\n");
  const wireless=info.interfaces.filter((item)=>item.type==="wireless");
  el("wifi").hidden=!wireless.length;
  if(!wireless.length) el("network-status").textContent+="\n"+t("noWifi");
  const old=el("adapter").value;
  el("adapter").replaceChildren(...wireless.map((item)=>new Option(item.interface,item.interface)));
  if(wireless.some(item=>item.interface===old)) el("adapter").value=old;
}
async function request(path,body){
  const response=await fetch(path,{method:body?"POST":"GET",headers:body?{"Content-Type":"application/json","X-Nexus-Token":token}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(35000)});
  const value=await response.json();if(!response.ok) throw new Error(value.error);return value;
}
async function status(){try{info=await request("/network");render();}catch(error){el("message").textContent=t(error.message);}}
el("language").addEventListener("change",()=>{language=el("language").value;try{localStorage.setItem("nexus-language",language);}catch{}render();});
el("refresh").addEventListener("click",status);
el("scan").addEventListener("click",async()=>{el("scan").disabled=true;try{const result=await request("/scan",{interface:el("adapter").value});el("networks").replaceChildren(...[...new Set(result.accesspoints.map(p=>p.ssid))].map(ssid=>new Option(ssid,ssid)));}catch(error){el("message").textContent=t(error.message);}finally{el("scan").disabled=false;}});
el("wifi").addEventListener("submit",async(event)=>{
  event.preventDefault();if(!confirm(t("confirm"))) return;
  const data=Object.fromEntries(new FormData(event.target));el("password").value="";el("join").disabled=true;
  try{await request("/join",data);el("message").textContent=t("requested");await status();}catch(error){el("message").textContent=t(error.message);}finally{data.password="";el("join").disabled=false;}
});
el("continue").addEventListener("click",()=>{try{localStorage.setItem("nexus-initial-opened","true");}catch{}});
async function checkReady(){try{ready=(await request("/ready")).ready;if(ready && opened && !new URLSearchParams(location.search).has("network")){location.replace("http://127.0.0.1:8123/nexus");return;}render();}catch{}if(!ready)setTimeout(checkReady,3000);}
render();
try{token=(await request("/session")).token;await status();}catch{el("message").textContent=t("networkFailed");}
void checkReady();
