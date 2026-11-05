// dashboard_ekf.js - Ventana EKF del dashboard: actitud 3D, trayectoria, graficas y linea de tiempo.
// Dos fuentes con la misma vista: un NOMBRE_ekf.csv de ekf.py (repaso) o el TELEM en vivo de cada cohete (historial en el servidor).
// NED, cuerpo FRD (X nariz, Y derecha, Z opuesto a la marca), cuaternion Hamilton escalar primero, de cuerpo a NED.
(function(){
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const D2R=Math.PI/180,R2D=180/Math.PI;
const COLORS=['#d62728','#2ca02c','#1f77b4','#ff7f0e','#9467bd'];
const ROCKET_NAME={1:'Demeter',2:'Hermes'};
const STATES=['-','TIERRA','ARMED','FLY','RECOVERY'],MOMENTS=['-','LAUNCH','BOOST','COAST','APOGEO','CAIDA','PARACAIDAS','ATERRIZAJE'];
// Graficas: se muestran las que tengan al menos una serie en la fuente. wrap: angulo en +-180, no se une al saltar.
const PLOTS=[
 {title:'Altura (m)',s:[['alt',d=>d.state?'TELEM (hoy GNSS MSL)':'barometro BMP'],['up','EKF (-pD)']]},
 {title:'Velocidad NED (m/s)',s:[['vn','N'],['ve','E'],['vd','D']]},
 {title:'Actitud (grados)',wrap:true,s:[['yaw','guinada'],['pitch','cabeceo'],['roll','alabeo']]},
 {title:'Nariz (grados)',wrap:true,s:[['tilt','inclinacion desde la vertical'],['naz','rumbo']]},
 {title:'Incertidumbre de actitud 1 sigma (grados)',s:[['sx','x'],['sy','y'],['sz','z (rumbo)']]},
 {title:'Sesgo del giro (dps)',s:[['bgx','x'],['bgy','y'],['bgz','z']]},
 {title:'Fuerza especifica en cuerpo (g)',s:[['fx','X nariz'],['fy','Y derecha'],['fz','Z']]},
 {title:'Aceleracion en el chip (g)',s:[['ax','x'],['ay','y'],['az','z']]},
 {title:'Incertidumbre de posicion 1 sigma (m)',s:[['sig_pn','N'],['sig_pe','E'],['sig_pd','D']]},
 {title:'Enlace',s:[['rssi','RSSI (dBm)'],['snr','SNR (dB)']]},
];
const TILE_CACHE=new Map();         // teselas OSM del mapa (si no hay internet, queda la cuadricula)
const WINS=[[30,'30 s'],[120,'2 min'],[600,'10 min'],[0,'todo']];
const SPEEDS=[0.25,0.5,1,2,5,10,30,100];

const E={src:'',d:null,n:0,cur:0,playing:false,speed:1,follow:true,win:120,az:-0.7,el:0.35,list:{csv:[],bin:[]},desde:0,origin:null,t0:null,
 msg:'',noEkf:false,dirty:true,lastFrame:0,jobWas:false,jobName:'',raf:0,drag:null,plotRects:[],osm:true,ref:null};

// ---------- matematica ----------
function qC(w,x,y,z){return [[1-2*(y*y+z*z),2*(x*y-w*z),2*(x*z+w*y)],[2*(x*y+w*z),1-2*(x*x+z*z),2*(y*z-w*x)],[2*(x*z-w*y),2*(y*z+w*x),1-2*(x*x+y*y)]]}
function euler(C){return [Math.atan2(C[1][0],C[0][0])*R2D,Math.asin(Math.max(-1,Math.min(1,-C[2][0])))*R2D,Math.atan2(C[2][1],C[2][2])*R2D]}
function nose(C){return [Math.acos(Math.max(-1,Math.min(1,-C[2][0])))*R2D,Math.atan2(C[1][0],C[0][0])*R2D]}   // inclinacion desde arriba y rumbo de la nariz (eje X)
function mv(C,v){return [C[0][0]*v[0]+C[0][1]*v[1]+C[0][2]*v[2],C[1][0]*v[0]+C[1][1]*v[1]+C[1][2]*v[2],C[2][0]*v[0]+C[2][1]*v[1]+C[2][2]*v[2]]}
function lower(t,x){let a=0,b=t.length-1;if(b<0)return -1;if(x<=t[0])return 0;if(x>=t[b])return b;while(b-a>1){const m=(a+b)>>1;if(t[m]<=x)a=m;else b=m}return x-t[a]<t[b]-x?a:b}
const fmt=(v,d=2)=>v===undefined||v===null||isNaN(v)?'-':(+v).toFixed(d);
const tfmt=s=>{if(isNaN(s))return '-';const m=Math.floor(s/60),r=s-60*m;return m+':'+(r<10?'0':'')+r.toFixed(1)};

// Agrega a la fuente las columnas derivadas del cuaternion: euler (si faltan), nariz, y la altura del EKF.
function derive(d,i0){
 const n=d.t.length;
 for(const k of ['yaw','pitch','roll','tilt','naz'])if(!d[k])d[k]=[];
 if(d.pd&&!d.up)d.up=[];
 for(let i=i0;i<n;i++){
  const C=qC(d.qw[i],d.qx[i],d.qy[i],d.qz[i]);
  if(d.yaw.length<=i){const e=euler(C);d.yaw[i]=e[0];d.pitch[i]=e[1];d.roll[i]=e[2]}
  const s=nose(C);d.tilt[i]=s[0];d.naz[i]=s[1];
  if(d.up)d.up[i]=-d.pd[i];
 }
}

// ---------- fuentes ----------
const RENAME={t_us:'t',guinada_deg:'yaw',cabeceo_deg:'pitch',alabeo_deg:'roll',alt_baro_m:'alt',sig_x_deg:'sx',sig_y_deg:'sy',sig_z_deg:'sz',
 rssi_dbm:'rssi',snr_db:'snr',gnss_fix:'fix',gnss_nsv:'nsv'};
// Referencia del mapa: la latitud y longitud donde pN = pE = 0 (el origen del EKF o el primer fix en vivo)
function refFromCsv(d){
 if(!d.lat||!d.pn)return null;const k=D2R*6378137;
 for(let i=0;i<d.t.length;i++)if(isFinite(d.lat[i])&&isFinite(d.pn[i])){const lat0=d.lat[i]-d.pn[i]/k;return [lat0,d.lon[i]-d.pe[i]/(k*Math.cos(lat0*D2R))]}
 return null;
}
function parseCsv(txt){
 const L=txt.split('\n');const head=L[0].trim().split(',');
 const keys=head.map(h=>RENAME[h]||h.replace(/_(m|mps|deg|dps|g)$/,''));
 const cols=keys.map(()=>[]);
 for(let i=1;i<L.length;i++){const l=L[i];if(!l)continue;const p=l.split(',');if(p.length!=head.length)continue;for(let j=0;j<p.length;j++)cols[j].push(parseFloat(p[j]))}
 const d={};keys.forEach((k,j)=>d[k]=cols[j]);
 const t0=d.t[0];d.t=d.t.map(v=>(v-t0)/1e6);
 derive(d,0);return d;
}
function liveAppend(cols,rows){
 const d=E.d,ix={};cols.forEach((c,j)=>ix[c]=j);
 const i0=d.t.length;
 for(const r of rows){
  if(E.t0===null)E.t0=r[ix.t];
  const q=[r[ix.qw],r[ix.qx],r[ix.qy],r[ix.qz]];const nq=Math.hypot(...q)||1;
  E.noEkf=Math.abs(q[0]-1)<1e-4&&Math.abs(q[1])+Math.abs(q[2])+Math.abs(q[3])<1e-4;
  d.t.push(r[ix.t]-E.t0);d.qw.push(q[0]/nq);d.qx.push(q[1]/nq);d.qy.push(q[2]/nq);d.qz.push(q[3]/nq);
  const fix=r[ix.fix];
  if(!E.origin&&fix>=3&&r[ix.lat]){E.origin=[r[ix.lat],r[ix.lon]];E.ref=E.origin}
  if(E.origin&&fix>=3){const k=Math.PI/180,R=6378137;d.pn.push((r[ix.lat]-E.origin[0])*k*R);d.pe.push((r[ix.lon]-E.origin[1])*k*R*Math.cos(E.origin[0]*k))}else{d.pn.push(NaN);d.pe.push(NaN)}
  for(const c of ['alt','vn','ve','vd','ax','ay','az','gx','gy','gz','fix','nsv','state','moment','flags','rssi','snr','vbat','utc_ms','lat','lon'])d[c].push(r[ix[c]]);
 }
 derive(d,i0);
}
function newLive(){const d={t:[],qw:[],qx:[],qy:[],qz:[],pn:[],pe:[]};for(const c of ['alt','vn','ve','vd','ax','ay','az','gx','gy','gz','fix','nsv','state','moment','flags','rssi','snr','vbat','utc_ms','lat','lon'])d[c]=[];return d}

async function loadList(){
 try{E.list=await (await fetch('/api/ekf/lista')).json()}catch(e){return}
 const sel=$('ek_src');if(sel){const v=E.src;sel.innerHTML=srcOptions();sel.value=v}
 const b=$('ek_bin');if(b){const v=b.value;b.innerHTML=E.list.bin.map(x=>`<option value="${esc(x.name)}">${esc(x.name)}${x.csv?' (ya tiene _ekf.csv)':''}</option>`).join('');if(v)b.value=v;pickCalib()}
}
// Calibracion para ekf.py: la vigente del cohete si ekf.py la acepta; si no, la mas reciente de ese cohete que sirva.
function pickCalib(){
 const c=$('ek_cal'),b=$('ek_bin');if(!c||!b)return;const role=b.value.startsWith('HER')?'hermes':'demeter';
 c.innerHTML='<option value="">la vigente del cohete</option>'+E.list.calib.map(x=>`<option value="${esc(x.path)}">${esc(x.path)}</option>`).join('');
 const mine=E.list.calib.filter(x=>x.path.includes(role));
 c.value=E.list.calib.some(x=>x.path=='calib_'+role+'.json')||!mine.length?'':mine[mine.length-1].path;
}
function srcOptions(){return '<option value="">-- escoge --</option><optgroup label="En vivo (TELEM)"><option value="vivo:1">Demeter en vivo</option><option value="vivo:2">Hermes en vivo</option></optgroup><optgroup label="Repaso (ekf.py)">'+E.list.csv.map(x=>`<option value="f:${esc(x.name)}">${esc(x.name)} (${x.mb} MB)</option>`).join('')+'</optgroup>'}
async function setSource(v){
 E.src=v;E.d=null;E.playing=false;E.origin=null;E.ref=null;E.t0=null;E.desde=0;E.noEkf=false;E.msg='';E.dirty=true;
 if(!v){layoutMsg();return}
 if(v.startsWith('vivo:')){E.d=newLive();E.follow=true;E.msg='esperando TELEM...';await poll();return}
 E.msg='cargando '+v.slice(2)+'...';layoutMsg();
 try{const r=await fetch('/api/ekf/archivo?f='+encodeURIComponent(v.slice(2)));if(!r.ok)throw new Error((await r.json()).error);
  const d=parseCsv(await r.text());if(E.src!=v)return;E.d=d;E.ref=refFromCsv(d);E.cur=0;E.follow=false;E.msg=d.t.length+' muestras, '+tfmt(d.t[d.t.length-1])+' min:s'+(d.fx?'':' | CSV de una version anterior de ekf.py: sin radares G, mapa ni estadisticas (vuelve a calcularlo)')}
 catch(e){E.msg='no se pudo cargar: '+e.message}
 E.dirty=true;layoutMsg();
}
async function poll(){
 if(!E.src.startsWith('vivo:'))return;
 const rid=E.src.slice(5),src=E.src;
 let j;try{j=await (await fetch(`/api/ekf/vivo?r=${rid}&desde=${E.desde}`)).json()}catch(e){return}
 if(E.src!=src||!j.rows.length)return;
 E.desde=j.rows[j.rows.length-1][0];liveAppend(j.cols,j.rows);
 const d=E.d;E.msg=`${ROCKET_NAME[rid]}: ${d.t.length} TELEM`+(E.noEkf?' | el cuaternion llega en identidad: aun no hay EKF a bordo (altura y velocidad son del GNSS)':'');
 if(E.follow)E.cur=d.t[d.t.length-1];
 E.dirty=true;layoutMsg();
}
setInterval(()=>{if(window.ekfActive())poll()},500);

// ---------- interfaz ----------
window.ekfActive=()=>!!$('ek_root');
window.ekfBuild=m=>{
 m.innerHTML=`<div id="ek_root" class="fill" style="gap:6px">
 <style>#ek_grid{display:grid;grid-template-columns:minmax(240px,1fr) 2.2fr minmax(240px,1fr);gap:8px;flex:1;min-height:0}
 #ek_grid .box{display:flex;flex-direction:column;min-height:0;padding:6px}#ek_grid canvas{width:100%;flex:1;min-height:0;display:block}
 #ek_3d{flex:0 0 auto!important;aspect-ratio:1;max-height:42%}#ek_g{flex:0 0 170px!important;height:170px}#ek_numw{flex:1;min-height:0;overflow:auto}
 #ek_trk{flex:1;min-height:160px!important}#ek_num td{font-size:12px;padding:1px 4px}#ek_tl{display:flex;align-items:center;gap:6px}#ek_rng{flex:1}#ek_job{max-height:110px;font-size:11px}
 #ek_bar select{max-width:330px}#ek_stat{flex:0 0 auto;font-size:12px;overflow:auto;max-height:46%}
 #ek_stat .row{display:grid;grid-template-columns:96px 1fr 92px;align-items:center;gap:6px;margin:2px 0}
 #ek_stat .bar{height:9px;background:#eee;border-radius:5px;overflow:hidden}#ek_stat .bar i{display:block;height:100%;border-radius:5px}
 #ek_stat .val{font-variant-numeric:tabular-nums;text-align:right}#ek_stat h4{margin:6px 0 2px;font-size:12px}
 #ek_stat table td{padding:1px 4px;font-size:11.5px;font-variant-numeric:tabular-nums}</style>
 <div id="ek_bar">Fuente <select id="ek_src">${srcOptions()}</select>
  &nbsp;|&nbsp; Calcular EKF de <select id="ek_bin"></select>
  ${[['--sin-mag','sin mag'],['--sin-gnss','sin GNSS'],['--sin-baro','sin baro'],['--solo-lsm','solo LSM']].map(([o,l])=>`<label><input type="checkbox" style="width:auto" data-o="${o}"> ${l}</label>`).join(' ')}
  con <select id="ek_cal"></select> <button id="ek_run">Calcular</button> <span id="ek_msg" class="note"></span></div>
 <div id="ek_grid">
  <div class="box"><b>Actitud</b><span class="note" style="font-size:11px">arrastra para girar la vista. Naranja: la marca (-Z). Azul: costado derecho (+Y)</span><canvas id="ek_3d"></canvas>
   <b>Fuerzas G</b><canvas id="ek_g"></canvas><div id="ek_numw"><table class="t" id="ek_num"></table></div></div>
  <div class="box"><canvas id="ek_plots"></canvas></div>
  <div class="box"><b>Posicion</b><span class="note" style="font-size:11px">norte arriba; la flecha es el rumbo de la nariz. <label><input type="checkbox" id="ek_osm" style="width:auto"> mapa OSM (con internet)</label></span><canvas id="ek_trk"></canvas>
   <div id="ek_stat"></div><pre id="ek_job"></pre></div>
 </div>
 <div id="ek_tl"><button id="ek_play" style="min-width:90px"></button> velocidad <select id="ek_speed">${SPEEDS.map(s=>`<option value="${s}">${s}x</option>`).join('')}</select>
  <input type="range" id="ek_rng" min="0" max="10000" value="0"> <span id="ek_time" style="font:12px monospace;min-width:150px"></span>
  ventana <select id="ek_win">${WINS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>
  <button id="ek_live">Ir al final</button></div></div>`;
 $('ek_src').value=E.src;$('ek_speed').value=String(E.speed);$('ek_win').value=String(E.win);
 $('ek_osm').checked=E.osm;$('ek_osm').onchange=e=>{E.osm=e.target.checked;E.dirty=true};
 $('ek_src').onchange=e=>setSource(e.target.value);
 $('ek_bin').onchange=pickCalib;
 $('ek_speed').onchange=e=>{E.speed=+e.target.value};
 $('ek_win').onchange=e=>{E.win=+e.target.value;E.dirty=true};
 $('ek_play').onclick=togglePlay;
 $('ek_live').onclick=()=>{if(!E.d)return;E.cur=E.d.t[E.d.t.length-1];E.follow=E.src.startsWith('vivo:');E.playing=false;E.dirty=true};
 $('ek_rng').oninput=e=>{if(!E.d)return;const t=E.d.t;E.cur=t[0]+(t[t.length-1]-t[0])*e.target.value/10000;E.follow=false;E.dirty=true};
 $('ek_run').onclick=()=>{const name=$('ek_bin').value;if(!name)return;const opts=[...document.querySelectorAll('#ek_bar input[data-o]')].filter(x=>x.checked).map(x=>x.dataset.o);
  E.jobName=name;window.post('/api/ekf/run',{name,opts,calib:$('ek_cal').value}).then(r=>{if(r.ok){E.jobWas=true;window.tick()}})};
 const c3=$('ek_3d');
 c3.onmousedown=e=>{E.drag=[e.clientX,e.clientY,E.az,E.el]};
 window.onmouseup=()=>{E.drag=null};
 c3.onmousemove=e=>{if(!E.drag)return;E.az=E.drag[2]-(e.clientX-E.drag[0])*0.01;E.el=Math.max(-1.4,Math.min(1.4,E.drag[3]+(e.clientY-E.drag[1])*0.01));E.dirty=true};
 const cp=$('ek_plots');let seeking=false;
 const seek=e=>{const r=cp.getBoundingClientRect(),x=e.clientX-r.left;const p=E.plotRects[0];if(!p||!E.d)return;E.cur=p.ta+(x-p.x)/p.w*(p.tb-p.ta);E.follow=false;E.dirty=true};
 cp.onmousedown=e=>{seeking=true;seek(e)};cp.onmousemove=e=>{if(seeking)seek(e)};cp.onmouseup=cp.onmouseleave=()=>{seeking=false};
 E.dirty=true;layoutMsg();loadList();
 cancelAnimationFrame(E.raf);E.lastFrame=performance.now();E.raf=requestAnimationFrame(frame);
};
function togglePlay(){if(!E.d)return;const t=E.d.t;if(!E.playing&&E.cur>=t[t.length-1]-1e-6)E.cur=t[0];E.playing=!E.playing;E.follow=false;E.dirty=true}
document.addEventListener('keydown',e=>{if(!window.ekfActive()||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
 if(e.code=='Space'){togglePlay();e.preventDefault()}
 if(e.code=='ArrowRight'||e.code=='ArrowLeft'){if(!E.d)return;E.cur+=(e.code=='ArrowRight'?1:-1)*(e.shiftKey?10:1);E.follow=false;E.dirty=true;e.preventDefault()}});
function layoutMsg(){const m=$('ek_msg');if(m)m.textContent=E.msg}
window.ekfJob=()=>{
 const st=typeof S!=='undefined'?S:null;const el=$('ek_job');if(!el||!st)return;   // S: estado del dashboard, del script principal
 const mine=st.job.role=='ekf';const txt=mine?st.job.lines.map(l=>l.replace(/^~/,'')).join('\n'):'';
 if(el.textContent!=txt){el.textContent=txt;el.scrollTop=el.scrollHeight}
 const b=$('ek_run');if(b)b.disabled=st.job.running;
 if(E.jobWas&&!st.job.running&&mine){E.jobWas=false;const rc=st.job.rc;loadList().then(()=>{if(rc===0&&E.jobName){const v='f:'+E.jobName.replace(/\.BIN$/,'_ekf.csv');$('ek_src').value=v;setSource(v)}})}
};

// ---------- dibujo ----------
function canvas(id){const c=$(id);if(!c)return null;const dpr=window.devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;
 if(c.width!=Math.round(w*dpr)||c.height!=Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr)}
 const g=c.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);g.font='11px system-ui,sans-serif';return {g,w,h}}
function frame(now){
 if(!window.ekfActive())return;
 const dt=Math.min(0.2,(now-E.lastFrame)/1000);E.lastFrame=now;
 if(E.playing&&E.d){const t=E.d.t;E.cur+=dt*E.speed;if(E.cur>=t[t.length-1]){E.cur=t[t.length-1];E.playing=false}E.dirty=true}
 if(E.dirty){E.dirty=false;draw()}
 E.raf=requestAnimationFrame(frame);
}
// Redibuja tambien si cambia el tamano de la ventana
window.addEventListener('resize',()=>{E.dirty=true});
function draw(){
 const d=E.d;
 $('ek_play').textContent=E.playing?'Pausa':'Reproducir';
 if(!d||!d.t.length){for(const id of ['ek_3d','ek_g','ek_plots','ek_trk']){const c=canvas(id);if(c){c.g.fillStyle='#999';c.g.fillText(E.src?E.msg:'Escoge una fuente arriba',10,20)}}$('ek_num').innerHTML='';$('ek_stat').innerHTML='';$('ek_time').textContent='';return}
 const t=d.t,T0=t[0],T1=t[t.length-1];
 E.cur=Math.max(T0,Math.min(T1,E.cur));
 const i=lower(t,E.cur);
 $('ek_rng').value=T1>T0?Math.round((E.cur-T0)/(T1-T0)*10000):10000;
 $('ek_time').textContent=tfmt(E.cur)+' / '+tfmt(T1)+(E.follow?'  EN VIVO':'');
 draw3d(d,i);drawG(d,i);drawPlots(d,i);drawTrack(d,i);numbers(d,i);status(d,i);
}

// ---------- fuerzas G ----------
// Fuerza especifica (lo que mide un acelerometro: en reposo con la nariz arriba, X = +1 g). En el repaso, en cuerpo FRD ya calibrado;
// en vivo, los ejes del chip tal como llegan en TELEM, hasta que exista el EKF a bordo.
function gSeries(d){
 if(d.fx)return {x:d.fx,y:d.fy,z:d.fz,lbl:'cuerpo FRD, calibrado'};
 if(d.ax)return {x:d.ax,y:d.ay,z:d.az,lbl:'ejes del chip, sin calibrar'};
 return null;
}
function niceG(v){for(const s of [1,2,3,5,10,15,20,30,50])if(v<=s)return s;return 100}
function drawG(d,i){
 const c=canvas('ek_g');if(!c)return;const {g,w,h}=c;const s=gSeries(d);
 if(!s){g.fillStyle='#999';g.fillText('sin acelerometro en esta fuente',10,20);return}
 const t=d.t,k10=lower(t,t[i]-10),k2=lower(t,t[i]-2);
 let mxL=0,mnX=0,mxX=1;
 for(let q=k10;q<=i;q++){const yy=s.y[q],zz=s.z[q],xx=s.x[q];if(isNaN(xx))continue;mxL=Math.max(mxL,Math.hypot(yy,zz));mnX=Math.min(mnX,xx);mxX=Math.max(mxX,xx)}
 // Radar de la seccion: visto desde la cola, +Y a la derecha y la marca (-Z) arriba
 const r=Math.min(h/2-18,w*0.3),cx=r+14,cy=h/2+4,Rg=niceG(mxL*1.15);
 g.strokeStyle='#ccc';g.lineWidth=1;g.fillStyle='#fafafa';g.beginPath();g.arc(cx,cy,r,0,2*Math.PI);g.fill();g.stroke();
 for(const f of [0.25,0.5,0.75]){g.beginPath();g.arc(cx,cy,r*f,0,2*Math.PI);g.strokeStyle='#e4e4e4';g.stroke()}
 g.beginPath();g.moveTo(cx-r,cy);g.lineTo(cx+r,cy);g.moveTo(cx,cy-r);g.lineTo(cx,cy+r);g.strokeStyle='#ddd';g.stroke();
 g.fillStyle='#ff7f0e';g.fillText('marca',cx-14,cy-r-3);g.fillStyle='#1f77b4';g.fillText('+Y',cx+r+2,cy+4);g.fillStyle='#888';g.fillText(Rg+' g',cx+r*0.71+2,cy-r*0.71);
 const P=q=>[cx+s.y[q]/Rg*r,cy+s.z[q]/Rg*r];
 g.strokeStyle='rgba(214,39,40,0.35)';g.lineWidth=1.5;g.beginPath();let pen=false;
 for(let q=k2;q<=i;q++){if(isNaN(s.y[q])){pen=false;continue}const p=P(q);pen?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]);pen=true}g.stroke();
 if(!isNaN(s.y[i])){const p=P(i);g.fillStyle='#d62728';g.beginPath();g.arc(p[0],p[1],5,0,2*Math.PI);g.fill()}
 g.fillStyle='#222';g.fillText('Seccion (Y, Z): '+fmt(Math.hypot(s.y[i],s.z[i]),2)+' g',4,11);
 // Eje longitudinal (X, nariz arriba): aqui se ve la gravedad, el empuje y el frenado
 const lo=-niceG(Math.max(1,-mnX*1.15)),hi=niceG(Math.max(2,mxX*1.15)),x0=cx+r+46,bw=18,top=18,bot=h-14;
 const Y=v=>bot-(v-lo)/(hi-lo)*(bot-top);
 g.fillStyle='#fafafa';g.strokeStyle='#ccc';g.fillRect(x0,top,bw,bot-top);g.strokeRect(x0,top,bw,bot-top);
 g.fillStyle='#666';for(const v of [lo,0,1,hi]){const y=Y(v);g.strokeStyle=v===1?'#2ca02c':'#bbb';g.beginPath();g.moveTo(x0-4,y);g.lineTo(x0+bw+4,y);g.stroke();g.fillText((v>0?'+':'')+v+' g',x0+bw+7,y+4)}
 g.fillStyle='#2ca02c';g.fillText('1 g: quieto, nariz arriba',x0+bw+40,Y(1)+4);
 g.fillStyle='rgba(31,119,180,0.25)';g.fillRect(x0+2,Y(mxX),bw-4,Y(mnX)-Y(mxX));
 if(!isNaN(s.x[i])){const y=Y(Math.max(lo,Math.min(hi,s.x[i])));g.fillStyle='#1f77b4';g.beginPath();g.arc(x0+bw/2,y,6,0,2*Math.PI);g.fill()}
 g.fillStyle='#222';g.fillText('Eje X (nariz): '+fmt(s.x[i],2)+' g',x0-30,11);
 g.fillStyle='#888';g.fillText(s.lbl+'; estela 2 s, banda 10 s',4,h-2);
}

// ---------- estado: bateria, enlace, SD, GNSS y estadisticas del EKF ----------
function bar(label,frac,col,val){const f=isFinite(frac)?Math.max(0,Math.min(1,frac)):0;
 return `<div class="row"><span>${label}</span><div class="bar"><i style="width:${(100*f).toFixed(0)}%;background:${col}"></i></div><span class="val">${val}</span></div>`}
const sev=(f,good,warn)=>f>=good?'#2ca02c':f>=warn?'#e6a100':'#d62728';
function status(d,i){
 const el=$('ek_stat');if(!el)return;const v=k=>d[k]?d[k][i]:NaN;const live=E.src.startsWith('vivo:');const out=[];
 // Bateria de la LilyGo (1 celda): de 3.3 a 4.2 V. Solo llega en TELEM
 if(live&&isFinite(v('vbat'))){const f=(v('vbat')-3300)/900;out.push(bar('Bateria',f,sev(f,0.5,0.2),fmt(v('vbat')/1000,2)+' V '+(100*Math.max(0,Math.min(1,f))).toFixed(0)+' %'))}
 else out.push(`<div class="row"><span>Bateria</span><span class="note">solo en vivo (no esta en el log)</span><span></span></div>`);
 // Enlace: RSSI y SNR (en vivo, de la telemetria en tierra; en el repaso, de las balizas de tierra que recibio el cohete)
 if(isFinite(v('rssi'))){const fr=(v('rssi')+120)/90,fs=(v('snr')+10)/25;
  out.push(bar('RSSI',fr,sev(fr,0.35,0.12),fmt(v('rssi'),0)+' dBm'));
  out.push(bar('SNR',fs,v('snr')>0?'#2ca02c':v('snr')>-7.5?'#e6a100':'#d62728',fmt(v('snr'),1)+' dB'))}
 else out.push(`<div class="row"><span>Enlace</span><span class="note">sin datos de radio</span><span></span></div>`);
 if(live){const t=d.t,k=lower(t,t[i]-10),n=i-k,rate=(v('flags')&1)?10:2,f=n/Math.max(1,Math.min(10,t[i]-t[0]))/rate;
  out.push(bar('Calidad',f,sev(f,0.9,0.6),(100*Math.min(1,f)).toFixed(0)+' % ('+rate+' Hz)'))}
 // SD
 const st=typeof S!=='undefined'?S:null;const rid=live?+E.src.slice(5):0;const lg=st&&rid?st.rockets[rid-1].log:null;
 if(lg)out.push(bar('SD',(lg.pct||0)/100,sev(1-(lg.pct||0)/100,0.3,0.1),lg.rec?(lg.pct+' % del bloque'):'sin registrar'));
 else if(isFinite(v('sd_mb')))out.push(bar('SD',(v('sd_mb')%32)/32,'#1f77b4',fmt(v('sd_mb'),1)+' MB escritos'));
 // GNSS
 if(isFinite(v('fix')))out.push(`<div class="row"><span>GNSS</span><span>fix ${v('fix')}, ${fmt(v('nsv'),0)} sv${isFinite(v('gnss_hacc'))?', hAcc '+fmt(v('gnss_hacc'),1)+' m':''}</span><span></span></div>`);
 if(E.ref&&isFinite(v('lat')))out.push(`<div class="row"><span>Posicion</span><span>${fmt(v('lat'),6)}, ${fmt(v('lon'),6)}</span><span class="val">${fmt(Math.hypot(v('pn'),v('pe')),0)} m del origen</span></div>`);
 // EKF
 if(live&&E.noEkf)out.push('<h4>EKF</h4><span class="note">aun no corre a bordo: el cuaternion llega en identidad</span>');
 else if(d.sig_pn){
  const t=d.t,k=lower(t,t[i]-10);const dd=c=>d[c]?d[c][i]-d[c][k]:NaN;
  const rowm=(n,ok,rj)=>{const a=v(ok),b=v(rj),a10=dd(ok),b10=dd(rj),p=a10+b10>0?100*b10/(a10+b10):0;
   return `<tr><td>${n}</td><td>${fmt(a,0)} / ${fmt(b,0)}</td><td style="color:${p>20?'#d62728':p>5?'#e6a100':'#2ca02c'}">${fmt(p,0)} %</td></tr>`};
  out.push('<h4>EKF</h4><table><tr><td>Sigma posicion N E D</td><td colspan="2">'+[v('sig_pn'),v('sig_pe'),v('sig_pd')].map(x=>fmt(x,2)).join(' ')+' m</td></tr>'
   +'<tr><td>Sigma velocidad N E D</td><td colspan="2">'+[v('sig_vn'),v('sig_ve'),v('sig_vd')].map(x=>fmt(x,3)).join(' ')+' m/s</td></tr>'
   +'<tr><td>Sigma actitud x y z</td><td colspan="2">'+[v('sx'),v('sy'),v('sz')].map(x=>fmt(x,2)).join(' ')+' grados</td></tr>'
   +'<tr><td><i>medidas</i></td><td><i>acept. / rech.</i></td><td><i>rech. 10 s</i></td></tr>'
   +rowm('GNSS','gnss_ok','gnss_rej')+rowm('Barometros','baro_ok','baro_rej')+rowm('Magnetometros','mag_ok','mag_rej')+'</table>');
 }
 el.innerHTML=out.join('');
}
function numbers(d,i){
 const v=k=>d[k]?d[k][i]:undefined;
 const rows=[['t',tfmt(d.t[i])+' min:s']];
 if(d.utc_ms&&v('utc_ms'))rows.push(['UTC',new Date(v('utc_ms')).toISOString().slice(11,23)]);
 if(d.state)rows.push(['Estado / momento',(STATES[v('state')]||'?')+' / '+(MOMENTS[v('moment')]||'?')]);
 rows.push(['Cuaternion w x y z',[v('qw'),v('qx'),v('qy'),v('qz')].map(x=>fmt(x,4)).join(' ')]);
 rows.push(['Guinada cabeceo alabeo',fmt(v('yaw'),1)+' '+fmt(v('pitch'),1)+' '+fmt(v('roll'),1)+' grados']);
 rows.push(['Nariz: inclinacion, rumbo',fmt(v('tilt'),1)+' desde arriba, '+fmt(v('naz'),1)+' grados']);
 rows.push(['Altura',fmt(v('alt'),2)+' m'+(d.up?' (EKF '+fmt(v('up'),2)+')':d.state?' GNSS MSL':'')]);
 rows.push(['Posicion N E',fmt(v('pn'),1)+' '+fmt(v('pe'),1)+' m']);
 const vh=Math.hypot(v('vn'),v('ve'));
 rows.push(['Velocidad N E D',fmt(v('vn'))+' '+fmt(v('ve'))+' '+fmt(v('vd'))+' m/s']);
 rows.push(['Horizontal, total',fmt(vh)+', '+fmt(Math.hypot(vh,v('vd')))+' m/s']);
 if(d.sx)rows.push(['Sigma actitud x y z',fmt(v('sx'))+' '+fmt(v('sy'))+' '+fmt(v('sz'))+' grados']);
 if(d.bgx)rows.push(['Sesgo giro',fmt(v('bgx'),3)+' '+fmt(v('bgy'),3)+' '+fmt(v('bgz'),3)+' dps']);
 if(d.bax)rows.push(['Sesgo acel',fmt(1000*v('bax'),1)+' '+fmt(1000*v('bay'),1)+' '+fmt(1000*v('baz'),1)+' mg']);
 if(d.b_bmp)rows.push(['Sesgo BMP / BME',fmt(v('b_bmp'))+' / '+fmt(v('b_bme'))+' m']);
 if(d.ax)rows.push(['Acel (chip)',fmt(v('ax'),3)+' '+fmt(v('ay'),3)+' '+fmt(v('az'),3)+' g']);
 if(d.gx)rows.push(['Giro (chip)',fmt(v('gx'),1)+' '+fmt(v('gy'),1)+' '+fmt(v('gz'),1)+' dps']);
 if(d.rssi)rows.push(['RSSI / SNR / GNSS',fmt(v('rssi'),1)+' dBm / '+fmt(v('snr'),1)+' dB / fix '+v('fix')+', '+v('nsv')+' sv']);
 $('ek_num').innerHTML=rows.map(([a,b])=>`<tr><td>${a}</td><td><b>${esc(b)}</b></td></tr>`).join('');
}

// Actitud 3D: proyeccion ortografica del cohete en ENU (este, norte, arriba), vista orbitable.
function draw3d(d,i){
 const c=canvas('ek_3d');if(!c)return;const {g,w,h}=c;
 const C=qC(d.qw[i],d.qx[i],d.qy[i],d.qz[i]);
 const ca=Math.cos(E.az),sa=Math.sin(E.az),ce=Math.cos(E.el),se=Math.sin(E.el),S=Math.min(w,h)*0.42,cx=w/2,cy=h/2;
 const P=ned=>{const e=ned[1],n=ned[0],u=-ned[2];const x1=e*ca-n*sa,y1=e*sa+n*ca;return [cx+S*x1,cy-S*(u*ce-y1*se),y1*ce+u*se]};
 const B=b=>P(mv(C,b));
 const line=(a,b,col,wid=1,dash)=>{g.strokeStyle=col;g.lineWidth=wid;g.setLineDash(dash||[]);g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();g.setLineDash([])};
 // suelo: rosa de los vientos en el plano horizontal
 g.strokeStyle='#ddd';g.lineWidth=1;g.beginPath();for(let k=0;k<=48;k++){const a=k/48*2*Math.PI,p=P([Math.cos(a)*0.95,Math.sin(a)*0.95,0]);k?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])}g.stroke();
 for(const [n,e,l] of [[1,0,'N'],[0,1,'E'],[-1,0,'S'],[0,-1,'O']]){const p=P([n*0.95,e*0.95,0]),o=P([0,0,0]);line(o,p,l=='N'?'#e99':'#ddd');g.fillStyle=l=='N'?'#c33':'#999';g.fillText(l,p[0]+3,p[1]-3)}
 const up=P([0,0,-0.9]);line(P([0,0,0]),up,'#ccd',1,[3,3]);g.fillStyle='#99a';g.fillText('arriba',up[0]+3,up[1]);
 // cohete en cuerpo FRD: X nariz. Largo 1.3, radio 0.07
 const L0=-0.6,L1=0.45,TIP=0.75,R=0.07,NS=12;
 const segs=[];
 const ring=x=>{const pts=[];for(let k=0;k<=NS;k++){const a=k/NS*2*Math.PI;pts.push(B([x,R*Math.cos(a),R*Math.sin(a)]))}return pts};
 const r0=ring(L0),r1=ring(L1),tip=B([TIP,0,0]);
 for(let k=0;k<NS;k++){segs.push([r0[k],r0[k+1],'#555',1]);segs.push([r1[k],r1[k+1],'#555',1]);segs.push([r1[k],tip,'#888',1])}
 for(let k=0;k<NS;k+=2)segs.push([r0[k],r1[k],'#999',1]);
 // marca (-Z) en naranja, costado derecho (+Y) en azul, a lo largo del fuselaje
 segs.push([B([L0,0,-R]),B([L1,0,-R]),'#ff7f0e',3]);
 segs.push([B([L0,R,0]),B([L1,R,0]),'#1f77b4',3]);
 segs.sort((a,b)=>(a[0][2]+a[1][2])-(b[0][2]+b[1][2]));
 for(const s of segs)line(s[0],s[1],s[2],s[3]);
 // aletas
 const fin=(dy,dz,col)=>{const p=[B([L0,dy*R,dz*R]),B([L0+0.22,dy*R,dz*R]),B([L0,dy*(R+0.16),dz*(R+0.16)]),B([L0-0.04,dy*(R+0.16),dz*(R+0.16)])];g.fillStyle=col;g.globalAlpha=0.55;g.beginPath();g.moveTo(p[0][0],p[0][1]);for(const q of p.slice(1))g.lineTo(q[0],q[1]);g.closePath();g.fill();g.globalAlpha=1};
 fin(0,-1,'#ff7f0e');fin(1,0,'#1f77b4');fin(0,1,'#999');fin(-1,0,'#999');
 g.fillStyle='#333';g.fillText('nariz',tip[0]+4,tip[1]);
 // velocidad
 if(d.vn){const v=[d.vn[i],d.ve[i],d.vd[i]],s=Math.hypot(...v);if(s>0.3){const k=0.6/s,o=P([0,0,0]),p=P([v[0]*k,v[1]*k,v[2]*k]);line(o,p,'#2ca02c',2,[5,3]);g.fillStyle='#2ca02c';g.fillText('v '+s.toFixed(1)+' m/s',p[0]+3,p[1])}}
}

function drawPlots(d,i){
 const c=canvas('ek_plots');if(!c)return;const {g,w,h}=c;
 const plots=PLOTS.filter(p=>p.s.some(([k])=>d[k]&&d[k].length));
 const t=d.t,T0=t[0],T1=t[t.length-1];
 let ta,tb;if(!E.win||T1-T0<=E.win){ta=T0;tb=Math.max(T1,T0+1)}else{ta=E.cur-E.win*0.8;tb=ta+E.win;if(ta<T0){ta=T0;tb=T0+E.win}if(tb>T1&&!E.follow){tb=T1;ta=T1-E.win}if(E.follow){tb=T1;ta=T1-E.win}}
 const i0=Math.max(0,lower(t,ta)-1),i1=Math.min(t.length-1,lower(t,tb)+1);
 const gap=6,ph=(h-gap*(plots.length-1)-14)/plots.length,ML=46,MR=8,pw=w-ML-MR;
 E.plotRects=[];
 const X=x=>ML+(x-ta)/(tb-ta)*pw;
 plots.forEach((p,j)=>{
  const y0=j*(ph+gap),top=y0+14,hh=ph-16;
  E.plotRects.push({x:ML,w:pw,ta,tb});
  let lo=Infinity,hi=-Infinity;
  const ser=p.s.filter(([k])=>d[k]&&d[k].length);
  for(const [k] of ser){const a=d[k];for(let q=i0;q<=i1;q++){const v=a[q];if(v<lo)lo=v;if(v>hi)hi=v}}
  if(!isFinite(lo)){lo=0;hi=1}if(hi-lo<1e-6){lo-=0.5;hi+=0.5}const pad=(hi-lo)*0.08;lo-=pad;hi+=pad;
  const Y=v=>top+hh-(v-lo)/(hi-lo)*hh;
  g.fillStyle='#fafafa';g.fillRect(ML,top,pw,hh);g.strokeStyle='#ccc';g.lineWidth=1;g.strokeRect(ML,top,pw,hh);
  g.fillStyle='#222';g.fillText(p.title,ML,y0+10);
  let lx=ML+g.measureText(p.title).width+14;
  ser.forEach(([k,l0],s)=>{const l=typeof l0=='function'?l0(d):l0;g.fillStyle=COLORS[s];g.fillRect(lx,y0+3,10,3);g.fillText(l+' '+fmt(d[k][i],2),lx+13,y0+10);lx+=g.measureText(l+' '+fmt(d[k][i],2)).width+26});
  // eje y
  g.fillStyle='#666';for(let k=0;k<=2;k++){const v=lo+(hi-lo)*k/2;g.fillText(fmt(v,Math.abs(hi-lo)<10?2:0),2,Y(v)+4);g.strokeStyle='#eee';g.beginPath();g.moveTo(ML,Y(v));g.lineTo(ML+pw,Y(v));g.stroke()}
  // series, con a lo sumo ~2 puntos por pixel
  const stride=Math.max(1,Math.floor((i1-i0)/(pw*2)));
  g.save();g.beginPath();g.rect(ML,top,pw,hh);g.clip();
  ser.forEach(([k],s)=>{const a=d[k];g.strokeStyle=COLORS[s];g.lineWidth=1.2;g.beginPath();let pen=false,prev=NaN;
   for(let q=i0;q<=i1;q+=stride){const v=a[q];if(isNaN(v)){pen=false;continue}if(p.wrap&&Math.abs(v-prev)>180)pen=false;const x=X(t[q]),y=Y(v);pen?g.lineTo(x,y):g.moveTo(x,y);pen=true;prev=v}g.stroke()});
  g.restore();
  // cursor
  const xc=X(t[i]);g.strokeStyle='#000';g.lineWidth=1;g.beginPath();g.moveTo(xc,top);g.lineTo(xc,top+hh);g.stroke();
 });
 // eje de tiempo
 g.fillStyle='#666';const step=niceStep((tb-ta)/6);for(let x=Math.ceil(ta/step)*step;x<=tb;x+=step)g.fillText(tfmt(x),X(x)-14,h-2);
}
function niceStep(s){const p=Math.pow(10,Math.floor(Math.log10(s)));for(const m of [1,2,5,10])if(m*p>=s)return m*p;return 10*p}

function drawTrack(d,i){
 const c=canvas('ek_trk');if(!c)return;const {g,w,h}=c;
 const N=d.pn,Ea=d.pe;let mnN=Infinity,mxN=-Infinity,mnE=Infinity,mxE=-Infinity;
 for(let q=0;q<N.length;q++){const n=N[q],e=Ea[q];if(isNaN(n)||isNaN(e))continue;if(n<mnN)mnN=n;if(n>mxN)mxN=n;if(e<mnE)mnE=e;if(e>mxE)mxE=e}
 if(!isFinite(mnN)){g.fillStyle='#999';g.fillText('sin posicion (GNSS sin fix)',10,20);return}
 const span=Math.max(mxN-mnN,mxE-mnE,10)*1.1,s=Math.min(w,h)/span,cN=(mxN+mnN)/2,cE=(mxE+mnE)/2;
 const XY=(n,e)=>[w/2+(e-cE)*s,h/2-(n-cN)*s];
 if(E.osm&&E.ref)drawTiles(g,w,h,s,cN,cE);
 const stride=Math.max(1,Math.floor(N.length/4000));
 const path=(a,b,col,wid)=>{g.strokeStyle=col;g.lineWidth=wid;g.beginPath();let pen=false;for(let q=a;q<=b;q+=stride){if(isNaN(N[q])){pen=false;continue}const p=XY(N[q],Ea[q]);pen?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]);pen=true}g.stroke()};
 path(0,N.length-1,'#ccc',1);path(0,i,'#1f77b4',1.5);
 // escala
 const sb=niceStep(span/4),px=sb*s;g.strokeStyle='#333';g.lineWidth=2;g.beginPath();g.moveTo(10,h-12);g.lineTo(10+px,h-12);g.stroke();g.fillStyle='#333';g.fillText(sb>=1000?(sb/1000)+' km':sb+' m',12,h-16);
 g.fillStyle='#c33';g.fillText('N',w-14,14);
 let j=i;while(j>0&&isNaN(N[j]))j--;if(isNaN(N[j]))return;
 const p=XY(N[j],Ea[j]);g.fillStyle='#d62728';g.beginPath();g.arc(p[0],p[1],4,0,2*Math.PI);g.fill();
 if(d.naz){const a=d.naz[i]*D2R,L=22;g.strokeStyle='#d62728';g.lineWidth=2;g.beginPath();g.moveTo(p[0],p[1]);g.lineTo(p[0]+L*Math.sin(a),p[1]-L*Math.cos(a));g.stroke()}
}
// Teselas de OpenStreetMap bajo la trayectoria. El mapa local es N/E en metros desde E.ref; cada tesela se ubica por sus esquinas.
function drawTiles(g,w,h,s,cN,cE){
 const [lat0,lon0]=E.ref,k=D2R*6378137,kc=k*Math.cos(lat0*D2R);
 const nN=cN+h/2/s,sN=cN-h/2/s,wE=cE-w/2/s,eE=cE+w/2/s;                   // bordes de la vista en metros
 const latN=lat0+nN/k,latS=lat0+sN/k,lonW=lon0+wE/kc,lonE=lon0+eE/kc;
 const z=Math.max(3,Math.min(19,Math.floor(Math.log2(156543.03*Math.cos(lat0*D2R)*s))));
 const n2=Math.pow(2,z),tx=lon=>Math.floor((lon+180)/360*n2),ty=lat=>{const r=lat*D2R;return Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n2)};
 const lonOf=x=>x/n2*360-180,latOf=y=>Math.atan(Math.sinh(Math.PI*(1-2*y/n2)))*R2D;
 const x0=tx(lonW),x1=tx(lonE),y0=ty(latN),y1=ty(latS);if((x1-x0+1)*(y1-y0+1)>64)return;
 const XY=(lat,lon)=>[w/2+((lon-lon0)*kc-cE)*s,h/2-((lat-lat0)*k-cN)*s];
 g.globalAlpha=0.8;
 for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
  const key=z+'/'+x+'/'+y;let im=TILE_CACHE.get(key);
  if(!im){im=new Image();im.onload=()=>{E.dirty=true};im.onerror=()=>{im.bad=true};im.src='https://tile.openstreetmap.org/'+key+'.png';TILE_CACHE.set(key,im)}
  if(!im.complete||im.bad||!im.naturalWidth)continue;
  const a=XY(latOf(y),lonOf(x)),b=XY(latOf(y+1),lonOf(x+1));g.drawImage(im,a[0],a[1],b[0]-a[0],b[1]-a[1]);
 }
 g.globalAlpha=1;g.fillStyle='rgba(255,255,255,0.8)';g.fillRect(w-122,h-14,122,14);g.fillStyle='#555';g.fillText('© OpenStreetMap',w-118,h-3);
}
})();
