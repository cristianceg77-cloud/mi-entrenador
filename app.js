'use strict';
/* ============================================================
   MI ENTRENAMIENTO — app.js  v3.0
   + Progreso por día/semana/mes con % de cambio
   + Medidas corporales (piernas, glúteos, cintura, brazos, peso)
   + Objetivos con barra de progreso
   ============================================================ */

// ── Service Worker ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  });
}

// ── Storage Keys ─────────────────────────────────────────────
const KEY_WORKOUTS    = 'me_workouts';
const KEY_CONFIG      = 'me_config';
const KEY_THEME       = 'me_theme';
const KEY_MEASURES    = 'me_measures';   // array de snapshots de medidas
const KEY_GOALS       = 'me_goals';      // array de objetivos

// ── Temas ─────────────────────────────────────────────────────
const THEMES = {
  azul:    { name:'Azul',     bg:'#0a0f1e',bg2:'#0f1629',bg3:'#141d35',surface:'#1a2540',accent:'#4d9fff',accent2:'#00e5c0',text:'#e8edf8',textDim:'#7a8aaa',textMuted:'#4a5570' },
  verde:   { name:'Verde',    bg:'#0a1a10',bg2:'#0f2016',bg3:'#122518',surface:'#163020',accent:'#3ddc84',accent2:'#00ffcc',text:'#e2f5ea',textDim:'#7aaa88',textMuted:'#4a7055' },
  purpura: { name:'Púrpura',  bg:'#110a1e',bg2:'#160f29',bg3:'#1a1235',surface:'#221840',accent:'#a855f7',accent2:'#e879f9',text:'#f0e8f8',textDim:'#9a7aaa',textMuted:'#604a70' },
  rojo:    { name:'Rojo',     bg:'#1a0a0a',bg2:'#220f0f',bg3:'#2a1212',surface:'#351a1a',accent:'#ff5252',accent2:'#ff9800',text:'#f8e8e8',textDim:'#aa7a7a',textMuted:'#704a4a' },
  dorado:  { name:'Dorado',   bg:'#141008',bg2:'#1e180a',bg3:'#261f0c',surface:'#332a10',accent:'#f5c542',accent2:'#ff9500',text:'#f8f4e8',textDim:'#aaa07a',textMuted:'#70684a' },
  gris:    { name:'Gris',     bg:'#0f0f0f',bg2:'#161616',bg3:'#1c1c1c',surface:'#242424',accent:'#e0e0e0',accent2:'#9e9e9e',text:'#f5f5f5',textDim:'#9e9e9e',textMuted:'#616161' },
  cian:    { name:'Cian',     bg:'#050f14',bg2:'#08161e',bg3:'#0c1e28',surface:'#102433',accent:'#00bcd4',accent2:'#80deea',text:'#e0f7fa',textDim:'#7aaab8',textMuted:'#4a7080' },
  rosa:    { name:'Rosa',     bg:'#170a12',bg2:'#200f18',bg3:'#2a121f',surface:'#361828',accent:'#f06292',accent2:'#f48fb1',text:'#fce4ec',textDim:'#aa7a90',textMuted:'#704a5a' },
};

// ── Estado global ─────────────────────────────────────────────
let currentScreen  = 'screen-home';
let activeThemeKey = 'azul';
let progresoFiltro = 'semana'; // 'dia' | 'semana' | 'mes'

// ── Tema ──────────────────────────────────────────────────────
function applyTheme(key, custom) {
  const t = custom || THEMES[key] || THEMES.azul;
  const r = document.documentElement.style;
  r.setProperty('--bg',t.bg); r.setProperty('--bg2',t.bg2); r.setProperty('--bg3',t.bg3);
  r.setProperty('--surface',t.surface); r.setProperty('--accent',t.accent); r.setProperty('--accent2',t.accent2);
  r.setProperty('--text',t.text); r.setProperty('--text-dim',t.textDim); r.setProperty('--text-muted',t.textMuted);
  r.setProperty('--border',        hexToRgba(t.accent,0.12));
  r.setProperty('--border-strong', hexToRgba(t.accent,0.25));
  r.setProperty('--accent-dim',    darkenHex(t.accent,0.55));
  r.setProperty('--accent-glow',   hexToRgba(t.accent,0.18));
  activeThemeKey = custom ? '__custom__' : key;
  document.querySelectorAll('.theme-swatch').forEach(s =>
    s.classList.toggle('active', s.dataset.theme === activeThemeKey));
}
function hexToRgba(hex,a){ const[r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)); return `rgba(${r},${g},${b},${a})`; }
function darkenHex(hex,f){ return '#'+[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*f).toString(16).padStart(2,'0')).join(''); }
function blendColors(h1,h2,t){ return '#'+[1,3,5].map(i=>Math.round(parseInt(h1.slice(i,i+2),16)+(parseInt(h2.slice(i,i+2),16)-parseInt(h1.slice(i,i+2),16))*t).toString(16).padStart(2,'0')).join(''); }

// ── Navegación ────────────────────────────────────────────────
function goTo(id) {
  const cur=document.getElementById(currentScreen), nxt=document.getElementById(id);
  if(!nxt||id===currentScreen) return;
  cur.classList.add('exit-left'); cur.classList.remove('active');
  setTimeout(()=>{ cur.classList.remove('exit-left'); nxt.classList.add('active'); currentScreen=id; onEnter(id); },220);
}
function onEnter(id) {
  if(id==='screen-home')     renderHome();
  if(id==='screen-registro') renderLista();
  if(id==='screen-progreso') renderProgreso();
  if(id==='screen-medidas')  renderMedidas();
  if(id==='screen-objetivos')renderObjetivos();
  if(id==='screen-config')   renderConfig();
}

// ── Storage helpers ───────────────────────────────────────────
const getWS    = ()=>{ try{return JSON.parse(localStorage.getItem(KEY_WORKOUTS))||[];}catch{return[];} };
const saveWS   = a=>localStorage.setItem(KEY_WORKOUTS,JSON.stringify(a));
const getCfg   = ()=>{ try{return JSON.parse(localStorage.getItem(KEY_CONFIG))||{};}catch{return {};} };
const saveCfg  = o=>localStorage.setItem(KEY_CONFIG,JSON.stringify(o));
const getMeds  = ()=>{ try{return JSON.parse(localStorage.getItem(KEY_MEASURES))||[];}catch{return[];} };
const saveMeds = a=>localStorage.setItem(KEY_MEASURES,JSON.stringify(a));
const getGoals = ()=>{ try{return JSON.parse(localStorage.getItem(KEY_GOALS))||[];}catch{return[];} };
const saveGoals= a=>localStorage.setItem(KEY_GOALS,JSON.stringify(a));

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', ()=>{
  // tipo ejercicio custom
  document.getElementById('reg-tipo').addEventListener('change',function(){
    document.getElementById('reg-tipo-custom').classList.toggle('hidden',this.value!=='__otro__');
    if(this.value==='__otro__') document.getElementById('reg-tipo-custom').focus();
  });
  // Cargar tema
  try{
    const t=JSON.parse(localStorage.getItem(KEY_THEME));
    if(t){ if(t.key&&t.key!=='__custom__') applyTheme(t.key); else if(t.custom) applyTheme(null,t.custom); }
  }catch{}
  buildThemeSwatches();
  renderHome();
});

// ── HOME ──────────────────────────────────────────────────────
function renderHome() {
  const cfg=getCfg(), ws=getWS();
  const el=document.getElementById('home-greeting');
  if(cfg.nombre){ el.textContent=`Hola, ${cfg.nombre}`; }
  else{ const h=new Date().getHours(); el.textContent=h<12?'Buenos d\u00edas, Atleta':h<19?'Buenas tardes, Atleta':'Buenas noches, Atleta'; }

  const badge=document.getElementById('home-trainer-badge');
  if(cfg.trainer&&cfg.trainer.trim()){
    badge.style.display='flex';
    document.getElementById('home-trainer-name').textContent=cfg.trainer.trim();
    const pts=cfg.trainer.trim().split(' ').filter(Boolean);
    document.getElementById('home-trainer-avatar').textContent=(pts.length>=2?pts[0][0]+pts[pts.length-1][0]:cfg.trainer.trim().slice(0,2)).toUpperCase();
  } else badge.style.display='none';

  document.getElementById('stat-total').textContent=ws.length;
  document.getElementById('stat-week').textContent=wsThisWeek(ws);
  const mx=ws.reduce((m,w)=>Math.max(m,parseFloat(w.peso)||0),0);
  document.getElementById('stat-kg').textContent=mx||0;
}
function wsThisWeek(ws){ const s=new Date();s.setDate(s.getDate()-s.getDay());s.setHours(0,0,0,0);return ws.filter(w=>new Date(w.fecha)>=s).length; }

// ── REGISTRO ─────────────────────────────────────────────────
function guardarEntrenamiento() {
  const sv=document.getElementById('reg-tipo').value;
  const tipo=sv==='__otro__'?document.getElementById('reg-tipo-custom').value.trim():sv;
  const series=document.getElementById('reg-series').value.trim();
  const reps  =document.getElementById('reg-reps').value.trim();
  const peso  =document.getElementById('reg-peso').value.trim();
  const notas =document.getElementById('reg-notas').value.trim();
  const fb=document.getElementById('reg-feedback');
  if(!tipo){showFeedback(fb,'Eleg\u00ed o escrib\u00ed un ejercicio.','err');return;}
  if(!series||!reps){showFeedback(fb,'Complet\u00e1 series y repeticiones.','err');return;}
  const w={id:Date.now(),fecha:new Date().toISOString(),tipo,series:+series,reps:+reps,peso:parseFloat(peso)||0,notas};
  const all=getWS();all.unshift(w);saveWS(all);
  document.getElementById('reg-tipo').value='';
  document.getElementById('reg-tipo-custom').classList.add('hidden');
  ['reg-tipo-custom','reg-series','reg-reps','reg-peso','reg-notas'].forEach(id=>document.getElementById(id).value='');
  showFeedback(fb,'\u2713 Sesi\u00f3n guardada','ok');
  renderLista();
}

function renderLista() {
  const c=document.getElementById('lista-entrenamientos'), ws=getWS();
  if(!ws.length){c.innerHTML='<div class="empty-state">A\u00fan no hay sesiones.<br/>\u00a1Empez\u00e1 hoy!</div>';return;}
  c.innerHTML=ws.slice(0,20).map(w=>{
    const d=new Date(w.fecha);
    const ds=d.toLocaleDateString('es-AR',{day:'2-digit',month:'short'});
    const ts=d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
    const ps=w.peso>0?` \u00b7 ${w.peso}kg`:'';
    return `<div class="workout-item"><div class="workout-item-body"><div class="workout-item-name">${esc(w.tipo)}</div><div class="workout-item-meta">${w.series}s \u00d7 ${w.reps}r${ps}</div>${w.notas?`<div class="workout-item-note">${esc(w.notas)}</div>`:''}</div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><span class="workout-item-date">${ds}<br/>${ts}</span><button class="workout-delete" onclick="deleteWorkout(${w.id})">\u2715</button></div></div>`;
  }).join('');
}
function deleteWorkout(id){saveWS(getWS().filter(w=>w.id!==id));renderLista();}

// ── PROGRESO ─────────────────────────────────────────────────
function setProgresoFiltro(f){
  progresoFiltro=f;
  document.querySelectorAll('.filtro-btn').forEach(b=>b.classList.toggle('active',b.dataset.f===f));
  renderProgreso();
}

function renderProgreso() {
  const ws=getWS();
  // Totales
  document.getElementById('prog-total').textContent=ws.length;
  document.getElementById('prog-week').textContent=wsThisWeek(ws);

  // Gráfico de actividad según filtro
  renderActividadChart(ws);
  // Peso máximo + variación %
  renderPesoChart(ws);
  // Lista de sesiones filtradas
  renderSesionesFiltradas(ws);
}

function getFilterRange(filtro) {
  const now=new Date(), ranges=[];
  if(filtro==='dia'){
    for(let i=6;i>=0;i--){
      const s=new Date(now); s.setDate(now.getDate()-i); s.setHours(0,0,0,0);
      const e=new Date(s); e.setDate(s.getDate()+1);
      ranges.push({label:s.toLocaleDateString('es-AR',{weekday:'short',day:'numeric'}).replace('.',':'),start:s,end:e});
    }
  } else if(filtro==='semana'){
    for(let i=3;i>=0;i--){
      const s=new Date(now); s.setDate(now.getDate()-now.getDay()-i*7); s.setHours(0,0,0,0);
      const e=new Date(s); e.setDate(s.getDate()+7);
      const lbl=`S${4-i} ${s.toLocaleDateString('es-AR',{day:'2-digit',month:'short'})}`;
      ranges.push({label:lbl,start:s,end:e});
    }
  } else { // mes
    for(let i=2;i>=0;i--){
      const s=new Date(now.getFullYear(),now.getMonth()-i,1);
      const e=new Date(now.getFullYear(),now.getMonth()-i+1,1);
      ranges.push({label:s.toLocaleDateString('es-AR',{month:'short',year:'2-digit'}),start:s,end:e});
    }
  }
  return ranges;
}

function renderActividadChart(ws){
  const c=document.getElementById('bar-chart');
  const ranges=getFilterRange(progresoFiltro);
  const counts=ranges.map(r=>ws.filter(w=>{const d=new Date(w.fecha);return d>=r.start&&d<r.end;}).length);
  const mx=Math.max(...counts,1);
  const today=new Date(); today.setHours(0,0,0,0);
  c.innerHTML=counts.map((v,i)=>{
    const isNow=today>=ranges[i].start&&today<ranges[i].end;
    return `<div class="bar-col"><span class="bar-num">${v||''}</span><div class="bar-fill-wrap"><div class="bar-fill${isNow?' today':''}" style="height:${Math.round(v/mx*100)}%"></div></div><span class="bar-label">${ranges[i].label}</span></div>`;
  }).join('');
}

function renderPesoChart(ws){
  const c=document.getElementById('peso-chart');
  if(!ws.length){c.innerHTML='<div class="empty-state" style="padding:16px">Sin datos a\u00fan</div>';return;}

  // Agrupar por ejercicio: peso máx + variación vs período anterior
  const ranges=getFilterRange(progresoFiltro);
  const cur=ranges[ranges.length-1], prev=ranges.length>=2?ranges[ranges.length-2]:null;

  const pesoMap={}, prevMap={};
  ws.forEach(w=>{
    if(w.peso>0){
      const d=new Date(w.fecha);
      if(d>=cur.start&&d<cur.end) pesoMap[w.tipo]=Math.max(pesoMap[w.tipo]||0,w.peso);
      if(prev&&d>=prev.start&&d<prev.end) prevMap[w.tipo]=Math.max(prevMap[w.tipo]||0,w.peso);
    }
  });

  const sorted=Object.entries(pesoMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
  if(!sorted.length){c.innerHTML='<div class="empty-state" style="padding:16px">Sin ejercicios con peso en este per\u00edodo</div>';return;}
  const mx=sorted[0][1];

  c.innerHTML=sorted.map(([name,kg])=>{
    const prev=prevMap[name]||0;
    let badge='';
    if(prev>0){
      const pct=((kg-prev)/prev*100);
      const sign=pct>=0?'+':'';
      const col=pct>0?'var(--accent2)':pct<0?'var(--danger)':'var(--text-muted)';
      badge=`<span class="pct-badge" style="color:${col}">${sign}${pct.toFixed(1)}%</span>`;
    }
    return `<div class="hbar-row"><div style="display:flex;justify-content:space-between;align-items:center"><span class="hbar-label">${esc(name)}</span>${badge}</div><div class="hbar-track"><div class="hbar-fill" style="width:${Math.round(kg/mx*100)}%"><span>${kg}kg</span></div></div></div>`;
  }).join('');
}

function renderSesionesFiltradas(ws){
  const c=document.getElementById('sesiones-filtradas');
  const ranges=getFilterRange(progresoFiltro);
  const cur=ranges[ranges.length-1];
  const filtered=ws.filter(w=>{const d=new Date(w.fecha);return d>=cur.start&&d<cur.end;});
  const agrupado={};
  filtered.forEach(w=>{
    const key=new Date(w.fecha).toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
    if(!agrupado[key]) agrupado[key]=[];
    agrupado[key].push(w);
  });
  if(!Object.keys(agrupado).length){
    c.innerHTML='<div class="empty-state">Sin sesiones en este per\u00edodo</div>';
    return;
  }
  c.innerHTML=Object.entries(agrupado).map(([fecha,items])=>`
    <div class="day-group">
      <div class="day-group-header">${fecha}</div>
      ${items.map(w=>`<div class="workout-item compact"><div class="workout-item-body"><div class="workout-item-name">${esc(w.tipo)}</div><div class="workout-item-meta">${w.series}s \u00d7 ${w.reps}r${w.peso>0?` \u00b7 ${w.peso}kg`:''}</div></div></div>`).join('')}
    </div>`).join('');
}

// ── MEDIDAS CORPORALES ────────────────────────────────────────
function renderMedidas(){
  const meds=getMeds();
  renderMedidaHistorial(meds);
  renderMedidaCharts(meds);
}

function guardarMedida(){
  const campos=['pierna-izq','pierna-der','gluteos','cintura','brazo-izq','brazo-der','peso-corporal'];
  const vals={};
  campos.forEach(c=>{
    const v=parseFloat(document.getElementById('med-'+c).value);
    if(!isNaN(v)&&v>0) vals[c]=v;
  });
  if(!Object.keys(vals).length){
    showFeedback(document.getElementById('med-feedback'),'Ingres\u00e1 al menos una medida.','err');
    return;
  }
  const snapshot={id:Date.now(),fecha:new Date().toISOString(),...vals};
  const all=getMeds(); all.unshift(snapshot); saveMeds(all);
  campos.forEach(c=>document.getElementById('med-'+c).value='');
  showFeedback(document.getElementById('med-feedback'),'\u2713 Medidas guardadas','ok');
  renderMedidas();
}

function renderMedidaHistorial(meds){
  const c=document.getElementById('medida-historial');
  if(!meds.length){c.innerHTML='<div class="empty-state">A\u00fan no hay medidas registradas.</div>';return;}

  const campos=[
    {key:'peso-corporal',  label:'Peso',         unit:'kg'},
    {key:'cintura',        label:'Cintura',       unit:'cm'},
    {key:'gluteos',        label:'Gl\u00fateos',  unit:'cm'},
    {key:'pierna-izq',     label:'Pierna Izq.',   unit:'cm'},
    {key:'pierna-der',     label:'Pierna Der.',   unit:'cm'},
    {key:'brazo-izq',      label:'Brazo Izq.',    unit:'cm'},
    {key:'brazo-der',      label:'Brazo Der.',    unit:'cm'},
  ];

  // Última medida + comparación con anterior
  const last=meds[0], prev=meds[1]||null;
  const cards=campos.map(({key,label,unit})=>{
    if(last[key]===undefined) return '';
    let delta='';
    if(prev&&prev[key]!==undefined){
      const d=(last[key]-prev[key]);
      const sign=d>=0?'+':'';
      const pct=prev[key]!==0?((d/prev[key])*100).toFixed(1):null;
      const col=d<0?'var(--accent2)':d>0?'var(--danger)':'var(--text-muted)'; // bajar es bueno para peso/cintura
      delta=`<span class="medida-delta" style="color:${col}">${sign}${d.toFixed(1)} ${unit}${pct?` (${sign}${pct}%)`:''}</span>`;
    }
    return `<div class="medida-card"><span class="medida-label">${label}</span><span class="medida-val">${last[key]} <span class="medida-unit">${unit}</span></span>${delta}</div>`;
  }).filter(Boolean).join('');

  const fecha=new Date(last.fecha).toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric'});

  c.innerHTML=`<div class="medida-fecha">\u00daltimo registro: ${fecha}</div><div class="medida-grid">${cards}</div>`;
}

function renderMedidaCharts(meds){
  const c=document.getElementById('medida-charts');
  if(meds.length<2){c.innerHTML='<div class="empty-state">Registr\u00e1 al menos 2 medidas para ver evoluci\u00f3n.</div>';return;}

  const campos=[
    {key:'peso-corporal',label:'Peso (kg)'},
    {key:'cintura',      label:'Cintura (cm)'},
    {key:'gluteos',      label:'Gl\u00fateos (cm)'},
    {key:'pierna-izq',   label:'Pierna Izq. (cm)'},
    {key:'brazo-izq',    label:'Brazo Izq. (cm)'},
  ];

  const ordered=[...meds].reverse(); // cronológico

  c.innerHTML=campos.map(({key,label})=>{
    const data=ordered.filter(m=>m[key]!==undefined).map(m=>({v:m[key],f:new Date(m.fecha).toLocaleDateString('es-AR',{day:'2-digit',month:'short'})}));
    if(data.length<2) return '';
    const mn=Math.min(...data.map(d=>d.v));
    const mx=Math.max(...data.map(d=>d.v));
    const range=mx-mn||1;
    const first=data[0].v, last=data[data.length-1].v;
    const totalDelta=last-first, sign=totalDelta>=0?'+':'';
    const pct=first!==0?((totalDelta/first)*100).toFixed(1):null;
    const col=totalDelta<0?'var(--accent2)':totalDelta>0?'var(--danger)':'var(--text-muted)';
    const points=data.map((d,i)=>{
      const x=data.length<2?50:Math.round(i/(data.length-1)*100);
      const y=100-Math.round((d.v-mn)/range*80)-10;
      return `${x},${y}`;
    }).join(' ');
    const dots=data.map((d,i)=>{
      const x=data.length<2?50:Math.round(i/(data.length-1)*100);
      const y=100-Math.round((d.v-mn)/range*80)-10;
      return `<circle cx="${x}" cy="${y}" r="3" fill="var(--accent)"><title>${d.f}: ${d.v}</title></circle>`;
    }).join('');
    return `<div class="mevol-card">
      <div class="mevol-header"><span class="mevol-label">${label}</span><span class="mevol-delta" style="color:${col}">${sign}${totalDelta.toFixed(1)}${pct?` (${sign}${pct}%)`:''}</span></div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="mevol-svg">
        <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>
        <polyline points="0,100 ${points} 100,100" fill="var(--accent-glow)" stroke="none"/>
        ${dots}
      </svg>
      <div class="mevol-range"><span>${mn}</span><span>${mx}</span></div>
    </div>`;
  }).filter(Boolean).join('');
  if(!c.innerHTML) c.innerHTML='<div class="empty-state">Sin suficientes datos para gr\u00e1ficos.</div>';
}

function deleteMedida(id){
  saveMeds(getMeds().filter(m=>m.id!==id));
  renderMedidas();
}

// ── OBJETIVOS ─────────────────────────────────────────────────
function renderObjetivos(){
  const goals=getGoals();
  const c=document.getElementById('goals-list');
  if(!goals.length){
    c.innerHTML='<div class="empty-state">No hay objetivos todav\u00eda.\u00a1Cre\u00e1 el primero!</div>';
    return;
  }
  c.innerHTML=goals.map(g=>{
    const pct=g.meta>0?Math.min(100,Math.round((g.actual/g.meta)*100)):0;
    const col=pct>=100?'var(--accent2)':pct>=60?'var(--accent)':'var(--text-muted)';
    const badge=pct>=100?'<span class="goal-done-badge">\u2713 Logrado!</span>':'';
    return `<div class="goal-card">
      <div class="goal-card-header">
        <div>
          <div class="goal-card-title">${esc(g.nombre)}</div>
          <div class="goal-card-meta">${g.tipo==='peso'?'Peso (kg)':g.tipo==='medida'?`Medida: ${esc(g.medida||'')}`:g.tipo==='sesiones'?'Sesiones':'Ejercicio'} ${g.ejercicio?'· '+esc(g.ejercicio):''}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${badge}
          <button class="workout-delete" onclick="deleteGoal(${g.id})">\u2715</button>
        </div>
      </div>
      <div class="goal-progress-row">
        <div class="goal-progress-track">
          <div class="goal-progress-fill" style="width:${pct}%;background:${col}"></div>
        </div>
        <span class="goal-progress-pct" style="color:${col}">${pct}%</span>
      </div>
      <div class="goal-vals">
        <span class="goal-val-current" onclick="openUpdateGoal(${g.id})">${g.actual} <span class="goal-val-unit">${g.unidad||''}</span></span>
        <span class="goal-val-sep">\u2192</span>
        <span class="goal-val-meta">${g.meta} <span class="goal-val-unit">${g.unidad||''}</span></span>
      </div>
      ${g.notas?`<div class="goal-notes">${esc(g.notas)}</div>`:''}
    </div>`;
  }).join('');
}

function guardarObjetivo(){
  const nombre  =document.getElementById('goal-nombre').value.trim();
  const tipo    =document.getElementById('goal-tipo').value;
  const meta    =parseFloat(document.getElementById('goal-meta').value);
  const actual  =parseFloat(document.getElementById('goal-actual').value)||0;
  const unidad  =document.getElementById('goal-unidad').value.trim();
  const ejercicio=document.getElementById('goal-ejercicio').value.trim();
  const notas   =document.getElementById('goal-notas').value.trim();
  const fb=document.getElementById('goal-feedback');
  if(!nombre){showFeedback(fb,'Ingres\u00e1 un nombre para el objetivo.','err');return;}
  if(isNaN(meta)||meta<=0){showFeedback(fb,'Ingres\u00e1 una meta v\u00e1lida.','err');return;}
  const g={id:Date.now(),nombre,tipo,meta,actual,unidad,ejercicio,notas};
  const all=getGoals();all.push(g);saveGoals(all);
  ['goal-nombre','goal-meta','goal-actual','goal-unidad','goal-ejercicio','goal-notas'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('goal-tipo').value='sesiones';
  showFeedback(fb,'\u2713 Objetivo creado','ok');
  renderObjetivos();
}

function openUpdateGoal(id){
  const g=getGoals().find(x=>x.id===id);
  if(!g) return;
  document.getElementById('modal-upd-title').textContent=`Actualizar: ${g.nombre}`;
  document.getElementById('modal-upd-actual').value=g.actual;
  document.getElementById('modal-upd-id').value=id;
  document.getElementById('modal-upd-meta').textContent=`Meta: ${g.meta} ${g.unidad||''}`;
  document.getElementById('modal-update-goal').classList.remove('hidden');
}
function saveUpdateGoal(){
  const id=+document.getElementById('modal-upd-id').value;
  const val=parseFloat(document.getElementById('modal-upd-actual').value);
  if(isNaN(val)){return;}
  const all=getGoals().map(g=>g.id===id?{...g,actual:val}:g);
  saveGoals(all);
  cerrarModal();
  renderObjetivos();
}
function deleteGoal(id){saveGoals(getGoals().filter(g=>g.id!==id));renderObjetivos();}

// ── CONFIGURACIÓN ─────────────────────────────────────────────
function renderConfig(){
  const cfg=getCfg();
  document.getElementById('cfg-nombre').value =cfg.nombre ||'';
  document.getElementById('cfg-trainer').value=cfg.trainer||'';
  document.querySelectorAll('.goal-btn').forEach(b=>b.classList.toggle('selected',b.dataset.val===cfg.objetivo));
  document.querySelectorAll('.day-btn').forEach(b=>b.classList.toggle('selected',String(b.dataset.val)===String(cfg.dias)));
  updateDataStats();
  syncCustomColorPickers();
}
function selectGoal(btn){document.querySelectorAll('.goal-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');}
function selectDays(btn){document.querySelectorAll('.day-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');}
function guardarConfig(){
  const nombre  =document.getElementById('cfg-nombre').value.trim();
  const trainer =document.getElementById('cfg-trainer').value.trim();
  const objetivo=document.querySelector('.goal-btn.selected')?.dataset.val||'';
  const dias    =document.querySelector('.day-btn.selected')?.dataset.val||'';
  saveCfg({nombre,trainer,objetivo,dias});
  showFeedback(document.getElementById('cfg-feedback'),'\u2713 Configuraci\u00f3n guardada','ok');
}
function updateDataStats(){
  const ws=getWS();
  document.getElementById('ds-total').textContent=ws.length;
  document.getElementById('ds-size').textContent=formatBytes(JSON.stringify(ws).length+JSON.stringify(getMeds()).length);
  document.getElementById('ds-first').textContent=ws.length?new Date(ws[ws.length-1].fecha).toLocaleDateString('es-AR'):'\u2014';
}
function formatBytes(b){return b<1024?b+'B':(b/1024).toFixed(1)+'KB';}

// ── TEMAS ─────────────────────────────────────────────────────
function buildThemeSwatches(){
  const g=document.getElementById('theme-grid');
  if(!g) return;
  g.innerHTML=Object.entries(THEMES).map(([k,t])=>`<div class="theme-swatch${activeThemeKey===k?' active':''}" data-theme="${k}" style="background:linear-gradient(135deg,${t.bg} 0%,${t.surface} 50%,${t.accent} 100%)" onclick="selectTheme('${k}')"><span class="theme-name">${t.name}</span></div>`).join('');
}
function selectTheme(k){applyTheme(k);saveTheme(k,null);syncCustomColorPickers();}
function saveTheme(k,c){localStorage.setItem(KEY_THEME,JSON.stringify(c?{key:'__custom__',custom:c}:{key:k}));}
function syncCustomColorPickers(){
  const s=getComputedStyle(document.documentElement);
  const get=v=>{const c=s.getPropertyValue(v).trim();return c.startsWith('#')?c:rgbaToHex(c);};
  ['bg','surface','accent','accent2','text'].forEach(n=>setPickerVal('cp-'+n,get('--'+n)));
}
function setPickerVal(id,val){const el=document.getElementById(id);if(el&&val&&val.startsWith('#')&&val.length>=7)el.value=val.slice(0,7);}
function rgbaToHex(rgba){const m=rgba.match(/\d+/g);if(!m||m.length<3)return '#888888';return '#'+[m[0],m[1],m[2]].map(n=>parseInt(n).toString(16).padStart(2,'0')).join('');}
function applyCustomColors(){
  const bg=document.getElementById('cp-bg').value;
  const surface=document.getElementById('cp-surface').value;
  const accent=document.getElementById('cp-accent').value;
  const accent2=document.getElementById('cp-accent2').value;
  const text=document.getElementById('cp-text').value;
  const cc={bg,bg2:blendColors(bg,'#ffffff',0.04),bg3:blendColors(bg,'#ffffff',0.08),surface,accent,accent2,text,textDim:blendColors(text,bg,0.45),textMuted:blendColors(text,bg,0.25)};
  applyTheme('__custom__',cc);saveTheme('__custom__',cc);
  document.querySelectorAll('.theme-swatch').forEach(s=>s.classList.remove('active'));
  showFeedback(document.getElementById('cfg-feedback'),'\u2713 Colores aplicados','ok');
}

// ── EXPORT / IMPORT ───────────────────────────────────────────
function exportData(){
  const payload={_version:3,_app:'Mi Entrenamiento',_exported:new Date().toISOString(),
    config:getCfg(),theme:JSON.parse(localStorage.getItem(KEY_THEME)||'null'),
    workouts:getWS(),measures:getMeds(),goals:getGoals()};
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  a.download=`mi-entrenamiento-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  showFeedback(document.getElementById('cfg-feedback'),`\u2713 Exportado (${getWS().length} sesiones, ${getMeds().length} medidas, ${getGoals().length} objetivos)`,'ok');
}
function triggerImport(){document.getElementById('import-file-input').click();}
function handleImport(event){
  const file=event.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const d=JSON.parse(e.target.result);
      if(!d.workouts||!Array.isArray(d.workouts)){openInfoModal('\u26a0\ufe0f Archivo inv\u00e1lido','No contiene entrenamientos v\u00e1lidos.');return;}
      const ex=getWS(), exIds=new Set(ex.map(w=>w.id));
      const newW=d.workouts.filter(w=>!exIds.has(w.id));
      saveWS([...newW,...ex]);
      if(d.measures&&Array.isArray(d.measures)){
        const exM=getMeds(),exMIds=new Set(exM.map(m=>m.id));
        saveMeds([...d.measures.filter(m=>!exMIds.has(m.id)),...exM]);
      }
      if(d.goals&&Array.isArray(d.goals)){
        const exG=getGoals(),exGIds=new Set(exG.map(g=>g.id));
        saveGoals([...d.goals.filter(g=>!exGIds.has(g.id)),...exG]);
      }
      if(d.config) saveCfg(d.config);
      if(d.theme){localStorage.setItem(KEY_THEME,JSON.stringify(d.theme));if(d.theme.key&&d.theme.key!=='__custom__')applyTheme(d.theme.key);else if(d.theme.custom)applyTheme(null,d.theme.custom);buildThemeSwatches();}
      updateDataStats();renderConfig();
      openInfoModal('\u2713 Importaci\u00f3n exitosa',`${newW.length} sesiones nuevas importadas.`);
    }catch{openInfoModal('\u26a0\ufe0f Error','El archivo no es v\u00e1lido.');}
    event.target.value='';
  };
  reader.readAsText(file);
}

// ── DEMO DATA ─────────────────────────────────────────────────
function cargarDemoData(){
  const ejs=['Press de banca','Sentadilla','Peso muerto','Press militar','Dominadas','Remo con barra','Curl de b\u00edceps','Hip thrust'];
  const notas=['Buena sesi\u00f3n!','Aument\u00e9 2.5kg.','Algo cansado pero lo hice.','','Mejor t\u00e9cnica.','Nuevo r\u00e9cord!',''];
  const bases={'Press de banca':70,'Sentadilla':90,'Peso muerto':100,'Press militar':50,'Dominadas':0,'Remo con barra':65,'Curl de b\u00edceps':25,'Hip thrust':80};
  const now=new Date(), demos=[];
  for(let day=27;day>=0;day--){
    if([0,3].includes(day%7)) continue;
    const d=new Date(now);d.setDate(now.getDate()-day);d.setHours(8+Math.floor(Math.random()*3),Math.floor(Math.random()*50),0,0);
    [...ejs].sort(()=>Math.random()-0.5).slice(0,3+Math.floor(Math.random()*2)).forEach((ej,i)=>{
      const bw=bases[ej]||40, prog=Math.max(0,(27-day)*0.4), rv=(Math.random()-0.5)*5;
      demos.push({id:now.getTime()-day*86400000-i*1000,fecha:new Date(d.getTime()+i*300000).toISOString(),tipo:ej,series:3+Math.floor(Math.random()*2),reps:6+Math.floor(Math.random()*7),peso:bw>0?Math.round((bw+prog+rv)*2)/2:0,notas:notas[Math.floor(Math.random()*notas.length)]});
    });
  }
  // Demo medidas (1 por semana, 4 semanas)
  const demoMeds=[];
  const baseMed={peso:80,cintura:85,'pierna-izq':55,'pierna-der':55,'gluteos':100,'brazo-izq':35,'brazo-der':35};
  for(let w=3;w>=0;w--){
    const d=new Date(now);d.setDate(now.getDate()-w*7);
    const factor=w*0.3;
    demoMeds.push({id:now.getTime()-w*604800000-1,fecha:d.toISOString(),'peso-corporal':+(baseMed.peso-factor*0.8+(Math.random()-0.5)*0.3).toFixed(1),cintura:+(baseMed.cintura-factor*0.5+(Math.random()-0.5)*0.2).toFixed(1),'pierna-izq':+(baseMed['pierna-izq']+factor*0.2+(Math.random()-0.5)*0.2).toFixed(1),'pierna-der':+(baseMed['pierna-der']+factor*0.2+(Math.random()-0.5)*0.2).toFixed(1),gluteos:+(baseMed.gluteos+factor*0.3+(Math.random()-0.5)*0.2).toFixed(1),'brazo-izq':+(baseMed['brazo-izq']+factor*0.15+(Math.random()-0.5)*0.1).toFixed(1),'brazo-der':+(baseMed['brazo-der']+factor*0.15+(Math.random()-0.5)*0.1).toFixed(1)});
  }
  // Demo objetivos
  const demoGoals=[
    {id:1,nombre:'Peso objetivo',tipo:'peso',meta:75,actual:79.1,unidad:'kg',ejercicio:'',notas:'Bajar 5kg en 3 meses'},
    {id:2,nombre:'Press de banca',tipo:'ejercicio',meta:100,actual:82.5,unidad:'kg',ejercicio:'Press de banca',notas:'Llegar a 100kg'},
    {id:3,nombre:'Sesiones del mes',tipo:'sesiones',meta:20,actual:wsThisWeek(demos)*4,unidad:'sesiones',ejercicio:'',notas:''},
    {id:4,nombre:'Cintura objetivo',tipo:'medida',meta:80,actual:83.5,unidad:'cm',medida:'cintura',notas:'Reducir 5cm'},
  ];

  const exWs=getWS(),exIds=new Set(exWs.map(w=>w.id));
  const newW=demos.filter(w=>!exIds.has(w.id));
  saveWS([...newW,...exWs]);
  const exMs=getMeds(),exMIds=new Set(exMs.map(m=>m.id));
  saveMeds([...demoMeds.filter(m=>!exMIds.has(m.id)),...exMs]);
  const exGs=getGoals(),exGIds=new Set(exGs.map(g=>g.id));
  saveGoals([...demoGoals.filter(g=>!exGIds.has(g.id)),...exGs]);
  if(!getCfg().nombre) saveCfg({nombre:'Demo Atleta',trainer:'Prof. Martín López',objetivo:'masa',dias:'4'});
  updateDataStats();renderHome();
  openInfoModal('\u2705 Datos de prueba cargados',`Se agregaron <strong>${newW.length} sesiones</strong>, <strong>${demoMeds.length} medidas</strong> y <strong>${demoGoals.length} objetivos</strong> de ejemplo.`);
}

// ── MODALES ───────────────────────────────────────────────────
function confirmarBorrado(){document.getElementById('modal-overlay').classList.remove('hidden');}
function cerrarModal(){
  ['modal-overlay','modal-info','modal-update-goal'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.classList.add('hidden');
  });
}
function borrarTodo(){saveWS([]);cerrarModal();renderProgreso();updateDataStats();}
function openInfoModal(title,html){
  document.getElementById('modal-info-title').textContent=title;
  document.getElementById('modal-info-body').innerHTML=html;
  document.getElementById('modal-info').classList.remove('hidden');
}

// ── Utils ─────────────────────────────────────────────────────
function showFeedback(el,msg,type){
  if(!el) return;
  el.textContent=msg;el.className=`feedback ${type}`;el.classList.remove('hidden');
  clearTimeout(el._t);el._t=setTimeout(()=>el.classList.add('hidden'),3000);
}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
