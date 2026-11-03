(function(){
"use strict";
if(window.__mersaloDiagnosticsInstalled)return;window.__mersaloDiagnosticsInstalled=true;
const API="https://tareeq-al-layl-server.onrender.com",KEY="mersalo-diagnostics-queue-v2",MAX=40;
const state={queue:[],busy:false,lastAction:"فتح الصفحة"};
const clean=(v,n=700)=>String(v==null?"":v).replace(/Bearer\s+[^\s]+/gi,"Bearer [محجوب]").replace(/(token|password|authorization|secret|api[-_]?key)\s*[:=]\s*[^\s&,]+/gi,"$1=[محجوب]").slice(0,n);
try{state.queue=JSON.parse(localStorage.getItem(KEY)||"[]");if(!Array.isArray(state.queue))state.queue=[]}catch(_){state.queue=[]}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state.queue.slice(-MAX)))}catch(_){}}
window.mersaloDiagnostic=function(type,message,details){record(type,message,details||{})};
function authUser(){try{return window.firebase&&firebase.auth&&firebase.auth().currentUser}catch(_){return null}}
function record(type,message,details){
 const item={type:clean(type,40),message:clean(message||"حدث خطأ غير معروف"),page:clean(location.pathname,180),action:state.lastAction,details:details||{},at:new Date().toISOString()};
 state.queue.push(item);if(state.queue.length>MAX)state.queue.shift();persist();flush();
}
async function flush(){
 if(state.busy||!state.queue.length)return;const user=authUser();if(!user)return;
 state.busy=true;const batch=state.queue.slice(0,8);
 try{const token=await user.getIdToken();const r=await fetch(API+"/api/diagnostics/collect",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({events:batch}),keepalive:true});if(r.ok){state.queue.splice(0,batch.length);persist()}}
 catch(_){}finally{state.busy=false}
}
window.addEventListener("error",e=>{if(e.target&&e.target!==window){record("resource","تعذر تحميل مورد في الصفحة",{file:clean(e.target.src||e.target.href||e.target.tagName,180)});return}record("javascript",e.message||"JavaScript error",{file:clean(e.filename,180),line:Number(e.lineno)||0,column:Number(e.colno)||0,stack:clean(e.error&&e.error.stack,1200)})},true);
window.addEventListener("unhandledrejection",e=>record("promise",e.reason&&e.reason.message||e.reason||"Unhandled promise rejection",{stack:clean(e.reason&&e.reason.stack,1200)}));
document.addEventListener("click",e=>{const el=e.target&&e.target.closest&&e.target.closest("button,a,[role=button]");if(el)state.lastAction=clean(el.getAttribute("aria-label")||el.textContent||el.getAttribute("href")||"تفاعل",120)});
const originalFetch=window.fetch.bind(window);
window.fetch=async function(){
 const args=arguments,req=args[0],url=typeof req==="string"?req:req&&req.url||"",started=Date.now();let path="";try{path=new URL(url,location.href).pathname}catch(_){}
 try{const response=await originalFetch.apply(this,args);if(response.status>=400&&path!=="/api/diagnostics/collect"&&path!=="/api/admin/diagnostics")record("http","فشل طلب HTTP "+response.status,{endpoint:clean(path,180),status:response.status,durationMs:Date.now()-started});return response}
 catch(error){if(path!=="/api/diagnostics/collect"&&path!=="/api/admin/diagnostics")record("network",error&&error.message||"Network request failed",{endpoint:clean(path,180),durationMs:Date.now()-started});throw error}
};
function watchSocket(socket){
 if(!socket||socket.__mersaloDiagnosticsWatched)return;socket.__mersaloDiagnosticsWatched=true;
 socket.on("connect_error",e=>record("socket-connect",e&&e.message||"تعذر اتصال Socket.IO",{transport:socket.io&&socket.io.engine&&socket.io.engine.transport&&socket.io.engine.transport.name}));
 socket.on("disconnect",reason=>{if(reason==="io server disconnect"||reason==="transport close"||reason==="ping timeout")record("socket-disconnect","انقطع اتصال المحادثات: "+reason)});
}
const originalEmit=window.dispatchEvent; // retain native event behavior
function scanSockets(){try{if(window.socket)watchSocket(window.socket);if(window.chatSocket)watchSocket(window.chatSocket)}catch(_){}}
const originalOpen=window.WebSocket;
if(originalOpen){window.WebSocket=function(){const ws=new originalOpen(...arguments);ws.addEventListener("error",()=>record("websocket","فشل اتصال WebSocket"));return ws};window.WebSocket.prototype=originalOpen.prototype}
window.addEventListener("online",()=>{record("connectivity","عاد اتصال الإنترنت");flush()});
window.addEventListener("offline",()=>record("connectivity","انقطع اتصال الإنترنت"));
window.addEventListener("pageshow",flush);document.addEventListener("visibilitychange",()=>{if(!document.hidden)flush()});
setInterval(()=>{flush();scanSockets()},15000);
scanSockets();
})();