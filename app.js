/* Libro a Dúo · app */
(function(){
'use strict';

/* ================= utilidades ================= */
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const nf=n=>new Intl.NumberFormat('es-AR').format(n);
const pct=(off,total)=>total>0?(clamp((off||0)/total*100,0,100)).toFixed(2).replace('.',',')+' %':'0,00 %';
const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const store={
  get(k){try{return localStorage.getItem(k)}catch(e){return null}},
  set(k,v){try{localStorage.setItem(k,v)}catch(e){}},
  del(k){try{localStorage.removeItem(k)}catch(e){}}
};
const rnd=()=>{try{const a=new Uint8Array(12);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('')}catch(e){return (Math.random().toString(16).slice(2)+Date.now().toString(16)).padEnd(24,'0')}};
const CH=400000, MAX_PARTS=30, MAX_AUDIO=4000000, MAX_REC=300, MAX_CHARS=4000000;
const NOTE_COLORS={yellow:'var(--pn-yellow)',pink:'var(--pn-pink)',mint:'var(--pn-mint)',sky:'var(--pn-sky)'};
const PALETTE=['#0e8a8f','#d6407f','#3b6fd0','#c9821c','#7d52d1','#2f9a5f'];
const WORDS=['luna','roble','nube','faro','trigo','brisa','cedro','lago','tinta','pluma','alba','ceiba','sauce','musgo','ribera','umbral'];
const I={
  back:'<path d="M15 5l-7 7 7 7"/>',next:'<path d="M9 5l7 7-7 7"/>',
  note:'<path d="M5 4h14v10l-5 6H5z"/><path d="M14 20v-6h5"/>',
  mic:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  play:'<path d="M8 5l11 7-11 7z"/>',pause:'<path d="M9 5v14M15 5v14"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',trash:'<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  up:'<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
  file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'
};
const ico=n=>'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+I[n]+'</svg>';
document.querySelectorAll('[data-ico]').forEach(e=>{e.outerHTML=ico(e.dataset.ico)});
function toast(msg,ms){const t=document.createElement('div');t.className='toast';t.textContent=msg;$('#toasts').appendChild(t);setTimeout(()=>t.remove(),ms||3800)}
function ago(ts){if(!ts)return '';const s=(Date.now()-ts)/1000;if(s<60)return 'recién';if(s<3600)return 'hace '+Math.round(s/60)+' min';if(s<86400)return 'hace '+Math.round(s/3600)+' h';return 'hace '+Math.round(s/86400)+' d'}
function mmss(s){s=Math.max(0,Math.round(s||0));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function hueOf(str){let h=0;for(let i=0;i<str.length;i++)h=(h*31+str.charCodeAt(i))>>>0;return h%360}
function b64enc(u8){let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s)}
function b64dec(b){const s=atob(b);const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u}
function blobToB64(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=()=>rej(r.error);r.readAsDataURL(blob)})}
async function gzip(str){
  if(!window.CompressionStream)return{u8:new TextEncoder().encode(str),gz:false};
  const st=new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));
  return{u8:new Uint8Array(await new Response(st).arrayBuffer()),gz:true};
}
async function gunzip(u8,isGz){
  if(!isGz)return new TextDecoder().decode(u8);
  if(!window.DecompressionStream)throw new Error('Este navegador no puede descomprimir el libro. Actualizalo o probá con otro.');
  return await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

/* ================= almacenamiento local de libros (IndexedDB) ================= */
const idb={
  _db:null,
  open(){
    if(this._db)return Promise.resolve(this._db);
    return new Promise((res,rej)=>{
      if(!window.indexedDB)return rej(new Error('sin indexedDB'));
      const r=indexedDB.open('libro-a-duo',1);
      r.onupgradeneeded=()=>r.result.createObjectStore('books');
      r.onsuccess=()=>{this._db=r.result;res(r.result)};
      r.onerror=()=>rej(r.error);
    });
  },
  async get(k){try{const db=await this.open();return await new Promise(res=>{const q=db.transaction('books').objectStore('books').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>res(undefined)})}catch(e){return undefined}},
  async set(k,v){try{const db=await this.open();await new Promise(res=>{const t=db.transaction('books','readwrite');t.objectStore('books').put(v,k);t.oncomplete=res;t.onerror=res;t.onabort=res})}catch(e){}},
  async del(k){try{const db=await this.open();await new Promise(res=>{const t=db.transaction('books','readwrite');t.objectStore('books').delete(k);t.oncomplete=res;t.onerror=res;t.onabort=res})}catch(e){}},
  async keys(){try{const db=await this.open();return await new Promise(res=>{const q=db.transaction('books').objectStore('books').getAllKeys();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>res([])})}catch(e){return[]}}
};

/* ================= estado ================= */
const CFG=window.LAD_CONFIG||{};
const S={
  sb:null,room:null,code:'',member:store.get('lad-member')||'',name:store.get('lad-name')||'',color:store.get('lad-color')||'',
  screen:'boot',online:true,books:[],booksLoaded:false,readersAll:[],presence:{},ch:null,chReady:false,
  cur:null,notes:[],notesIds:null,panel:false,panelMode:'page',confirmDel:null,confirmBook:null,sel:null,
  cmp:null,draft:null,rec:null,player:null,blobs:{},followUid:null,tab:'books',wish:[],wishLoaded:false,confirmWish:null,linkWish:null,srch:null,rtTries:0,lastRt:0,
  fs:+store.get('lad-fs')||(innerWidth<600?16:18),installEvt:null
};
if(!S.member){S.member='m'+rnd();store.set('lad-member',S.member)}
const isConfigured=()=>/^https:\/\/.+/.test(CFG.SUPABASE_URL||'')&&(CFG.SUPABASE_ANON_KEY||'').length>20&&!/PEGAR/.test(CFG.SUPABASE_URL+CFG.SUPABASE_ANON_KEY);

/* ================= conexión con Supabase ================= */
function mkSb(){
  const hd={'x-lad-member':S.member};if(S.tok)hd['x-lad-token']=S.tok;
  S.sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},realtime:{params:{eventsPerSecond:10}},global:{headers:hd}});
}
async function sha256hex(t){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return Array.from(new Uint8Array(d),b=>b.toString(16).padStart(2,'0')).join('')}
const hashTok=(code,pass)=>sha256hex('libro-a-duo:pw:v1:'+code+':'+pass);
const isKick=e=>e&&(e.code==='LAD01'||/expulsado/.test(e.message||''));
const isPass=e=>e&&(e.code==='LAD02'||/contrasena/.test(e.message||''));
/* ---- llevar la sesión a otro dispositivo ---- */
const b64u=u8=>btoa(String.fromCharCode(...u8)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64u=t=>Uint8Array.from(atob(t.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((t.length+3)%4)),c=>c.charCodeAt(0));
async function xferMake(){
  const own=store.get('lad-own:'+S.room)||'';
  const payload=JSON.stringify({v:1,code:S.code,member:S.member,name:S.name,color:S.color,tok:S.tok||'',own:own});
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:128},true,['encrypt']);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(payload)));
  const blob=new Uint8Array(12+ct.length);blob.set(iv);blob.set(ct,12);
  const kraw=new Uint8Array(await crypto.subtle.exportKey('raw',key));
  const id=b64u(crypto.getRandomValues(new Uint8Array(18)));
  await rpc('lad_xfer_put',{p_id:id,p_blob:b64u(blob)});
  return location.origin+location.pathname+'#t='+id+'.'+b64u(kraw);
}
async function xferOpen(id,k){
  const blob=await rpc('lad_xfer_take',{p_id:id});
  if(!blob)throw new Error('used');
  const raw=unb64u(blob);
  const key=await crypto.subtle.importKey('raw',unb64u(k),'AES-GCM',false,['decrypt']);
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:raw.slice(0,12)},key,raw.slice(12));
  return JSON.parse(new TextDecoder().decode(pt));
}
async function xferApply(p){
  if(!p||p.v!==1||!p.code||!p.member)throw new Error('bad');
  const room=await hashRoom(p.code);
  S.member=p.member;store.set('lad-member',p.member);
  if(p.name){S.name=p.name;store.set('lad-name',p.name)}
  if(p.color){S.color=p.color;store.set('lad-color',p.color)}
  if(p.tok)store.set('lad-tok:'+room,p.tok);else store.del('lad-tok:'+room);
  if(p.own)store.set('lad-own:'+room,p.own);
  store.set('lad-room',p.code.trim().toLowerCase().replace(/\s+/g,'-'));
  mkSb();
}
let qrP=null;
function loadQR(){
  if(window.qrcode)return Promise.resolve();
  return qrP||(qrP=new Promise((res,rej)=>{const sc=document.createElement('script');sc.src='https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';sc.onload=res;sc.onerror=()=>{qrP=null;rej(new Error('qr'))};document.head.appendChild(sc)}));
}
function renderXfer(link){
  const b=$('#rmXfer');if(!b)return;
  let h='<div style="border-top:1px solid var(--line);padding-top:14px;margin:6px 0 16px"><b style="display:block;margin-bottom:6px">Llevar mi sesión a otro dispositivo</b>';
  if(!link)h+='<p class="hint">Entrás desde otra PC o celular como la misma persona: mismo progreso, mismas notas y, si sos administrador, la administración.</p><button class="btn" data-act="xfer-go">Generar enlace y QR</button>';
  else h+='<p class="hint">Abrilo en el otro dispositivo (o escaneá el QR). Sirve <b>una sola vez</b> y vence en 10 minutos. Quien lo abra queda como vos: no lo compartas con nadie más.</p><div class="codebox"><span style="word-break:break-all;font-size:12px">'+esc(link)+'</span><button class="btn sm" data-act="xfer-copy" data-l="'+esc(link)+'">Copiar</button></div><div id="xferQr" style="margin-top:10px;text-align:center"></div>';
  b.innerHTML=h+'</div>';
  if(link)loadQR().then(()=>{try{const q=qrcode(0,'M');q.addData(link);q.make();$('#xferQr').innerHTML=q.createSvgTag({cellSize:4,margin:2,scalable:true});const sv=$('#xferQr svg');if(sv){sv.style.width='200px';sv.style.height='200px';sv.style.background='#fff'}}catch(e){}}).catch(()=>{});
}
async function getCountry(){
  try{const o=JSON.parse(store.get('lad-cc')||'null');if(o&&Date.now()-o.t<3*864e5)return o.v}catch(e){}
  try{const c=new AbortController();const to=setTimeout(()=>c.abort(),4000);
    const t=await (await fetch('https://www.cloudflare.com/cdn-cgi/trace',{signal:c.signal,cache:'no-store'})).text();clearTimeout(to);
    const m=t.match(/^loc=([A-Z]{2})$/m);if(m){store.set('lad-cc',JSON.stringify({v:m[1],t:Date.now()}));return m[1]}}catch(e){}
  return null;
}
function ownerSecret(){
  let o=store.get('lad-own:'+S.room);
  if(!o){const a=new Uint8Array(24);crypto.getRandomValues(a);o=Array.from(a,b=>b.toString(16).padStart(2,'0')).join('')}
  return o;
}
async function hashRoom(code){
  const norm=code.trim().toLowerCase().replace(/\s+/g,'-');
  if(!(window.crypto&&crypto.subtle))throw new Error('Este navegador necesita una conexión segura (https) para entrar a la sala.');
  const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('libro-a-duo:v1:'+norm));
  return Array.from(new Uint8Array(d),b=>b.toString(16).padStart(2,'0')).join('');
}
function netError(e){return e&&(e.name==='TypeError'||/fetch|network|Failed|Load failed/i.test(e.message||''))}
async function rpc(name,args){
  if(!S.sb)throw new Error('Sin conexión con el servidor.');
  let r;
  try{r=await S.sb.rpc(name,args)}
  catch(e){setOnline(false);throw e}
  if(r.error){
    const m=r.error.message||'';
    if(netError(r.error)||/fetch|network/i.test(m)){setOnline(false)}
    const er=new Error(r.error.message||'Error del servidor');er.code=r.error.code;er.status=r.status;
    if(!S.entering){if(isKick(er))handleKicked();else if(isPass(er))needPass()}
    throw er;
  }
  setOnline(true);
  return r.data;
}
function setOnline(v){
  if(S.online===v)return;S.online=v;
  const b=$('#netBanner');if(b)b.hidden=v;
  if(v&&S.screen!=='gate')tick();
}

/* ================= arranque ================= */
async function init(){
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();S.installEvt=e;if(S.screen==='lib')renderLib()});
  window.addEventListener('online',()=>{if(S.screen==='lib'||S.screen==='reader'){tick();if(!S.chReady)startRealtime()}});
  if('serviceWorker' in navigator&&location.protocol!=='file:'){navigator.serviceWorker.register('sw.js').catch(()=>{})}
  if(!isConfigured()){showGate('setup');return}
  if(!window.supabase||!window.supabase.createClient){showGate('nolib');return}
  mkSb();
  if(location.hash==='#admin'){S.adminMode=true;history.replaceState(null,'',location.pathname+location.search)}
  const tm=location.hash.match(/^#t=([\w-]{22,64})\.([\w-]{20,})$/);
  if(tm){
    history.replaceState(null,'',location.pathname+location.search);
    try{
      const p=await xferOpen(tm[1],tm[2]);
      if(S.name&&store.get('lad-room')&&!confirm('Este dispositivo ya tiene una sesión. ¿Reemplazarla por la tuya ('+(p.name||'sin nombre')+')?'))return showGate('join',store.get('lad-room')||'');
      await xferApply(p);
    }catch(e){showGate('join','',{msg:'El enlace ya se usó, venció o no es válido. Generá uno nuevo desde el otro dispositivo.'});return}
  }
  let inviteCode='';
  const m=location.hash.match(/^#s=(.+)$/);
  if(m){try{inviteCode=decodeURIComponent(m[1])}catch(e){}history.replaceState(null,'',location.pathname+location.search)}
  const saved=store.get('lad-room');
  if(inviteCode&&inviteCode!==saved){showGate('join',inviteCode);return}
  if(saved&&S.name){try{await enterRoom(saved);return}catch(e){}}
  showGate('join',saved||'');
}
function showGate(kind,prefill,opt){
  opt=opt||{};
  S.screen='gate';
  ['lib','rd'].forEach(id=>$('#'+id).hidden=true);
  const g=$('#gate');g.hidden=false;
  const brand='<div class="brand"><svg class="mark" viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="9" width="17" height="30" rx="2" fill="var(--paper)" stroke="var(--ink)" stroke-width="2"/><rect x="26" y="9" width="17" height="30" rx="2" fill="var(--paper)" stroke="var(--ink)" stroke-width="2"/><path d="M13 6v13l3-2.5 3 2.5V6z" fill="var(--accent)"/><path d="M32 6v13l3-2.5 3 2.5V6z" fill="#d6407f"/></svg><div><h1>Libro a Dúo</h1><p>Un libro, dos lectores, la misma página.</p></div></div>';
  if(kind==='setup'){
    g.innerHTML='<div class="scroll"><div class="wrap gate"><div class="card">'+brand+'<h2>Falta conectar la sala</h2><p class="sub">Esta app guarda los libros, las notas y la página de cada uno en tu proyecto de Supabase. Todavía no está configurado.</p><ol class="setup-steps"><li>Seguí la guía <code>LEEME.md</code> hasta el paso de la configuración.</li><li>Pegá la URL y la clave pública en el archivo <code>config.js</code>.</li><li>Subí el archivo y recargá esta página.</li></ol></div></div></div>';return;
  }
  if(kind==='nolib'){
    g.innerHTML='<div class="scroll"><div class="wrap gate"><div class="card">'+brand+'<h2>No se pudo cargar la app</h2><p class="sub">Faltan componentes que se descargan de internet la primera vez. Conectate y recargá la página. Después de eso ya queda guardada en el dispositivo.</p><button class="btn pri" onclick="location.reload()">Recargar</button></div></div></div>';return;
  }
  const code=prefill||'';
  const color=S.color||PALETTE[Math.floor(Math.random()*PALETTE.length)];
  g.innerHTML='<div class="scroll"><div class="wrap gate"><div class="card">'+brand+'<h2>Entrá a una sala</h2><p class="sub">Los dos escriben el mismo código y quedan en la misma biblioteca. Si todavía no tienen uno, creá uno nuevo y pasáselo a la otra persona.</p>'
   +'<label class="fld"><span>Código de sala</span><div class="code-row"><input id="gCode" value="'+esc(code)+'" autocapitalize="none" autocomplete="off" spellcheck="false" placeholder="luna-3849-roble"><button class="btn" data-act="gen-code" type="button">Crear uno</button></div></label>'
   +'<div id="gNew"></div><p class="hint">Cuanto más largo y raro, más privada queda la sala. Cualquiera que conozca el código puede entrar.</p>'
   +(opt.pass?'<label class="fld"><span>Contraseña de la sala</span><input id="gPass" type="password" autocomplete="off"></label>':'')
   +'<label class="fld"><span>Tu nombre</span><input id="gName" maxlength="24" autocomplete="off" value="'+esc(S.name)+'" placeholder="Cómo te ve la otra persona"></label>'
   +'<div class="colors" id="gColors" role="radiogroup" aria-label="Tu color">'+PALETTE.map(c=>'<label><input type="radio" name="gc" value="'+c+'"'+(c===color?' checked':'')+' aria-label="Color"><span style="--c:'+c+'"></span></label>').join('')+'</div>'
   +'<div class="err" id="gErr" hidden></div><button class="btn pri" data-act="enter-room" id="gGo" style="width:100%;justify-content:center">Entrar a la sala</button></div></div></div>';
  if(opt.msg){const er=$('#gErr');er.hidden=false;er.textContent=opt.msg}
  setTimeout(()=>{const i=opt.pass?$('#gPass'):(code?$('#gName'):$('#gCode'));if(i&&!i.value)i.focus()},50);
}
function pwChoiceHtml(){
  return '<div class="banner" style="margin:0 0 14px"><b style="display:block;margin-bottom:6px">¿Querés ponerle contraseña a la sala?</b><label style="display:block;margin:4px 0"><input type="radio" name="apw" value="no" checked> No, sin contraseña</label><label style="display:block;margin:4px 0"><input type="radio" name="apw" value="yes"> Sí, ponerle contraseña</label><input id="apwIn" type="password" autocomplete="off" placeholder="Contraseña" disabled style="width:100%;margin-top:6px;border:1px solid var(--line);background:var(--paper);color:var(--paper-ink);border-radius:10px;padding:10px 12px;font:inherit;font-size:16px"><span class="hint" style="display:block;margin-top:6px">Se la tenés que pasar a la otra persona junto con el código. Podés cambiarla o quitarla después.</span></div>';
}
function pwChoiceValue(){const y=document.querySelector('input[name=apw]:checked');if(!y||y.value!=='yes')return{ok:true,pass:''};const v=($('#apwIn').value||'').trim();return v.length<4?{ok:false}:{ok:true,pass:v}}
document.addEventListener('change',e=>{if(e.target.name==='apw'){const i=$('#apwIn');if(i){i.disabled=e.target.value!=='yes';if(!i.disabled)i.focus()}}});
document.addEventListener('input',e=>{if(e.target.id==='gCode'){const g=$('#gNew');if(g)g.innerHTML=''}});

/* ---- administración de la sala ---- */
function handleKicked(){
  if(!S.room)return;
  const rm=S.room;leaveRoom();store.del('lad-tok:'+rm);S.tok='';
  showGate('join','',{msg:'El administrador te quitó de la sala.'});
}
function needPass(){
  if(!S.room||S.entering)return;
  const code=S.code;stopPolling();stopRealtime();closeBook(true);S.room=null;S.tok='';
  $('#roomModal').hidden=true;
  showGate('join',code,{pass:true,msg:'Esta sala tiene contraseña. Escribila para entrar.'});
}
async function claimRoom(pass){
  const own=ownerSecret();const tok=pass?await hashTok(S.code,pass):'';
  await rpc('lad_room_claim',{p_room:S.room,p_owner:own,p_token:tok});
  store.set('lad-own:'+S.room,own);
  if(tok)store.set('lad-tok:'+S.room,tok);else store.del('lad-tok:'+S.room);
  S.tok=tok;mkSb();
}
function restartRt(){stopRealtime();startRealtime()}
let adm=null;
async function loadAdmin(){
  const box=$('#rmAdmin');if(!box)return;
  box.innerHTML='<p class="hint">Cargando…</p>';
  try{
    const info=await rpc('lad_room_info',{p_room:S.room});
    const own=store.get('lad-own:'+S.room);let members=null;
    if(info.claimed&&own){try{members=await rpc('lad_room_members',{p_room:S.room,p_owner:own})}catch(e){members=null}}
    adm={info:info,owner:!!members,members:members||[],claiming:false};
    renderAdmin();
  }catch(e){box.innerHTML=''}
}
function renderAdmin(){
  const box=$('#rmAdmin');if(!box||!adm)return;
  let h='<div style="border-top:1px solid var(--line);padding-top:14px;margin:6px 0 16px"><b style="display:block;margin-bottom:6px">Administración</b>';
  if(!adm.info.claimed){
    if(!S.adminMode)h+='<p class="hint">Esta sala no tiene administrador. Las salas nuevas, creadas con "Crear uno", lo tienen desde el principio.</p>';
    else h+=adm.claiming?pwChoiceHtml()+'<button class="btn pri" data-act="admin-claim-go">Confirmar</button> <button class="btn" data-act="admin-claim-no">Cancelar</button>'
      :'<p class="hint">Quien administra la sala puede quitar personas y ponerle contraseña. Hacelo solo si la sala es tuya.</p><button class="btn" data-act="admin-claim">Ser el administrador de esta sala</button>';
  }else if(adm.owner){
    h+='<p class="hint">Contraseña: '+(adm.info.protected?'<b>activada</b>':'sin contraseña')+'</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><input id="apwNew" type="password" autocomplete="off" placeholder="'+(adm.info.protected?'Nueva contraseña':'Contraseña')+'" style="flex:1;min-width:140px;border:1px solid var(--line);background:var(--paper);color:var(--paper-ink);border-radius:10px;padding:10px 12px;font:inherit;font-size:16px"><button class="btn" data-act="admin-setpass">'+(adm.info.protected?'Cambiar':'Poner')+'</button>'+(adm.info.protected?'<button class="btn" data-act="admin-rmpass">Quitar contraseña</button>':'')+'</div>';
    const others=adm.members.filter(m=>m.member!==S.member);
    h+='<p class="hint" style="margin-bottom:6px">Personas en la sala</p>';
    h+=others.length?others.map(m=>'<div style="display:flex;align-items:center;gap:8px;margin:4px 0"><span class="dot" style="width:10px;height:10px;border-radius:50%;background:'+esc(m.color||'#0e8a8f')+'"></span><span style="flex:1">'+esc(m.name||'Sin nombre')+'</span>'+(S.confirmKick===m.member?'<button class="btn sm danger" data-act="kick-yes" data-m="'+esc(m.member)+'">Sí, quitar</button><button class="btn sm" data-act="kick-no">No</button>':'<button class="btn sm" data-act="kick-ask" data-m="'+esc(m.member)+'">Quitar</button>')+'</div>').join(''):'<p class="hint">Todavía no entró nadie más.</p>';
    h+='<p class="hint" style="margin-top:8px">Quitar a alguien lo saca de la sala. Para que no pueda volver desde otro dispositivo, ponele contraseña a la sala.</p>';
  }else{
    h+='<p class="hint">Esta sala ya tiene administrador.</p>';
  }
  box.innerHTML=h+'</div>';
}
async function adminDo(fn,okMsg){
  try{await fn();if(okMsg)toast(okMsg)}catch(e){toast(e&&/administrador/.test(e.message||'')?'Solo el administrador puede hacer eso.':'No se pudo. Probá de nuevo.')}
  await loadAdmin();
}
async function setRoomPass(pass){
  const own=store.get('lad-own:'+S.room);const tok=pass?await hashTok(S.code,pass):'';
  await rpc('lad_room_set_pass',{p_room:S.room,p_owner:own,p_token:tok});
  if(tok)store.set('lad-tok:'+S.room,tok);else store.del('lad-tok:'+S.room);
  stopRealtime();S.tok=tok;mkSb();startRealtime();
}
function genCode(){
  const a=new Uint32Array(3);try{crypto.getRandomValues(a)}catch(e){a[0]=Math.random()*1e9;a[1]=Math.random()*1e9;a[2]=Math.random()*1e9}
  return WORDS[a[0]%WORDS.length]+'-'+String(1000+a[1]%9000)+'-'+WORDS[a[2]%WORDS.length];
}
async function enterRoom(code,pass,create){
  const norm=code.trim().toLowerCase().replace(/\s+/g,'-');
  if(norm.length<6)throw new Error('El código tiene que tener al menos 6 caracteres.');
  const room=await hashRoom(norm);
  S.room=room;S.code=norm;S.entering=true;
  try{
    S.tok=pass?await hashTok(norm,pass):(store.get('lad-tok:'+room)||'');
    mkSb();
    try{await rpc('lad_room_touch',{p_room:room,p_member:S.member,p_name:S.name,p_color:S.color||PALETTE[0]})}
    catch(e){
      if(isPass(e)){S.tok='';store.del('lad-tok:'+room);const er=new Error(pass?'Contraseña incorrecta.':'Esta sala tiene contraseña. Escribila para entrar.');er.needPass=true;throw er}
      if(isKick(e))throw new Error('El administrador te quitó de esta sala.');
      if(!netError(e))throw e;
    }
    if(create){try{await claimRoom(create.pass)}catch(e){}}
    if(pass)store.set('lad-tok:'+room,S.tok);
    rpc('lad_room_note_code',{p_room:room,p_code:norm}).catch(()=>{});
    getCountry().then(cc=>{if(cc&&S.room===room)rpc('lad_room_touch',{p_room:room,p_member:S.member,p_name:S.name,p_color:S.color||PALETTE[0],p_country:cc}).catch(()=>{})});
  }catch(e){S.room=null;S.code='';S.tok='';throw e}
  finally{S.entering=false}
  store.set('lad-room',norm);
  if(!S.color)S.color=PALETTE[0];
  S.books=[];S.booksLoaded=false;S.readersAll=[];S.presence={};
  $('#gate').hidden=true;
  startRealtime();
  S.screen='lib';showLib();
  route();
  try{await refreshBooks();await refreshReaders();await refreshWish()}catch(e){}
  startPolling();
}
function leaveRoom(){
  stopPolling();stopRealtime();closeBook(true);
  store.del('lad-room');S.room=null;S.code='';S.books=[];S.booksLoaded=false;
  $('#roomModal').hidden=true;
  history.replaceState(null,'',location.pathname);
  showGate('join','');
}

/* ================= tiempo real + sondeo ================= */
function startRealtime(){
  stopRealtime();
  try{
    const ch=S.sb.channel('lad:'+(S.tok||S.room).slice(0,40),{config:{presence:{key:S.member},broadcast:{self:false}}});
    ch.on('presence',{event:'sync'},()=>{
      const st=ch.presenceState();const out={};
      Object.keys(st).forEach(k=>{const arr=st[k];if(arr&&arr.length)out[k]=arr[arr.length-1]});
      S.lastRt=Date.now();S.presence=out;onOthersChanged();if(S.screen==='lib')renderLib();
    });
    ch.on('broadcast',{event:'changed'},msg=>{
      const p=(msg&&msg.payload)||{};
      S.lastRt=Date.now();
      if(p.what==='books'){refreshBooks().catch(()=>{});refreshReaders().catch(()=>{})}
      if(p.what==='wish')refreshWish().catch(()=>{});
      if(p.what==='notes'&&S.cur&&S.cur.id===p.book)refreshNotes().catch(()=>{});
    });
    ch.subscribe(status=>{
      if(status==='SUBSCRIBED'){S.chReady=true;S.rtTries=0;trackPresence();renderReaders();retickSoon()}
      else if(status==='CLOSED'||status==='CHANNEL_ERROR'||status==='TIMED_OUT'){S.chReady=false;renderReaders();scheduleReconnect(ch)}
    });
    S.ch=ch;
  }catch(e){S.ch=null}
}
let rcT=null;
function scheduleReconnect(ch){
  if(!S.room||S.ch!==ch)return;clearTimeout(rcT);
  const ms=Math.min(30000,2000*Math.pow(2,S.rtTries++));
  rcT=setTimeout(()=>{if(S.room&&!S.chReady)startRealtime()},ms);
}
function stopRealtime(){
  clearTimeout(rcT);S.chReady=false;S.presence={};
  if(S.ch&&S.sb){try{S.sb.removeChannel(S.ch)}catch(e){}}
  S.ch=null;
}
let presT=null;
function trackPresence(){
  if(!S.ch||!S.chReady)return;
  clearTimeout(presT);
  presT=setTimeout(()=>{
    const c=S.cur;
    try{S.ch.track({m:S.member,name:S.name,color:S.color,book:c&&c.ready?c.id:null,pos:c&&c.ready?c.myOff:0,t:Date.now()})}catch(e){}
  },250);
}
function broadcast(what,book){
  if(!S.ch||!S.chReady)return;
  try{S.ch.send({type:'broadcast',event:'changed',payload:{what:what,book:book||null}})}catch(e){}
}
let pollT=null;
function pollMs(){
  const live=S.chReady&&Date.now()-S.lastRt<45000;
  if(S.screen==='reader')return S.followUid?(live?4000:2500):(live?10000:4000);
  return live?15000:6000;
}
function startPolling(){stopPolling();const loop=()=>{pollT=setTimeout(async()=>{if(!document.hidden)await tick();loop()},pollMs())};loop()}
function stopPolling(){clearTimeout(pollT);pollT=null}
function retickSoon(){setTimeout(()=>{if(!document.hidden)tick()},400)}
let tickN=0,ticking=false;
async function tick(){
  if(!S.room||ticking)return;ticking=true;tickN++;
  try{
    if(S.screen==='reader'&&S.cur&&S.cur.ready){
      await refreshReaders();
      if(tickN%3===0||!S.chReady){await refreshNotes();await refreshBooks()}
    }else{await refreshBooks();await refreshReaders();await refreshWish()}
    if(S.chReady)trackPresence();
  }catch(e){}
  ticking=false;
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.room){tick();if(!S.chReady)startRealtime()}else flushSave()});

/* ================= biblioteca ================= */
async function refreshBooks(){
  const rows=await rpc('lad_list_books',{p_room:S.room});
  S.books=rows||[];S.booksLoaded=true;
  if(S.screen==='lib')renderLib();
  // limpia copias locales de libros que ya no existen
  idb.keys().then(keys=>{const ids=new Set(S.books.map(b=>b.id));keys.forEach(k=>{if(!ids.has(k))idb.del(k)})});
}
async function refreshReaders(){
  S.readersAll=(await rpc('lad_list_readers',{p_room:S.room}))||[];
  if(S.screen==='lib')renderLib();
  if(S.cur&&S.cur.ready)onOthersChanged();
}
function showLib(){
  S.screen='lib';$('#lib').hidden=false;$('#rd').hidden=true;
  const rb=$('#roomBtn');rb.style.setProperty('--c',S.color);
  rb.innerHTML='<span class="dot"></span><span><small>Sala</small><b>'+esc(S.name||'Vos')+'</b></span>';
  renderLib();
}
function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)}
function isStandalone(){return (window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true}
function renderLib(){
  if(S.screen!=='lib')return;
  const el=$('#libBody');
  let h='<div class="banner warn" id="netBanner" '+(S.online?'hidden':'')+'>Sin conexión con el servidor. Los libros que ya abriste se pueden leer; las notas y la página del otro se actualizan cuando vuelva internet.</div>';
  h+='<div class="seg" style="margin-bottom:18px"><button data-act="tab-lib" data-t="books" aria-pressed="'+(S.tab==='books')+'">Biblioteca</button><button data-act="tab-lib" data-t="list" aria-pressed="'+(S.tab==='list')+'">Lista de lectura'+(S.wish.filter(w=>w.status!=='done').length?' ('+S.wish.filter(w=>w.status!=='done').length+')':'')+'</button></div>';
  if(S.tab==='list'){h+=wishHtml();el.innerHTML=h;return}
  h+='<div class="drop" id="drop"><div><h2>Sumá un libro</h2><p>PDF, Word (.docx), TXT o Markdown. El texto se arma como un libro de páginas.</p></div><button class="btn pri" data-act="pick-book">'+ico('up')+'Elegir archivo</button></div>';
  if(!S.books.length){
    h+=S.booksLoaded?'<div class="empty"><h3>Todavía no hay libros</h3>Subí el primero y los dos lo leen desde acá, cada uno en su pantalla.</div>':'<div class="empty"><div class="spin"></div>Cargando la biblioteca…</div>';
  }else{
    h+='<p class="shelf-h">Biblioteca compartida</p><div class="shelf">'+S.books.map(bookCard).join('')+'</div>';
  }
  if(S.installEvt)h+='<p class="install"><button class="btn" data-act="install">Instalar como app</button></p>';
  else if(isIOS()&&!isStandalone())h+='<p class="install">Para instalarla en el iPhone: tocá Compartir y después "Agregar a inicio".</p>';
  el.innerHTML=h;
}
async function refreshWish(){
  S.wish=(await rpc('lad_wish_list',{p_room:S.room}))||[];S.wishLoaded=true;
  if(S.screen==='lib'&&S.tab==='list'){const a=document.activeElement;if(!(a&&a.id==='wishIn'))renderLib()}else if(S.screen==='lib')renderLib();
}
const WST={pending:'Pendiente',reading:'Leyendo',done:'Ya leído'};
function wishItem(w){
  const bk=w.book?S.books.find(b=>b.id===w.book):null;
  const who='Propuesto por '+esc(w.by_member===S.member?'vos':(w.by_name||'otra persona'));
  const dt=w.status==='done'&&w.done_at?' · Terminado el '+esc(new Date(w.done_at).toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric'})):'';
  const seg='<div class="seg">'+['pending','reading','done'].map(k=>'<button data-act="wish-st" data-id="'+w.id+'" data-st="'+k+'" aria-pressed="'+(w.status===k)+'">'+WST[k]+'</button>').join('')+'</div>';
  const file=w.book?(bk?'<button class="btn sm" data-act="open-book" data-id="'+bk.id+'">Abrir libro</button>':'<span class="hint">Libro adjunto</span>'):'<button class="btn sm" data-act="wish-attach" data-id="'+w.id+'">Adjuntar archivo</button>';
  const del=S.confirmWish===w.id?'<span style="font-size:13px">¿Quitar?</span><button class="btn sm danger" data-act="wish-del-yes" data-id="'+w.id+'">Quitar</button><button class="btn sm" data-act="wish-del-no">No</button>':'<button class="btn sm" data-act="wish-del" data-id="'+w.id+'">Quitar</button>';
  return '<div class="banner" style="margin-bottom:10px"><b style="display:block;font-size:15px">'+esc(w.title)+'</b><span style="font-size:13px">'+who+dt+'</span><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px">'+seg+file+del+'</div></div>';
}
function wishHtml(){
  let h='<form id="wishForm" data-act="none" style="display:flex;gap:8px;margin-bottom:22px"><input id="wishIn" maxlength="160" placeholder="Título de un libro para leer" autocomplete="off" style="flex:1;min-width:0;border:1px solid var(--line);background:var(--paper);color:var(--paper-ink);border-radius:10px;padding:10px 12px;font:inherit;font-size:16px"><button class="btn pri" type="submit">Agregar</button></form>';
  if(!S.wishLoaded)return h+'<div class="empty"><div class="spin"></div>Cargando la lista…</div>';
  const g=k=>S.wish.filter(w=>w.status===k);
  const sec=(t,arr)=>arr.length?'<p class="shelf-h">'+t+'</p>'+arr.map(wishItem).join(''):'';
  const act=g('reading').concat(g('pending'));
  if(!S.wish.length)h+='<div class="empty"><h3>La lista está vacía</h3>Sumen los libros que quieren leer. Pueden agregar el archivo más tarde.</div>';
  h+=sec('Leyendo',g('reading'))+sec('Pendientes',g('pending'));
  const done=g('done').sort((a,b)=>Date.parse(b.done_at||0)-Date.parse(a.done_at||0));
  if(done.length)h+='<div style="margin-top:28px">'+sec('Ya leídos',done)+'</div>';
  return h;
}
async function wishAct(fn){try{await fn();broadcast('wish');await refreshWish()}catch(e){toast('No se pudo actualizar la lista. Probá de nuevo.')}}
document.addEventListener('submit',e=>{
  if(e.target.id!=='wishForm')return;e.preventDefault();
  const i=$('#wishIn'),t=(i.value||'').trim();if(!t)return;i.value='';
  wishAct(()=>rpc('lad_wish_add',{p_room:S.room,p_title:t,p_member:S.member,p_name:S.name}));
});
function readersOf(bookId){
  const map={};
  S.readersAll.filter(r=>r.book===bookId).forEach(r=>{map[r.member]={uid:r.member,name:r.name,color:r.color,pos:r.pos,live:false}});
  Object.keys(S.presence).forEach(m=>{const p=S.presence[m];if(p&&p.book===bookId){const o=map[m]||{uid:m};map[m]=Object.assign(o,{name:p.name||o.name,color:p.color||o.color,pos:typeof p.pos==='number'?p.pos:(o.pos||0),live:true})}});
  return Object.keys(map).map(k=>map[k]);
}
function bookCard(b){
  const hue=hueOf(b.title||b.id);
  const rs=readersOf(b.id).sort((a,c)=>(c.live-a.live)||(a.uid===S.member?-1:1));
  const prog=rs.slice(0,3).map(r=>{const pc=pct(r.pos,b.total||b.chars);const pw=clamp(((r.pos||0)/(b.total||b.chars||1))*100,0,100).toFixed(2);
    return '<div class="pr" style="--c:'+esc(r.color||'#0e8a8f')+'"><i></i><div class="bar"><b style="width:'+pw+'%"></b></div><span>'+esc(r.uid===S.member?'Vos':r.name||'Otra persona')+' · '+pc+(r.live?' · <em class="live">ahora</em>':'')+'</span></div>'}).join('');
  const foot=S.confirmBook===b.id?'<div class="bk-foot"><span style="margin-right:auto;align-self:center;font-size:13px">¿Quitar para los dos?</span><button class="btn sm danger" data-act="book-del-yes" data-id="'+b.id+'">Quitar</button><button class="btn sm" data-act="book-del-no">No</button></div>'
    :'<div class="bk-foot"><button class="btn sm" data-act="book-del" data-id="'+b.id+'">Quitar</button></div>';
  return '<div class="bk"><button class="bk-open" data-act="open-book" data-id="'+b.id+'"><div class="cover" style="background:hsl('+hue+' 38% 30%)">'+esc((b.title||'').slice(0,48))+'</div><div class="bk-t"><b>'+esc(b.title||'Sin título')+'</b><span>≈ '+nf(Math.max(1,Math.round((b.chars||0)/1800)))+' páginas · '+nf(b.words||0)+' palabras</span><span>Subido por '+esc(b.by_member===S.member?'vos':(b.by_name||'otra persona'))+'</span></div></button>'+(prog?'<div class="bk-prog">'+prog+'</div>':'')+foot+'</div>';
}
async function deleteBook(id){
  S.confirmBook=null;renderLib();
  try{await rpc('lad_delete_book',{p_room:S.room,p_book:id});idb.del(id);toast('Libro quitado de la biblioteca.');broadcast('books');await refreshBooks()}
  catch(e){toast('No se pudo quitar el libro. Probá de nuevo.')}
}

/* ================= lectura de archivos ================= */
function prettyTitle(name){return name.replace(/\.[^.]+$/,'').replace(/[_]+/g,' ').replace(/\s+/g,' ').trim()||'Libro sin título'}
const TERM=/[.!?…:"”»)]$/;
function isHeadingText(t){
  if(t.length>70||/[.,;:]$/.test(t))return false;
  return /^(cap[ií]tulo|cap\.|parte|libro|pr[oó]logo|ep[ií]logo|introducci[oó]n|chapter|part|prologue|epilogue)\b/i.test(t)||/^\d{1,3}\.?$/.test(t)||/^[IVXLC]{1,7}\.?$/.test(t)||(t===t.toUpperCase()&&/[A-ZÁÉÍÓÚÑ]/.test(t)&&t.length<=50);
}
function parseTxt(buf){
  let txt;try{txt=new TextDecoder('utf-8',{fatal:true}).decode(buf)}catch(e){txt=new TextDecoder('windows-1252').decode(buf)}
  txt=txt.replace(/^﻿/,'').replace(/\r\n?/g,'\n');
  let parts=txt.split(/\n{2,}/);
  if(parts.length<=2&&txt.length>3000)parts=txt.split('\n');
  const blocks=[];
  for(let p of parts){
    p=p.trim();if(!p)continue;
    if(/^#{1,6}\s/.test(p)&&!p.includes('\n')){blocks.push(['h',p.replace(/^#{1,6}\s+/,'')]);continue}
    const t=p.split('\n').map(l=>l.trim()).filter(Boolean).join(' ').replace(/\s+/g,' ');
    if(!t)continue;
    blocks.push([isHeadingText(t)?'h':'p',t]);
  }
  return blocks;
}
async function parseDocx(buf){
  if(!window.mammoth)throw new Error('No se pudo cargar el lector de Word. Revisá la conexión y probá de nuevo.');
  const res=await mammoth.convertToHtml({arrayBuffer:buf});
  const doc=new DOMParser().parseFromString(res.value,'text/html');
  const blocks=[];
  const add=(k,t)=>{t=(t||'').replace(/\s+/g,' ').trim();if(t)blocks.push([k,t])};
  doc.body.childNodes.forEach(n=>{
    if(n.nodeType!==1)return;const tg=n.tagName.toLowerCase();
    if(/^h[1-6]$/.test(tg))add('h',n.textContent);
    else if(tg==='p')add('p',n.textContent);
    else if(tg==='ul'||tg==='ol')n.querySelectorAll('li').forEach(li=>add('p','• '+li.textContent));
    else if(tg==='table')n.querySelectorAll('tr').forEach(tr=>add('p',[...tr.children].map(c=>c.textContent.trim()).join(' | ')));
    else add('p',n.textContent);
  });
  return blocks;
}
/* Convierte las líneas sueltas de un PDF en párrafos y títulos. */
function pdfLinesToBlocks(lines,numPages){
  const total=lines.reduce((a,l)=>a+l.t.length,0);
  if(total<200)throw new Error('Este PDF parece ser un escaneo, sin texto seleccionable. Probá con otro archivo o con una versión en Word o TXT.');
  const norm=t=>t.replace(/\d+/g,'#').toLowerCase();
  const rep={};lines.forEach(l=>{if(l.first||l.last){const k=norm(l.t);rep[k]=(rep[k]||0)+1}});
  const minRep=Math.max(4,Math.round(numPages*0.3));
  const kept=lines.filter(l=>{
    if((l.first||l.last)&&/^\d{1,4}$/.test(l.t))return false;
    if((l.first||l.last)&&rep[norm(l.t)]>=minRep)return false;
    return true;
  });
  const hs=kept.map(l=>l.h).filter(Boolean).sort((a,b)=>a-b);const medH=hs.length?hs[Math.floor(hs.length/2)]:10;
  const gaps=[];for(let i=1;i<kept.length;i++){if(kept[i].p===kept[i-1].p){const g=kept[i-1].y-kept[i].y;if(g>0)gaps.push(g)}}
  gaps.sort((a,b)=>a-b);const medG=gaps.length?gaps[Math.floor(gaps.length/2)]:12;
  const blocks=[];let para='',prev=null,prevShort=false;
  const flush=()=>{if(para.trim())blocks.push(['p',para.trim().replace(/\s+/g,' ')]);para=''};
  kept.forEach(l=>{
    const head=l.h>=medH*1.25&&l.t.length<=90;
    if(head){
      flush();
      const last=blocks[blocks.length-1];
      if(last&&last[0]==='h'&&prev&&prev.head&&prev.p===l.p)last[1]+=' '+l.t;else blocks.push(['h',l.t]);
      prev={p:l.p,y:l.y,head:true};return;
    }
    let newPara=false;
    if(prev&&!prev.head){
      if(prev.p===l.p){const g=prev.y-l.y;if(g>medG*1.45)newPara=true}
      else if(TERM.test(para.trim())&&para.trim().length<2000&&/^[A-ZÁÉÍÓÚÑ¿¡"“«—-]/.test(l.t)&&prevShort)newPara=true;
    }else if(prev&&prev.head)newPara=true;
    if(newPara)flush();
    if(para&&/[A-Za-zÁÉÍÓÚáéíóúñ]-$/.test(para)&&/^[a-záéíóúñ]/.test(l.t))para=para.slice(0,-1)+l.t;
    else para+=(para?' ':'')+l.t;
    prevShort=l.t.length<45;
    prev={p:l.p,y:l.y,head:false};
  });
  flush();
  return blocks;
}
async function parsePdf(buf,onProg){
  if(!window.pdfjsLib)throw new Error('No se pudo cargar el lector de PDF. Revisá la conexión y probá de nuevo.');
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf=await pdfjsLib.getDocument({data:buf}).promise;
  const lines=[];
  for(let p=1;p<=pdf.numPages;p++){
    const pg=await pdf.getPage(p);const tc=await pg.getTextContent();
    let cur='',y=null,h=0;const pl=[];
    tc.items.forEach(it=>{
      if(it.str===undefined)return;
      const iy=it.transform?it.transform[5]:0;
      if(y!==null&&Math.abs(iy-y)>2&&cur.trim()){pl.push({t:cur.trim(),y:y,h:h,p:p});cur='';h=0}
      cur+=it.str;
      if(it.hasEOL&&cur.trim()){pl.push({t:cur.trim(),y:iy,h:Math.max(h,it.height||0),p:p});cur='';h=0;y=null;return}
      y=iy;h=Math.max(h,it.height||0);
    });
    if(cur.trim())pl.push({t:cur.trim(),y:y,h:h,p:p});
    if(pl.length){pl[0].first=true;pl[pl.length-1].last=true}
    lines.push(...pl);
    if(onProg)onProg(p/pdf.numPages);
  }
  return pdfLinesToBlocks(lines,pdf.numPages);
}
async function parseFile(file,onProg){
  const ext=(file.name.split('.').pop()||'').toLowerCase();
  if(ext==='doc')throw new Error('Los archivos .doc antiguos no se pueden leer acá. Abrilo en Word y guardalo como .docx o como texto (.txt).');
  const buf=await file.arrayBuffer();
  let blocks;
  if(ext==='pdf'||file.type==='application/pdf')blocks=await parsePdf(buf,onProg);
  else if(ext==='docx')blocks=await parseDocx(buf);
  else if(['txt','md','markdown',''].includes(ext)||(file.type||'').startsWith('text/'))blocks=parseTxt(buf);
  else throw new Error('Ese formato no está soportado. Usá PDF, .docx, .txt o .md.');
  const chars=blocks.reduce((a,b)=>a+b[1].length,0);
  if(chars<200)throw new Error('Casi no encontré texto en ese archivo. Revisá que no sea un escaneo o un archivo vacío.');
  if(chars>MAX_CHARS)throw new Error('El libro es demasiado largo ('+nf(chars)+' caracteres). El máximo es '+nf(MAX_CHARS)+'. Probá con una parte.');
  return blocks;
}

/* ================= subir libro ================= */
let upBlocks=null,upName='';
function openUpload(file){
  upBlocks=null;$('#upModal').hidden=false;
  $('#upSub').textContent=file?file.name:'Elegí un archivo PDF, Word (.docx) o de texto.';
  if(!file){$('#upBody').innerHTML='<div class="foot"><button class="btn" data-act="up-close">Cancelar</button><button class="btn pri" data-act="pick-book">'+ico('file')+'Elegir archivo</button></div>';return}
  $('#upBody').innerHTML='<div class="prog"><i id="upBar"></i></div><p class="hint" id="upMsg">Leyendo el archivo…</p><div class="foot"><button class="btn" data-act="up-close">Cancelar</button></div>';
  upName=S.linkWish?((S.wish.find(w=>w.id===S.linkWish)||{}).title||prettyTitle(file.name)):prettyTitle(file.name);
  parseFile(file,f=>{const b=$('#upBar');if(b)b.style.width=Math.round(f*100)+'%'}).then(blocks=>{
    if($('#upModal').hidden)return;
    upBlocks=blocks;
    const chars=blocks.reduce((a,b)=>a+b[1].length,0),words=blocks.reduce((a,b)=>a+b[1].split(/\s+/).length,0);
    upBlocks.chars=chars;upBlocks.words=words;
    $('#upBody').innerHTML='<label class="fld"><span>Título</span><input id="upTitle" maxlength="120" value="'+esc(upName)+'"></label><p class="hint">'+nf(blocks.length)+' párrafos · '+nf(words)+' palabras · ≈ '+nf(Math.max(1,Math.round(chars/1800)))+' páginas. Lo van a ver las personas que estén en tu sala.</p><div class="err" id="upErr" hidden></div><div class="prog" id="upProg" hidden><i id="upBar2"></i></div><div class="foot"><button class="btn" data-act="up-close">Cancelar</button><button class="btn pri" data-act="up-save" id="upSave">Compartir libro</button></div>';
    $('#upTitle').focus();
  }).catch(e=>{
    $('#upBody').innerHTML='<div class="err">'+esc(e.message||'No se pudo leer el archivo.')+'</div><div class="foot"><button class="btn" data-act="up-close">Cerrar</button><button class="btn pri" data-act="pick-book">Elegir otro</button></div>';
  });
}
async function saveBook(){
  const title=($('#upTitle').value||'').trim()||upName;
  const btn=$('#upSave');btn.disabled=true;$('#upProg').hidden=false;$('#upErr').hidden=true;
  let bookId=null;
  try{
    const json=JSON.stringify(upBlocks);
    const g=await gzip(json);
    const b=b64enc(g.u8);const n=Math.ceil(b.length/CH);
    if(n>MAX_PARTS)throw new Error('El libro es demasiado largo para compartirlo. Probá con una parte del libro.');
    bookId=await rpc('lad_add_book',{p_room:S.room,p_title:title,p_chars:upBlocks.chars,p_words:upBlocks.words,p_total:buildFlow(upBlocks).total,p_gz:g.gz,p_n_chunks:n,p_member:S.member,p_name:S.name});
    for(let i=0;i<n;i++){
      await rpc('lad_add_chunk',{p_room:S.room,p_book:bookId,p_idx:i,p_data:b.slice(i*CH,(i+1)*CH)});
      $('#upBar2').style.width=Math.round((i+1)/(n+1)*100)+'%';
    }
    await rpc('lad_finish_book',{p_room:S.room,p_book:bookId});
    if(S.linkWish){try{await rpc('lad_wish_link',{p_room:S.room,p_id:S.linkWish,p_book:bookId});broadcast('wish')}catch(e){}S.linkWish=null;refreshWish().catch(()=>{})}
    idb.set(bookId,json);
    $('#upBar2').style.width='100%';
    $('#upModal').hidden=true;upBlocks=null;
    toast('Libro compartido. Ya pueden abrirlo los dos.');
    broadcast('books');await refreshBooks();
  }catch(e){
    if(bookId){rpc('lad_delete_book',{p_room:S.room,p_book:bookId}).catch(()=>{})}
    btn.disabled=false;$('#upProg').hidden=true;const er=$('#upErr');er.hidden=false;
    er.textContent=netError(e)?'Se cortó la conexión mientras se subía. Probá de nuevo.':((e&&e.message)||'No se pudo guardar el libro.');
  }
}

/* ================= ruta ================= */
function route(){
  if(!S.room)return;
  const h=location.hash.replace(/^#/,'');
  if(h.indexOf('libro-')===0)openBook(h.slice(6));else closeBook();
}
window.addEventListener('hashchange',()=>{if(location.hash==='#admin'){S.adminMode=true;history.replaceState(null,'',location.pathname+location.search);return}route()});

/* ================= libro: carga ================= */
function splitSentences(t){
  const out=[];let i=0,n=t.length,start=0;
  while(i<n){
    if('.!?…'.indexOf(t[i])>=0){
      let j=i+1;while(j<n&&'.!?…'.indexOf(t[j])>=0)j++;
      while(j<n&&'"”»’\')]'.indexOf(t[j])>=0)j++;
      while(j<n&&t[j]===' ')j++;
      out.push(t.slice(start,j));start=j;i=j;
    }else i++;
  }
  if(start<n)out.push(t.slice(start));
  const res=[];
  out.forEach(s=>{
    while(s.length>420){let c=s.lastIndexOf(' ',300);if(c<120)c=s.indexOf(' ',300);if(c<0)break;res.push(s.slice(0,c+1));s=s.slice(c+1)}
    if(s)res.push(s);
  });
  return res;
}
function buildFlow(blocks){
  let g=0;const html=[],offs=[];
  blocks.forEach(b=>{
    const tag=b[0]==='h'?'h2':'p';let h='<'+tag+'>';
    splitSentences(b[1]).forEach(s=>{offs.push(g);h+='<span class="s" data-i="'+(offs.length-1)+'">'+esc(s)+'</span>';g+=s.length});
    html.push(h+'</'+tag+'>');g+=1;
  });
  return{html:html.join(''),offs:offs,total:g};
}
const bookCache={};
async function loadBookData(meta){
  if(bookCache[meta.id])return bookCache[meta.id];
  let json=await idb.get(meta.id);
  if(typeof json!=='string'){
    const rows=await rpc('lad_get_chunks',{p_room:S.room,p_book:meta.id});
    if(!rows||rows.length<(meta.n_chunks||1))throw new Error('El libro todavía se está subiendo. Probá de nuevo en un momento.');
    const b=rows.map(r=>r.data).join('');
    json=await gunzip(b64dec(b),meta.gz);
    idb.set(meta.id,json);
  }
  const data=buildFlow(JSON.parse(json));
  bookCache[meta.id]=data;return data;
}
function showLoad(html){const l=$('#rdLoad');l.hidden=false;l.innerHTML='<div>'+html+'</div>'}
function localPos(id){try{return JSON.parse(store.get('lad-pos:'+id)||'null')}catch(e){return null}}
async function openBook(id){
  if(S.cur&&S.cur.id===id)return;
  closeBook(true);
  S.screen='reader';$('#lib').hidden=true;$('#rd').hidden=false;
  showLoad('<div class="spin"></div><b>Abriendo el libro</b><span>Un momento…</span>');
  $('#rdTitle').textContent='';$('#rdSub').textContent='';
  const cur=S.cur={id:id,meta:null,ready:false,myOff:0,spread:0,N:1,P:1,nSp:1,D:null};
  try{
    let meta=S.books.find(b=>b.id===id);
    if(!meta){
      try{await refreshBooks()}catch(e){}
      meta=S.books.find(b=>b.id===id);
    }
    if(!meta){
      if(S.cur!==cur)return;
      const cached=await idb.get(id);
      if(typeof cached==='string'){meta={id:id,title:'Libro guardado',chars:0,n_chunks:1,gz:false}}
      else{showLoad('<b>Ese libro no está disponible</b><span>Puede que lo hayan quitado, o que no haya conexión.</span><br><br><button class="btn" data-act="back">Volver a la biblioteca</button>');return}
    }
    if(S.cur!==cur)return;
    cur.meta=meta;$('#rdTitle').textContent=meta.title||'Libro';
    $('#rdSub').textContent='≈ '+nf(Math.max(1,Math.round((meta.chars||0)/1800)))+' páginas';
    const data=await loadBookData(meta);if(S.cur!==cur)return;
    const mine=S.readersAll.find(r=>r.book===id&&r.member===S.member);
    const lp=localPos(id);
    let off=0;
    if(mine&&lp)off=(lp.ts>Date.parse(mine.updated_at))?lp.pos:mine.pos;else if(mine)off=mine.pos;else if(lp)off=lp.pos;
    cur.data=data;cur.myOff=clamp(off||0,0,data.total);
    $('#flow').innerHTML=data.html;cur.spans=Array.from($('#flow').querySelectorAll('.s'));
    cur.ready=true;$('#rdLoad').hidden=true;
    paginate();
    refreshNotes().catch(()=>{});refreshReaders().catch(()=>{});
    trackPresence();
  }catch(e){
    if(S.cur!==cur)return;
    showLoad('<b>No se pudo abrir el libro</b><span>'+esc(netError(e)?'No hay conexión y este libro todavía no está guardado en el dispositivo.':(e.message||'Error de conexión.'))+'</span><br><br><button class="btn" data-act="back">Volver a la biblioteca</button>');
  }
}
function closeBook(keepView){
  const c=S.cur;
  if(c){flushSave();}
  stopPlayer();S.cur=null;S.notes=[];S.notesIds=null;S.sel=null;S.followUid=null;S.confirmDel=null;closeSearch();
  if(c)trackPresence();
  if(S.cmp)closeComposer();
  if(!keepView&&S.room){$('#rd').hidden=true;S.screen='lib';showLib()}
}

/* ================= paginación ================= */
function layoutDims(){
  const st=$('#stage');const sw=st.clientWidth,sh=st.clientHeight;
  const N=sw>=860?2:1;
  const availW=sw-(N===2?64:48),availH=sh-34;
  let pw=Math.floor(Math.min(availW/N,availH*0.74,560));pw=Math.max(pw,230);
  let ph=Math.floor(Math.min(availH,pw/0.6));ph=Math.max(ph,300);
  const padX=Math.round(Math.max(20,Math.min(pw*0.1,46)));
  const padT=Math.round(ph*0.09),padB=Math.round(ph*0.085);
  return{N:N,pw:pw,ph:ph,padX:padX,padT:padT,padB:padB,W:pw-2*padX,H:ph-padT-padB};
}
function paginate(){
  const c=S.cur;if(!c||!c.ready)return;
  const st=$('#stage');if(st.clientWidth<60||st.clientHeight<60)return;
  const D=layoutDims();c.D=D;c.N=D.N;
  const book=$('#book'),flow=$('#flow'),slider=$('#slider');
  book.style.width=(D.N*D.pw)+'px';book.style.height=D.ph+'px';book.classList.toggle('two',D.N===2);
  flow.style.cssText='left:'+D.padX+'px;top:'+D.padT+'px;width:'+D.W+'px;height:'+D.H+'px;column-width:'+D.W+'px;column-gap:'+(2*D.padX)+'px;font-size:'+S.fs+'px;';
  slider.style.transition='none';slider.style.transform='none';
  const fr=flow.getBoundingClientRect();
  const n=c.spans.length;const pages=new Int32Array(n);let max=0,last=0;
  for(let i=0;i<n;i++){
    const r=c.spans[i].getClientRects()[0];
    let p=last;if(r)p=Math.max(0,Math.floor((r.left-fr.left+1)/D.pw));
    if(p<last)p=last;pages[i]=p;last=p;if(p>max)max=p;
  }
  c.pages=pages;c.P=max+1;c.nSp=Math.ceil(c.P/D.N);
  $('#scrub').max=Math.max(0,c.nSp-1);
  void slider.offsetWidth;
  showSpread(Math.floor(pageOfOff(c.myOff)/D.N),false);
}
function spanIdx(off){
  const o=S.cur.data.offs;let lo=0,hi=o.length-1,r=0;
  while(lo<=hi){const m=(lo+hi)>>1;if(o[m]<=off){r=m;lo=m+1}else hi=m-1}
  return r;
}
function pageOfOff(off){const c=S.cur;return c.pages[spanIdx(off)]||0}
function offOfPage(p){
  const c=S.cur,pg=c.pages;let lo=0,hi=pg.length-1,r=pg.length-1;
  while(lo<=hi){const m=(lo+hi)>>1;if(pg[m]>=p){r=m;hi=m-1}else lo=m+1}
  return c.data.offs[r]||0;
}
function showSpread(s,anim){
  const c=S.cur;if(!c||!c.ready||!c.D)return;
  s=clamp(s,0,c.nSp-1);c.spread=s;
  const sl=$('#slider');
  sl.style.transition=(anim&&!reduce)?'':'none';
  sl.style.transform='translateX('+(-s*c.N*c.D.pw)+'px)';
  hidePop();paintAll();
}
function paintAll(){paintDeco();decorateSpans();paintChrome();renderReaders();if(S.panel)renderNotes();$('#notesCnt').textContent=S.notes.length}
function spreadPages(){const c=S.cur;const a=c.spread*c.N;return{a:a,b:Math.min(c.P-1,a+c.N-1)}}
function pgText(){const c=S.cur,p=spreadPages();return(p.a===p.b?'pág. '+(p.a+1):'págs. '+(p.a+1)+'–'+(p.b+1))+' de '+c.P}
function paintChrome(){
  const c=S.cur;$('#scrub').value=c.spread;$('#pgLbl').textContent=pgText()+' · '+pct(c.myOff,c.data.total);
  $('#prevBtn').disabled=c.spread<=0;$('#nextBtn').disabled=c.spread>=c.nSp-1;
  const pos=off=>c.P>1?clamp(pageOfOff(off)/(c.P-1),0,1)*100:0;
  $('#marks').innerHTML=getOthers().map(o=>'<i style="left:'+pos(o.off)+'%;--c:'+esc(o.color||'#0e8a8f')+'"></i>').join('');
}
function paintDeco(){
  const c=S.cur;if(!c||!c.D)return;const D=c.D,sp=spreadPages();
  let h='';const title=esc(c.meta?c.meta.title||'':'');
  for(let k=0;k<D.N;k++){
    const pg=sp.a+k;if(pg>c.P-1)break;
    h+='<div class="rh" style="left:'+(k*D.pw+D.padX)+'px;width:'+D.W+'px;top:'+Math.round(D.padT*0.42)+'px">'+title+'</div>';
    h+='<div class="pn" style="left:'+(k*D.pw)+'px;width:'+D.pw+'px;top:'+(D.ph-Math.round(D.padB*0.72))+'px">'+(pg+1)+'</div>';
  }
  getOthers().forEach((o,idx)=>{
    const pg=pageOfOff(o.off);if(pg<sp.a||pg>sp.b)return;
    h+='<div class="rib" title="'+esc(o.name||'Otra persona')+' está acá" style="left:'+((pg-sp.a)*D.pw+D.pw*0.74+idx*20)+'px;--c:'+esc(o.color||'#0e8a8f')+'"></div>';
  });
  const br=$('#book').getBoundingClientRect();const lastY={};
  S.notes.forEach(n=>{
    const i=spanIdx(n.pos);if(!c.spans[i])return;const pg=c.pages[i];if(pg<sp.a||pg>sp.b)return;
    const r=c.spans[i].getClientRects()[0];if(!r)return;
    const side=D.N===2&&(pg-sp.a)===0?'l':'r';
    let y=clamp(Math.round(r.top-br.top-2),10,D.ph-34);
    while(lastY[side]&&Math.abs(lastY[side]-y)<24&&y<D.ph-34)y+=24;lastY[side]=y;
    h+='<button class="tab '+side+'" data-act="tab" data-id="'+n.id+'" aria-label="Nota de '+esc(n.name||'otra persona')+'" style="top:'+y+'px;--pnc:'+(NOTE_COLORS[n.color]||NOTE_COLORS.yellow)+';--ac:'+esc(n.mcolor||'#0e8a8f')+'"><i></i></button>';
  });
  const deco=$('#deco'),pop=deco.querySelector('.pop');
  deco.innerHTML=h;
  if(pop)deco.appendChild(pop);  // el menú de la frase elegida no se pierde al refrescar
}
function decorateSpans(){
  const c=S.cur;if(!c.spans)return;
  (c.deco||[]).forEach(el=>{el.classList.remove('has');el.style.removeProperty('--nc')});
  c.deco=[];
  S.notes.forEach(n=>{const el=c.spans[spanIdx(n.pos)];if(el&&!el.classList.contains('has')){el.classList.add('has');el.style.setProperty('--nc',n.mcolor||'#0e8a8f');c.deco.push(el)}});
  c.spans.forEach(e=>e.classList.remove('sel'));
  if(S.sel&&c.spans[S.sel.i])c.spans[S.sel.i].classList.add('sel');
}

/* ================= navegación y sincronía ================= */
function stopFollow(){if(S.followUid)setFollow(null)}
function setFollow(uid){S.followUid=uid||null;renderReaders();startPolling()}
function navigateTo(s,follow,exact){
  const c=S.cur;if(!c||!c.ready)return;
  s=clamp(s,0,c.nSp-1);
  if(!follow)stopFollow();
  S.sel=null;
  c.myOff=(follow&&typeof exact==='number')?exact:offOfPage(s*c.N);
  if(s!==c.spread||!follow)showSpread(s,true);else paintAll();
  store.set('lad-pos:'+c.id,JSON.stringify({pos:c.myOff,ts:Date.now()}));
  trackPresence();scheduleSave();
}
function goToOff(off,follow){const c=S.cur;navigateTo(Math.floor(pageOfOff(off)/c.N),follow)}
let saveT=null,saving=false,dirty=false;
function scheduleSave(){dirty=true;clearTimeout(saveT);saveT=setTimeout(doSave,1200)}
function flushSave(){if(dirty){clearTimeout(saveT);saveT=null;doSave()}}
async function doSave(){
  saveT=null;const c=S.cur;if(!c||!c.ready||!S.room||saving||!dirty)return;
  saving=true;const off=c.myOff;
  try{
    await rpc('lad_set_progress',{p_room:S.room,p_book:c.id,p_member:S.member,p_name:S.name,p_color:S.color,p_pos:off});
    if(c.myOff===off)dirty=false;
  }catch(e){}
  saving=false;
  if(dirty&&S.cur===c)scheduleSave();
}
function getOthers(){
  const c=S.cur;if(!c)return[];
  return readersOf(c.id).filter(r=>r.uid!==S.member).map(r=>({uid:r.uid,name:r.name,color:r.color,off:r.pos||0,live:r.live}))
    .sort((a,b)=>(b.live-a.live));
}
function renderReaders(){
  const c=S.cur;if(!c||!c.ready)return;
  const others=getOthers();
  const sp=spreadPages();
  let h='<div class="rchip" style="--c:'+esc(S.color)+'"><span class="dot"></span><b>Vos</b><span class="pg">'+(sp.a===sp.b?'pág. '+(sp.a+1):'págs. '+(sp.a+1)+'–'+(sp.b+1))+' · '+pct(c.myOff,c.data.total)+'</span></div>';
  if(!others.length)h+='<span class="alone" style="align-self:center">Todavía no hay otra persona en este libro. Pasale el código de sala y que abra el mismo libro.</span>';
  others.forEach(o=>{
    const pg=pageOfOff(o.off)+1;const f=S.followUid===o.uid;
    h+='<div class="rchip" style="--c:'+esc(o.color||'#0e8a8f')+'"><span class="dot"></span><b>'+esc(o.name||'Otra persona')+'</b><span class="pg">pág. '+pg+' · '+pct(o.off,c.data.total)+'</span>'+(o.live?'<em class="live">leyendo ahora</em>':'<span class="pg xtra">última vez</span>')+'<button class="btn" data-act="goto-uid" data-uid="'+esc(o.uid)+'">Ir ahí</button><button class="btn" data-act="follow" data-uid="'+esc(o.uid)+'" aria-pressed="'+f+'">'+(f?'Siguiendo':'Seguir')+'</button></div>';
  });
  h+='<span class="pg xtra" style="align-self:center;margin-left:auto;font-size:12px;color:var(--muted)" title="'+(S.chReady?'Conexión en vivo activa':'Sin conexión en vivo: se actualiza cada pocos segundos')+'">'+(S.chReady?'En vivo':'Con demora')+'</span>';
  $('#readers').innerHTML=h;
}
function onOthersChanged(){
  const c=S.cur;if(!c||!c.ready)return;
  if(S.followUid){
    const t=getOthers().find(o=>o.uid===S.followUid);
    if(t){const target=Math.floor(pageOfOff(t.off)/c.N);if(target!==c.spread||t.off!==c.myOff)navigateTo(target,true,t.off)}
    else setFollow(null);
  }
  paintChrome();paintDeco();renderReaders();
}

/* ================= buscar en el libro ================= */
const hlOK=!!(window.CSS&&CSS.highlights&&window.Highlight);
function normCh(ch){const n=ch.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return n.length?n[0]:ch}
function normStr(q){return q.split('').map(normCh).join('')}
function buildHay(c){
  if(c.hay)return c.hay;
  const starts=new Int32Array(c.spans.length);let parts=[],n=0;
  c.spans.forEach((sp,i)=>{starts[i]=n;const t=sp.textContent;n+=t.length;parts.push(t.split('').map(normCh).join(''))});
  c.hay={text:parts.join(''),starts:starts};return c.hay;
}
function openSearch(){
  const c=S.cur;if(!c||!c.ready)return;
  const b=$('#srch');b.hidden=false;const i=$('#srchIn');i.focus();i.select();
  if(i.value)runSearch(i.value,false);
}
function closeSearch(){
  const b=$('#srch');if(b)b.hidden=true;
  if(hlOK){CSS.highlights.delete('lad-hit');CSS.highlights.delete('lad-cur')}
  document.querySelectorAll('.s.hitc').forEach(e=>e.classList.remove('hitc'));
  S.srch=null;const k=$('#srchCnt');if(k)k.textContent='';
}
function spanOfPos(h,pos){let lo=0,hi=h.starts.length-1,r=0;while(lo<=hi){const m=(lo+hi)>>1;if(h.starts[m]<=pos){r=m;lo=m+1}else hi=m-1}return r}
function rangeFor(c,h,a,z){
  const i=spanOfPos(h,a),j=spanOfPos(h,Math.max(a,z-1));
  const n1=c.spans[i].firstChild,n2=c.spans[j].firstChild;if(!n1||!n2)return null;
  const r=document.createRange();
  r.setStart(n1,a-h.starts[i]);r.setEnd(n2,Math.min(z-h.starts[j],n2.length));return r;
}
function runSearch(q,jump){
  const c=S.cur;if(!c||!c.ready)return;
  const nq=normStr(q.trim());
  if(hlOK){CSS.highlights.delete('lad-hit');CSS.highlights.delete('lad-cur')}
  document.querySelectorAll('.s.hitc').forEach(e=>e.classList.remove('hitc'));
  if(nq.length<2){S.srch=null;$('#srchCnt').textContent=q.trim()?'Escribí 2 letras o más':'';return}
  const h=buildHay(c),hits=[];let k=0;
  while((k=h.text.indexOf(nq,k))>=0&&hits.length<5000){hits.push([k,k+nq.length]);k+=nq.length}
  S.srch={q:q,hits:hits,cur:-1,len:nq.length};
  if(!hits.length){$('#srchCnt').textContent='0 resultados';return}
  if(hlOK){const rs=hits.map(x=>rangeFor(c,h,x[0],x[1])).filter(Boolean);CSS.highlights.set('lad-hit',new Highlight(...rs))}
  // arranca en la primera coincidencia desde donde estás leyendo
  const here=c.spread*c.N;let start=hits.findIndex(x=>c.pages[spanOfPos(h,x[0])]>=here);if(start<0)start=0;
  showHit(start,jump!==false);
}
function showHit(i,go){
  const c=S.cur,s=S.srch;if(!s||!s.hits.length)return;
  const h=buildHay(c);s.cur=(i+s.hits.length)%s.hits.length;
  const x=s.hits[s.cur],si=spanOfPos(h,x[0]);
  $('#srchCnt').textContent=(s.cur+1)+' de '+s.hits.length+(s.hits.length>=5000?'+':'');
  document.querySelectorAll('.s.hitc').forEach(e=>e.classList.remove('hitc'));
  if(hlOK){const r=rangeFor(c,h,x[0],x[1]);if(r)CSS.highlights.set('lad-cur',new Highlight(r))}else c.spans[si].classList.add('hitc');
  if(go)goToOff(c.data.offs[si]);
}
function searchStep(d){if(S.srch&&S.srch.hits.length)showHit(S.srch.cur+d,true)}
$('#srchIn').addEventListener('input',e=>runSearch(e.target.value));
$('#srchIn').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchStep(e.shiftKey?-1:1)}else if(e.key==='Escape'){e.stopPropagation();closeSearch()}});

/* ================= notas ================= */
async function refreshNotes(){
  const c=S.cur;if(!c||!c.ready)return;
  const rows=(await rpc('lad_list_notes',{p_room:S.room,p_book:c.id}))||[];
  if(S.cur!==c)return;
  const prev=S.notesIds;S.notes=rows;
  const ids=new Set(rows.map(n=>n.id));
  if(prev){rows.forEach(n=>{if(!prev.has(n.id)&&n.member!==S.member)toast((n.name||'La otra persona')+' dejó una nota en la pág. '+(pageOfOff(n.pos)+1)+(n.aud_mime?' (con voz).':'.'))})}
  S.notesIds=ids;paintAll();
}
function hidePop(){const p=$('#deco').querySelector('.pop');if(p)p.remove()}
function selectSpan(i){
  const c=S.cur;S.sel={i:i,off:c.data.offs[i]};
  c.spans.forEach(e=>e.classList.remove('sel'));c.spans[i].classList.add('sel');
  hidePop();
  const br=$('#book').getBoundingClientRect(),r=c.spans[i].getClientRects()[0];if(!r)return;
  const pop=document.createElement('div');pop.className='pop';
  pop.innerHTML='<button class="btn" data-act="pop-note">'+ico('note')+'Nota</button><button class="btn" data-act="pop-voice">'+ico('mic')+'Voz</button>';
  const left=clamp(r.left-br.left,6,br.width-176);let top=r.bottom-br.top+6;
  if(top>br.height-60)top=r.top-br.top-50;
  pop.style.left=left+'px';pop.style.top=top+'px';$('#deco').appendChild(pop);
}
function openComposer(voice){
  const c=S.cur;if(!c)return;
  const i=S.sel?S.sel.i:spanIdx(offOfPage(c.spread*c.N));
  S.cmp={i:i,off:c.data.offs[i],q:c.spans[i].textContent.trim().slice(0,160),book:c.id};
  S.draft=null;
  $('#cmpSub').textContent='Pág. '+(c.pages[i]+1)+' · la nota queda pegada a esta frase';
  $('#cmpQ').textContent='“'+S.cmp.q+'”';$('#cmpText').value='';
  $('#cmpColors').innerHTML=Object.keys(NOTE_COLORS).map((k,n)=>'<label><input type="radio" name="pc" value="'+k+'"'+(n===0?' checked':'')+' aria-label="Postit '+k+'"><span style="--pnc:'+NOTE_COLORS[k]+'"></span></label>').join('');
  setCmpErr('');$('#cmpProg').hidden=true;$('#cmpSave').disabled=true;
  renderAudioRow();$('#cmpModal').hidden=false;
  if(voice)setTimeout(()=>startRec(),50);else $('#cmpText').focus();
}
function cmpValid(){$('#cmpSave').disabled=!($('#cmpText').value.trim()||S.draft)||!!S.rec}
function renderAudioRow(){
  const el=$('#cmpAudio');
  if(S.rec){el.innerHTML='<span class="rec" id="recT">● Grabando 0:00</span><button class="btn sm" data-act="rec-stop">'+ico('stop')+'Terminar</button>';return}
  if(S.draft){el.innerHTML='<audio controls src="'+S.draft.url+'"></audio><span class="hint" style="margin:0">'+mmss(S.draft.dur)+' · '+(S.draft.blob.size<1048576?Math.round(S.draft.blob.size/1024)+' KB':(S.draft.blob.size/1048576).toFixed(1)+' MB')+'</span><button class="btn sm danger" data-act="aud-clear">'+ico('trash')+'Quitar audio</button>';return}
  el.innerHTML='<button class="btn sm" data-act="rec-start">'+ico('mic')+'Grabar voz</button><button class="btn sm" data-act="aud-pick">'+ico('up')+'Elegir audio</button>';
}
function setCmpErr(m){const e=$('#cmpErr');e.hidden=!m;e.textContent=m||''}
async function startRec(){
  setCmpErr('');
  try{
    if(!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&window.MediaRecorder))throw new Error('sin micrófono');
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const types=['audio/webm;codecs=opus','audio/mp4','audio/webm'];
    const mt=types.find(t=>MediaRecorder.isTypeSupported(t))||'';
    const mr=new MediaRecorder(stream,Object.assign({audioBitsPerSecond:32000},mt?{mimeType:mt}:{}));
    const parts=[];const t0=Date.now();
    mr.ondataavailable=e=>{if(e.data&&e.data.size)parts.push(e.data)};
    mr.onstop=()=>{
      if(S.rec)clearInterval(S.rec.tick);stream.getTracks().forEach(t=>t.stop());
      const dur=(Date.now()-t0)/1000;const blob=new Blob(parts,{type:mr.mimeType||mt||'audio/webm'});S.rec=null;
      if(!S.cmp)return;
      setDraft(blob,dur);
    };
    S.rec={mr:mr,tick:setInterval(()=>{
      const s=(Date.now()-t0)/1000;const e=$('#recT');if(e)e.textContent='● Grabando '+mmss(s);
      if(s>=MAX_REC)mr.stop();
    },500)};
    mr.start();renderAudioRow();cmpValid();
  }catch(e){
    S.rec=null;renderAudioRow();
    const denied=e&&(e.name==='NotAllowedError'||e.name==='SecurityError');
    setCmpErr(denied?'El navegador no tiene permiso para usar el micrófono. Habilitalo en los permisos del sitio, o tocá "Elegir audio" para usar una nota de voz que ya tengas.':'No se pudo usar el micrófono en este dispositivo. Tocá "Elegir audio" para subir una nota de voz.');
  }
}
function setDraft(blob,dur){
  if(blob.size>MAX_AUDIO){setCmpErr('El audio pesa '+(blob.size/1048576).toFixed(1)+' MB y el máximo es 4 MB. Grabalo más corto.');S.draft=null;renderAudioRow();cmpValid();return}
  if(S.draft)URL.revokeObjectURL(S.draft.url);
  S.draft={blob:blob,mime:(blob.type||'audio/mpeg').split(';')[0],dur:dur||0,url:URL.createObjectURL(blob)};
  setCmpErr('');renderAudioRow();cmpValid();
}
async function saveNote(){
  const cm=S.cmp;if(!cm)return;
  const btn=$('#cmpSave');btn.disabled=true;setCmpErr('');
  const text=$('#cmpText').value.trim();
  const color=(document.querySelector('#cmpColors input:checked')||{}).value||'yellow';
  try{
    let b64=null,mime=null,dur=null;
    if(S.draft){$('#cmpProg').hidden=false;$('#cmpProg>i').style.width='40%';b64=await blobToB64(S.draft.blob);mime=S.draft.mime;dur=Math.round(S.draft.dur||0)}
    await rpc('lad_add_note',{p_room:S.room,p_book:cm.book,p_pos:cm.off,p_quote:cm.q,p_body:text,p_color:color,p_member:S.member,p_name:S.name,p_mcolor:S.color,p_aud_b64:b64,p_aud_mime:mime,p_aud_dur:dur});
    const pg=S.cur?S.cur.pages[cm.i]+1:'';
    closeComposer();toast('Nota pegada en la pág. '+pg+'.');
    S.sel=null;broadcast('notes',cm.book);await refreshNotes();
  }catch(e){
    btn.disabled=false;$('#cmpProg').hidden=true;
    setCmpErr(netError(e)?'No hay conexión. Probá de nuevo cuando vuelva internet.':(e.code==='54000'?e.message:'No se pudo guardar la nota. Probá de nuevo.'));
  }
}
function closeComposer(){
  if(S.rec){try{S.rec.mr.onstop=null;S.rec.mr.stop();S.rec.mr.stream&&S.rec.mr.stream.getTracks().forEach(t=>t.stop())}catch(e){}clearInterval(S.rec.tick);S.rec=null}
  if(S.draft){URL.revokeObjectURL(S.draft.url);S.draft=null}
  S.cmp=null;$('#cmpModal').hidden=true;
}
async function deleteNote(id){
  S.confirmDel=null;
  try{await rpc('lad_delete_note',{p_room:S.room,p_note:id,p_member:S.member});delete S.blobs[id];broadcast('notes',S.cur&&S.cur.id);await refreshNotes()}
  catch(e){toast('No se pudo borrar la nota.')}
}
function renderNotes(){
  const c=S.cur;if(!c||!c.ready||!S.panel)return;
  const sp=spreadPages();
  const list=S.notes.filter(n=>{if(S.panelMode==='all')return true;const p=pageOfOff(n.pos);return p>=sp.a&&p<=sp.b});
  const el=$('#notesList');
  if(!list.length){
    el.innerHTML='<div class="side-empty">'+(S.panelMode==='all'?'Todavía no hay notas en este libro.':'No hay notas en '+(sp.a===sp.b?'esta página':'estas páginas')+'.')+' Tocá una frase del libro y elegí Nota o Voz para dejar la primera.</div>';return;
  }
  el.innerHTML=list.map((n,k)=>{
    const mine=n.member===S.member;const pg=pageOfOff(n.pos)+1;
    const a=n.aud_mime?'<div class="aplay" data-note="'+n.id+'"><button data-act="play" data-note="'+n.id+'" aria-label="Escuchar nota de voz">'+ico('play')+'</button><div class="tr"><i></i></div><span>'+mmss(n.aud_dur)+'</span></div>':'';
    const del=mine?(S.confirmDel===n.id?'<button data-act="del-yes" data-note="'+n.id+'">Sí, borrar</button><button data-act="del-no">No</button>':'<button data-act="del" data-note="'+n.id+'">Borrar</button>'):'';
    return '<article class="note" id="nt-'+n.id+'" style="--pnc:'+(NOTE_COLORS[n.color]||NOTE_COLORS.yellow)+';--ac:'+esc(n.mcolor||'#0e8a8f')+';--r:'+(k%2?0.7:-0.8)+'deg"><header><i class="dot"></i><b>'+esc(mine?'Vos':n.name||'Otra persona')+'</b><span>pág. '+pg+' · '+ago(Date.parse(n.created_at))+'</span></header><blockquote>“'+esc(n.quote||'')+'”</blockquote>'+(n.body?'<p>'+esc(n.body)+'</p>':'')+a+'<footer>'+del+'<button data-act="goto" data-off="'+n.pos+'">Ir a la página</button></footer></article>';
  }).join('');
  renderPlayerState();
}
function togglePanel(open){
  S.panel=open===undefined?!S.panel:open;
  $('#side').hidden=!S.panel;$('#notesBtn').setAttribute('aria-pressed',S.panel);
  if(S.panel)renderNotes();
  setTimeout(paginate,30);
}

/* ================= audio de notas ================= */
async function playNote(id){
  const n=S.notes.find(x=>x.id===id);if(!n||!n.aud_mime)return;
  if(S.player&&S.player.id===id){
    if(S.player.audio){if(S.player.audio.paused)S.player.audio.play().catch(()=>{});else S.player.audio.pause()}
    return;
  }
  stopPlayer();
  S.player={id:id,audio:null,loading:true};renderPlayerState();
  try{
    let url=S.blobs[id];
    if(!url){
      const rows=await rpc('lad_get_audio',{p_room:S.room,p_note:id});
      if(!rows||!rows.length)throw new Error('sin audio');
      url=S.blobs[id]=URL.createObjectURL(new Blob([b64dec(rows[0].b64)],{type:rows[0].mime||n.aud_mime}));
    }
    if(!S.player||S.player.id!==id)return;
    const au=new Audio(url);S.player.audio=au;S.player.loading=false;
    au.addEventListener('timeupdate',renderPlayerState);au.addEventListener('ended',stopPlayer);
    au.addEventListener('pause',renderPlayerState);au.addEventListener('play',renderPlayerState);
    await au.play();
  }catch(e){stopPlayer();toast('No se pudo reproducir ese audio en este dispositivo.')}
}
function stopPlayer(){
  if(S.player&&S.player.audio){try{S.player.audio.pause()}catch(e){}}
  S.player=null;renderPlayerState();
}
function renderPlayerState(){
  document.querySelectorAll('.aplay').forEach(el=>{
    const id=el.dataset.note;const n=S.notes.find(x=>x.id===id);if(!n)return;
    const act=S.player&&S.player.id===id;const au=act?S.player.audio:null;
    const playing=!!(au&&!au.paused);
    el.querySelector('button').innerHTML=ico(playing?'pause':'play');
    const bar=el.querySelector('.tr>i');const sp=el.querySelector('span');
    const dur=(au&&isFinite(au.duration)&&au.duration)||n.aud_dur||0;
    bar.style.width=au&&dur?Math.min(100,au.currentTime/dur*100)+'%':'0';
    sp.textContent=act&&S.player.loading?'Cargando…':(au?mmss(au.currentTime)+' / '+mmss(dur):mmss(n.aud_dur));
  });
}

/* ================= sala: ventana de datos ================= */
function openRoomModal(){
  $('#roomCode').textContent=S.code;$('#rmName').value=S.name;
  $('#rmColors').innerHTML=PALETTE.map(c=>'<label><input type="radio" name="rc" value="'+c+'"'+(c===S.color?' checked':'')+' aria-label="Color"><span style="--c:'+c+'"></span></label>').join('');
  $('#roomModal').hidden=false;S.confirmKick=null;loadAdmin();renderXfer();
}
function saveRoomModal(){
  const n=$('#rmName').value.trim();if(!n){toast('Escribí un nombre.');return}
  S.name=n.slice(0,24);S.color=(document.querySelector('#rmColors input:checked')||{}).value||S.color;
  store.set('lad-name',S.name);store.set('lad-color',S.color);
  $('#roomModal').hidden=true;showLib();trackPresence();
  rpc('lad_room_touch',{p_room:S.room,p_member:S.member,p_name:S.name,p_color:S.color}).catch(()=>{});
  if(S.cur&&S.cur.ready){dirty=true;doSave()}
}
async function copyText(t,okMsg){
  try{await navigator.clipboard.writeText(t);toast(okMsg)}
  catch(e){const r=document.createRange();const el=$('#roomCode');r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);toast('Copialo manualmente: quedó seleccionado.')}
}

/* ================= música de fondo (YouTube) ================= */
const MUS={yt:null,api:null,ready:false,list:store.get('lad-mus-list')||'',vol:+(store.get('lad-mus-vol')||60),shuf:false,open:false};
function parseList(v){
  v=(v||'').trim();let m=v.match(/[?&]list=([\w-]{10,})/);if(m)return m[1];
  return /^[\w-]{12,}$/.test(v)?v:'';
}
function loadYT(){
  if(window.YT&&window.YT.Player)return Promise.resolve();
  if(MUS.api)return MUS.api;
  MUS.api=new Promise((res,rej)=>{
    const prev=window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady=()=>{if(prev)prev();res()};
    const sc=document.createElement('script');sc.src='https://www.youtube.com/iframe_api';sc.onerror=()=>{MUS.api=null;rej(new Error('net'))};
    document.head.appendChild(sc);
  });
  return MUS.api;
}
function musMsg(t){const e=$('#musMsg');if(e)e.textContent=t||''}
function toggleMusic(v){
  MUS.open=typeof v==='boolean'?v:!MUS.open;
  const p=$('#mus');p.hidden=!MUS.open&&!MUS.playing;p.classList.toggle('min',!MUS.open);
  document.querySelectorAll('[data-act=music]').forEach(b=>b.setAttribute('aria-pressed',MUS.open));
  if(MUS.open){const i=$('#musIn');if(i&&!i.value&&MUS.list)i.value='https://www.youtube.com/playlist?list='+MUS.list}
}
async function musLoad(){
  const id=parseList($('#musIn').value);
  if(!id){musMsg('Pegá el enlace de una lista de reproducción de YouTube o YouTube Music (tiene que decir "list=").');return}
  musMsg('Cargando…');
  try{await loadYT()}catch(e){musMsg('No se pudo cargar YouTube. Revisá tu conexión.');return}
  MUS.list=id;store.set('lad-mus-list',id);
  if(MUS.yt&&MUS.ready){MUS.yt.loadPlaylist({list:id,listType:'playlist',index:0});musMsg('');return}
  MUS.yt=new YT.Player('musP',{width:'240',height:'135',playerVars:{listType:'playlist',list:id,autoplay:1,playsinline:1,rel:0,modestbranding:1,controls:0},events:{
    onReady:e=>{MUS.ready=true;e.target.setVolume(MUS.vol);e.target.playVideo();musMsg('')},
    onStateChange:e=>{MUS.playing=e.data===1||e.data===3;const b=$('#musPlay');if(b)b.textContent=e.data===1?'❚❚':'▶';
      try{const d=e.target.getVideoData();$('#musTitle').textContent=(d&&d.title)||''}catch(x){}},
    onError:e=>musMsg(e.data===101||e.data===150?'Esa lista no permite reproducirse acá. Probá con otra.':(e.data===2||e.data===100?'No se encontró esa lista. Revisá el enlace (tiene que ser pública o no listada).':'No se pudo reproducir.'))
  }});
}
function musCmd(c){
  const y=MUS.yt;if(!y||!MUS.ready){musMsg('Primero cargá una lista.');return}
  if(c==='prev')y.previousVideo();else if(c==='next')y.nextVideo();
  else if(c==='toggle'){y.getPlayerState()===1?y.pauseVideo():y.playVideo()}
  else if(c==='shuf'){MUS.shuf=!MUS.shuf;y.setShuffle(MUS.shuf);$('#musShuf').setAttribute('aria-pressed',MUS.shuf)}
}
document.addEventListener('input',e=>{if(e.target.id==='musVol'){MUS.vol=+e.target.value;store.set('lad-mus-vol',MUS.vol);if(MUS.yt&&MUS.ready)MUS.yt.setVolume(MUS.vol)}});

/* ================= eventos ================= */
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]');if(!t)return;
  const a=t.dataset.act;
  switch(a){
    case 'gen-code':{$('#gCode').value=genCode();$('#gNew').innerHTML=pwChoiceHtml();$('#gName').focus();break}
    case 'enter-room':{
      const code=$('#gCode').value,name=$('#gName').value.trim();
      const er=$('#gErr');er.hidden=true;
      if(!name){er.hidden=false;er.textContent='Escribí tu nombre para que la otra persona sepa quién sos.';return}
      S.name=name.slice(0,24);S.color=(document.querySelector('#gColors input:checked')||{}).value||PALETTE[0];
      store.set('lad-name',S.name);store.set('lad-color',S.color);
      const creating=!!$('#gNew').innerHTML.trim();let create=null;
      if(creating){const v=pwChoiceValue();if(!v.ok){er.hidden=false;er.textContent='La contraseña tiene que tener al menos 4 caracteres, o elegí "sin contraseña".';return}create={pass:v.pass}}
      const gp=$('#gPass');const pass=gp?gp.value:'';
      $('#gGo').disabled=true;
      enterRoom(code,pass,create).catch(err=>{
        if(err.needPass){showGate('join',code,{pass:true,msg:err.message});return}
        $('#gGo').disabled=false;er.hidden=false;er.textContent=err.message||'No se pudo entrar a la sala.';showGateAgain()});
      break}
    case 'room':openRoomModal();break;
    case 'admin-claim':adm.claiming=true;renderAdmin();break;
    case 'admin-claim-no':adm.claiming=false;renderAdmin();break;
    case 'admin-claim-go':{const v=pwChoiceValue();if(!v.ok){toast('La contraseña tiene que tener al menos 4 caracteres.');break}
      adminDo(async()=>{await claimRoom(v.pass);restartRt()},'Listo: ahora administrás la sala.');break}
    case 'admin-setpass':{const v=($('#apwNew').value||'').trim();if(v.length<4){toast('La contraseña tiene que tener al menos 4 caracteres.');break}
      adminDo(()=>setRoomPass(v),'Contraseña guardada. La otra persona tendrá que escribirla.');break}
    case 'admin-rmpass':adminDo(()=>setRoomPass(''),'La sala quedó sin contraseña.');break
    case 'kick-ask':S.confirmKick=t.dataset.m;renderAdmin();break;
    case 'kick-no':S.confirmKick=null;renderAdmin();break;
    case 'kick-yes':{const m=t.dataset.m;S.confirmKick=null;adminDo(()=>rpc('lad_room_kick',{p_room:S.room,p_owner:store.get('lad-own:'+S.room),p_member:m}),'La persona fue quitada de la sala.');break}
    case 'xfer-go':{t.disabled=true;xferMake().then(l=>renderXfer(l)).catch(()=>{toast('No se pudo generar el enlace. Probá de nuevo.');renderXfer()});break}
    case 'xfer-copy':navigator.clipboard.writeText(t.dataset.l).then(()=>toast('Enlace copiado.')).catch(()=>{});break;
    case 'music':toggleMusic();break;
    case 'mus-load':musLoad();break;
    case 'mus-prev':musCmd('prev');break;
    case 'mus-play':musCmd('toggle');break;
    case 'mus-next':musCmd('next');break;
    case 'mus-shuf':musCmd('shuf');break;
    case 'mus-min':toggleMusic(false);break;
    case 'room-close':$('#roomModal').hidden=true;break;
    case 'room-save':saveRoomModal();break;
    case 'copy-code':copyText(S.code,'Código copiado.');break;
    case 'copy-invite':copyText(location.origin+location.pathname+'#s='+encodeURIComponent(S.code),'Enlace copiado. Quien lo abra entra a tu sala.');break;
    case 'leave-room':leaveRoom();break;
    case 'install':if(S.installEvt){S.installEvt.prompt();S.installEvt=null;renderLib()}break;
    case 'open-book':location.hash='libro-'+t.dataset.id;break;
    case 'back':location.hash='';if(S.screen==='reader')route();break;
    case 'tab-lib':S.tab=t.dataset.t;renderLib();break;
    case 'wish-st':wishAct(()=>rpc('lad_wish_set_status',{p_room:S.room,p_id:t.dataset.id,p_status:t.dataset.st}));break;
    case 'wish-attach':S.linkWish=t.dataset.id;$('#bookFile').click();break;
    case 'wish-del':S.confirmWish=t.dataset.id;renderLib();break;
    case 'wish-del-no':S.confirmWish=null;renderLib();break;
    case 'wish-del-yes':{const id=t.dataset.id;S.confirmWish=null;wishAct(()=>rpc('lad_wish_delete',{p_room:S.room,p_id:id}));break}
    case 'search':openSearch();break;
    case 's-next':searchStep(1);break;
    case 's-prev':searchStep(-1);break;
    case 's-close':closeSearch();break;
    case 'pick-book':S.linkWish=null;$('#bookFile').click();break;
    case 'up-close':$('#upModal').hidden=true;upBlocks=null;S.linkWish=null;break;
    case 'up-save':saveBook();break;
    case 'book-del':S.confirmBook=t.dataset.id;renderLib();break;
    case 'book-del-no':S.confirmBook=null;renderLib();break;
    case 'book-del-yes':deleteBook(t.dataset.id);break;
    case 'prev':navigateTo(S.cur.spread-1);break;
    case 'next':navigateTo(S.cur.spread+1);break;
    case 'fs+':case 'fs-':S.fs=clamp(S.fs+(a==='fs+'?1:-1),13,28);store.set('lad-fs',S.fs);paginate();break;
    case 'notes':togglePanel();break;
    case 'nmode':S.panelMode=t.dataset.m;document.querySelectorAll('#side .seg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===S.panelMode));renderNotes();break;
    case 'goto-uid':{const o=getOthers().find(x=>x.uid===t.dataset.uid);if(o)goToOff(o.off);break}
    case 'follow':{
      const u=t.dataset.uid;const o=getOthers().find(x=>x.uid===u);const nm=(o&&o.name)||'la otra persona';
      if(S.followUid===u){setFollow(null);toast('Dejaste de seguir a '+nm+'.')}
      else{setFollow(u);if(o)navigateTo(Math.floor(pageOfOff(o.off)/S.cur.N),true,o.off);tick();toast('Ahora pasás de página junto con '+nm+'.')}
      break}
    case 'pop-note':openComposer(false);break;
    case 'pop-voice':openComposer(true);break;
    case 'tab':{
      if(!S.panel)togglePanel(true);
      S.panelMode='page';document.querySelectorAll('#side .seg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m==='page'));
      renderNotes();const el=document.getElementById('nt-'+t.dataset.id);
      if(el){el.scrollIntoView({block:'nearest'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1400)}
      break}
    case 'goto':goToOff(+t.dataset.off);break;
    case 'del':S.confirmDel=t.dataset.note;renderNotes();break;
    case 'del-no':S.confirmDel=null;renderNotes();break;
    case 'del-yes':deleteNote(t.dataset.note);break;
    case 'play':playNote(t.dataset.note);break;
    case 'rec-start':startRec();break;
    case 'rec-stop':if(S.rec)S.rec.mr.stop();break;
    case 'aud-pick':$('#audFile').click();break;
    case 'aud-clear':if(S.draft){URL.revokeObjectURL(S.draft.url);S.draft=null}renderAudioRow();cmpValid();break;
    case 'cmp-cancel':closeComposer();break;
    case 'cmp-save':saveNote();break;
  }
});
function showGateAgain(){/* deja visible el formulario con el error */const g=$('#gate');g.hidden=false}
$('#cmpText').addEventListener('input',cmpValid);
$('#bookFile').addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(f)openUpload(f)});
$('#audFile').addEventListener('change',e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  if(f.size>MAX_AUDIO){setCmpErr('Ese audio pesa '+(f.size/1048576).toFixed(1)+' MB y el máximo es 4 MB. Elegí uno más corto.');return}
  const url=URL.createObjectURL(f);const a=new Audio();a.preload='metadata';
  const done=d=>{URL.revokeObjectURL(url);setDraft(f,d)};
  a.onloadedmetadata=()=>done(isFinite(a.duration)?a.duration:0);a.onerror=()=>done(0);a.src=url;
});
$('#scrub').addEventListener('input',e=>{const c=S.cur;if(c&&c.ready)navigateTo(+e.target.value)});
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&(e.target.id==='gCode'||e.target.id==='gName'||e.target.id==='gPass')){const b=$('#gGo');if(b)b.click();return}
  if(e.key==='Escape'){
    if(!$('#cmpModal').hidden)closeComposer();else if(!$('#upModal').hidden){$('#upModal').hidden=true}else if(!$('#roomModal').hidden){$('#roomModal').hidden=true}else hidePop();return}
  const c=S.cur;if(!c||!c.ready||$('#rd').hidden)return;
  if((e.ctrlKey||e.metaKey)&&(e.key==='f'||e.key==='F')){e.preventDefault();openSearch();return}
  if(!$('#cmpModal').hidden||!$('#upModal').hidden||!$('#roomModal').hidden)return;
  const tg=(e.target.tagName||'').toLowerCase();if(tg==='input'||tg==='textarea')return;
  if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();navigateTo(c.spread+1)}
  else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();navigateTo(c.spread-1)}
});
/* tocar bordes, frases y deslizar */
let sx=0,sy=0,swiped=false;
const clip=$('#clip');
clip.addEventListener('pointerdown',e=>{sx=e.clientX;sy=e.clientY});
clip.addEventListener('pointerup',e=>{
  if(e.pointerType==='mouse')return;
  const dx=e.clientX-sx,dy=e.clientY-sy;
  if(Math.abs(dx)>55&&Math.abs(dy)<70){swiped=true;setTimeout(()=>swiped=false,80);navigateTo(S.cur.spread+(dx<0?1:-1))}
});
clip.addEventListener('click',e=>{
  const c=S.cur;if(!c||!c.ready||swiped)return;
  const br=$('#book').getBoundingClientRect(),x=e.clientX-br.left,D=c.D,edge=D.pw*0.15;
  if(x<edge)return navigateTo(c.spread-1);
  if(x>D.pw*D.N-edge)return navigateTo(c.spread+1);
  const sp=e.target.closest('.s');
  if(sp)selectSpan(+sp.dataset.i);else{S.sel=null;decorateSpans();hidePop()}
});
let rzT=null;
if(window.ResizeObserver)new ResizeObserver(()=>{clearTimeout(rzT);rzT=setTimeout(paginate,160)}).observe($('#stage'));
else window.addEventListener('resize',()=>{clearTimeout(rzT);rzT=setTimeout(paginate,160)});
window.addEventListener('pagehide',flushSave);
document.addEventListener('dragover',e=>{const d=$('#drop');if(d&&S.screen==='lib'){e.preventDefault();d.classList.add('over')}});
document.addEventListener('dragleave',()=>{const d=$('#drop');if(d)d.classList.remove('over')});
document.addEventListener('drop',e=>{
  const d=$('#drop');if(!d||S.screen!=='lib')return;
  e.preventDefault();d.classList.remove('over');
  const f=e.dataTransfer&&e.dataTransfer.files[0];if(f)openUpload(f);
});

// para pruebas
window.__lad={pdfLinesToBlocks:pdfLinesToBlocks,parseTxt:parseTxt,splitSentences:splitSentences,S:S};
init();
})();
