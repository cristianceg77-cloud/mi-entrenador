'use strict';

/* ============================================================
   MI ENTRENAMIENTO — app.js  v2.0
   Novedades: temas de color, export JSON, import JSON, datos demo
   ============================================================ */

// ── Service Worker ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(r => console.log('[SW] ok:', r.scope))
      .catch(e => console.warn('[SW] err:', e));
  });
}

// ── Keys ─────────────────────────────────────────────────────
const KEY_WORKOUTS = 'me_workouts';
const KEY_CONFIG   = 'me_config';
const KEY_THEME    = 'me_theme';

// ── Temas predefinidos ────────────────────────────────────────
const THEMES = {
  azul: {
    name: 'Azul',
    bg: '#0a0f1e', bg2: '#0f1629', bg3: '#141d35',
    surface: '#1a2540', accent: '#4d9fff', accent2: '#00e5c0',
    text: '#e8edf8', textDim: '#7a8aaa', textMuted: '#4a5570',
  },
  verde: {
    name: 'Verde',
    bg: '#0a1a10', bg2: '#0f2016', bg3: '#122518',
    surface: '#163020', accent: '#3ddc84', accent2: '#00ffcc',
    text: '#e2f5ea', textDim: '#7aaa88', textMuted: '#4a7055',
  },
  purpura: {
    name: 'Púrpura',
    bg: '#110a1e', bg2: '#160f29', bg3: '#1a1235',
    surface: '#221840', accent: '#a855f7', accent2: '#e879f9',
    text: '#f0e8f8', textDim: '#9a7aaa', textMuted: '#604a70',
  },
  rojo: {
    name: 'Rojo',
    bg: '#1a0a0a', bg2: '#220f0f', bg3: '#2a1212',
    surface: '#351a1a', accent: '#ff5252', accent2: '#ff9800',
    text: '#f8e8e8', textDim: '#aa7a7a', textMuted: '#704a4a',
  },
  dorado: {
    name: 'Dorado',
    bg: '#141008', bg2: '#1e180a', bg3: '#261f0c',
    surface: '#332a10', accent: '#f5c542', accent2: '#ff9500',
    text: '#f8f4e8', textDim: '#aaa07a', textMuted: '#70684a',
  },
  gris: {
    name: 'Gris',
    bg: '#0f0f0f', bg2: '#161616', bg3: '#1c1c1c',
    surface: '#242424', accent: '#e0e0e0', accent2: '#9e9e9e',
    text: '#f5f5f5', textDim: '#9e9e9e', textMuted: '#616161',
  },
  cian: {
    name: 'Cian',
    bg: '#050f14', bg2: '#08161e', bg3: '#0c1e28',
    surface: '#102433', accent: '#00bcd4', accent2: '#80deea',
    text: '#e0f7fa', textDim: '#7aaab8', textMuted: '#4a7080',
  },
  rosa: {
    name: 'Rosa',
    bg: '#170a12', bg2: '#200f18', bg3: '#2a121f',
    surface: '#361828', accent: '#f06292', accent2: '#f48fb1',
    text: '#fce4ec', textDim: '#aa7a90', textMuted: '#704a5a',
  },
};

// ── Estado ────────────────────────────────────────────────────
let currentScreen = 'screen-home';
let activeThemeKey = 'azul';
let customColors = null; // null = usa preset; objeto = colores custom

// ── Aplicar tema ──────────────────────────────────────────────
function applyTheme(key, custom) {
  const t = custom || THEMES[key] || THEMES.azul;
  const r = document.documentElement.style;

  r.setProperty('--bg',            t.bg);
  r.setProperty('--bg2',           t.bg2);
  r.setProperty('--bg3',           t.bg3);
  r.setProperty('--surface',       t.surface);
  r.setProperty('--accent',        t.accent);
  r.setProperty('--accent2',       t.accent2);
  r.setProperty('--text',          t.text);
  r.setProperty('--text-dim',      t.textDim);
  r.setProperty('--text-muted',    t.textMuted);

  // Derivar border, accent-dim, accent-glow de accent
  r.setProperty('--border',        hexToRgba(t.accent, 0.12));
  r.setProperty('--border-strong', hexToRgba(t.accent, 0.25));
  r.setProperty('--accent-dim',    darkenHex(t.accent, 0.55));
  r.setProperty('--accent-glow',   hexToRgba(t.accent, 0.18));

  if (!custom) activeThemeKey = key;
  else activeThemeKey = '__custom__';

  // Marcar swatch activo
  document.querySelectorAll('.theme-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.theme === (custom ? '__custom__' : key));
  });
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function darkenHex(hex, factor) {
  const r = Math.round(parseInt(hex.slice(1,3),16) * factor);
  const g = Math.round(parseInt(hex.slice(3,5),16) * factor);
  const b = Math.round(parseInt(hex.slice(5,7),16) * factor);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// ── Navegación ────────────────────────────────────────────────
function goTo(screenId) {
  const cur  = document.getElementById(currentScreen);
  const next = document.getElementById(screenId);
  if (!next || screenId === currentScreen) return;

  cur.classList.add('exit-left');
  cur.classList.remove('active');

  setTimeout(() => {
    cur.classList.remove('exit-left');
    next.classList.add('active');
    currentScreen = screenId;
    onEnter(screenId);
  }, 220);
}

function onEnter(id) {
  if (id === 'screen-home')     renderHome();
  if (id === 'screen-registro') renderLista();
  if (id === 'screen-progreso') renderProgreso();
  if (id === 'screen-config')   renderConfig();
}

// ── Datos ─────────────────────────────────────────────────────
function getWorkouts() {
  try { return JSON.parse(localStorage.getItem(KEY_WORKOUTS)) || []; }
  catch { return []; }
}
function saveWorkouts(arr) { localStorage.setItem(KEY_WORKOUTS, JSON.stringify(arr)); }
function getConfig() {
  try { return JSON.parse(localStorage.getItem(KEY_CONFIG)) || {}; }
  catch { return {}; }
}
function saveConfig(obj) { localStorage.setItem(KEY_CONFIG, JSON.stringify(obj)); }

// ── HOME ──────────────────────────────────────────────────────
function renderHome() {
  const cfg = getConfig();
  const workouts = getWorkouts();
  const el = document.getElementById('home-greeting');
  if (cfg.nombre) {
    el.textContent = `Hola, ${cfg.nombre}`;
  } else {
    const h = new Date().getHours();
    el.textContent = h < 12 ? 'Buenos d\u00edas, Atleta' : h < 19 ? 'Buenas tardes, Atleta' : 'Buenas noches, Atleta';
  }
  document.getElementById('stat-total').textContent = workouts.length;
  document.getElementById('stat-week').textContent  = workoutsThisWeek(workouts);
  const mx = workouts.reduce((m,w) => Math.max(m, parseFloat(w.peso)||0), 0);
  document.getElementById('stat-kg').textContent = mx || 0;
}

function workoutsThisWeek(ws) {
  const s = new Date(); s.setDate(s.getDate() - s.getDay()); s.setHours(0,0,0,0);
  return ws.filter(w => new Date(w.fecha) >= s).length;
}

// ── REGISTRO ─────────────────────────────────────────────────
const tipoSel = () => document.getElementById('reg-tipo');
const tipoCust = () => document.getElementById('reg-tipo-custom');

document.addEventListener('DOMContentLoaded', () => {
  tipoSel().addEventListener('change', function() {
    tipoCust().classList.toggle('hidden', this.value !== '__otro__');
    if (this.value === '__otro__') tipoCust().focus();
  });

  // Cargar tema guardado
  const saved = localStorage.getItem(KEY_THEME);
  if (saved) {
    try {
      const t = JSON.parse(saved);
      if (t.key && t.key !== '__custom__') applyTheme(t.key);
      else if (t.custom) applyTheme(null, t.custom);
    } catch { applyTheme('azul'); }
  }

  buildThemeSwatches();
  renderHome();
});

function guardarEntrenamiento() {
  const sv = tipoSel().value;
  const tipo = sv === '__otro__' ? tipoCust().value.trim() : sv;
  const series = document.getElementById('reg-series').value.trim();
  const reps   = document.getElementById('reg-reps').value.trim();
  const peso   = document.getElementById('reg-peso').value.trim();
  const notas  = document.getElementById('reg-notas').value.trim();
  const fb = document.getElementById('reg-feedback');

  if (!tipo) { showFeedback(fb, 'Eleg\u00ed o escrib\u00ed un ejercicio.', 'err'); return; }
  if (!series || !reps) { showFeedback(fb, 'Complet\u00e1 series y repeticiones.', 'err'); return; }

  const w = { id: Date.now(), fecha: new Date().toISOString(), tipo, series: +series, reps: +reps, peso: parseFloat(peso)||0, notas };
  const all = getWorkouts(); all.unshift(w); saveWorkouts(all);

  tipoSel().value = ''; tipoCust().classList.add('hidden'); tipoCust().value = '';
  ['reg-series','reg-reps','reg-peso','reg-notas'].forEach(id => document.getElementById(id).value = '');
  showFeedback(fb, '\u2713 Sesi\u00f3n guardada correctamente', 'ok');
  renderLista();
}

function renderLista() {
  const c = document.getElementById('lista-entrenamientos');
  const ws = getWorkouts();
  if (!ws.length) { c.innerHTML = '<div class="empty-state">A\u00fan no hay sesiones registradas.<br/>\u00a1Empez\u00e1 hoy!</div>'; return; }
  c.innerHTML = ws.slice(0,20).map(w => {
    const d = new Date(w.fecha);
    const ds = d.toLocaleDateString('es-AR', {day:'2-digit',month:'short'});
    const ts = d.toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit'});
    const ps = w.peso > 0 ? ` \u00b7 ${w.peso}kg` : '';
    return `<div class="workout-item"><div class="workout-item-body"><div class="workout-item-name">${esc(w.tipo)}</div><div class="workout-item-meta">${w.series} series \u00d7 ${w.reps} reps${ps}</div>${w.notas?`<div class="workout-item-note">${esc(w.notas)}</div>`:''}</div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><span class="workout-item-date">${ds}<br/>${ts}</span><button class="workout-delete" onclick="deleteWorkout(${w.id})" title="Eliminar">\u2715</button></div></div>`;
  }).join('');
}

function deleteWorkout(id) { saveWorkouts(getWorkouts().filter(w => w.id !== id)); renderLista(); }

// ── PROGRESO ──────────────────────────────────────────────────
function renderProgreso() {
  const ws = getWorkouts();
  document.getElementById('prog-total').textContent = ws.length;
  document.getElementById('prog-week').textContent  = workoutsThisWeek(ws);
  renderBarChart(ws);
  renderPesoChart(ws);
}

function renderBarChart(ws) {
  const c = document.getElementById('bar-chart');
  const days = ['Dom','Lun','Mar','Mi\u00e9','Jue','Vie','S\u00e1b'];
  const today = new Date();
  const counts=[], labels=[], isT=[];
  for (let i=6; i>=0; i--) {
    const d = new Date(today); d.setDate(today.getDate()-i); d.setHours(0,0,0,0);
    const nxt = new Date(d); nxt.setDate(d.getDate()+1);
    const idx = 6-i;
    counts[idx] = ws.filter(w => { const wd=new Date(w.fecha); return wd>=d && wd<nxt; }).length;
    labels[idx] = days[d.getDay()];
    isT[idx] = i === 0;
  }
  const mx = Math.max(...counts, 1);
  c.innerHTML = counts.map((v,i) => `<div class="bar-col"><span class="bar-num">${v||''}</span><div class="bar-fill-wrap"><div class="bar-fill${isT[i]?' today':''}" style="height:${Math.round(v/mx*100)}%"></div></div><span class="bar-label">${labels[i]}</span></div>`).join('');
}

function renderPesoChart(ws) {
  const c = document.getElementById('peso-chart');
  if (!ws.length) { c.innerHTML = '<div class="empty-state" style="padding:16px">Sin datos a\u00fan</div>'; return; }
  const map = {};
  ws.forEach(w => { if (w.peso>0) map[w.tipo] = Math.max(map[w.tipo]||0, w.peso); });
  const sorted = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8);
  if (!sorted.length) { c.innerHTML = '<div class="empty-state" style="padding:16px">Ning\u00fan ejercicio con peso registrado</div>'; return; }
  const mx = sorted[0][1];
  c.innerHTML = sorted.map(([n,kg]) => `<div class="hbar-row"><span class="hbar-label">${esc(n)}</span><div class="hbar-track"><div class="hbar-fill" style="width:${Math.round(kg/mx*100)}%"><span>${kg}kg</span></div></div></div>`).join('');
}

// ── CONFIGURACIÓN ─────────────────────────────────────────────
function renderConfig() {
  const cfg = getConfig();
  document.getElementById('cfg-nombre').value = cfg.nombre || '';
  document.querySelectorAll('.goal-btn').forEach(b => b.classList.toggle('selected', b.dataset.val === cfg.objetivo));
  document.querySelectorAll('.day-btn').forEach(b => b.classList.toggle('selected', String(b.dataset.val) === String(cfg.dias)));
  updateDataStats();
  syncCustomColorPickers();
}

function selectGoal(btn) { document.querySelectorAll('.goal-btn').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); }
function selectDays(btn) { document.querySelectorAll('.day-btn').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); }

function guardarConfig() {
  const nombre   = document.getElementById('cfg-nombre').value.trim();
  const objetivo = document.querySelector('.goal-btn.selected')?.dataset.val || '';
  const dias     = document.querySelector('.day-btn.selected')?.dataset.val || '';
  saveConfig({ nombre, objetivo, dias });
  showFeedback(document.getElementById('cfg-feedback'), '\u2713 Configuraci\u00f3n guardada', 'ok');
}

function updateDataStats() {
  const ws = getWorkouts();
  document.getElementById('ds-total').textContent  = ws.length;
  document.getElementById('ds-size').textContent   = formatBytes(JSON.stringify(ws).length);
  document.getElementById('ds-first').textContent  = ws.length ? new Date(ws[ws.length-1].fecha).toLocaleDateString('es-AR') : '—';
}

function formatBytes(b) { return b < 1024 ? b+'B' : (b/1024).toFixed(1)+'KB'; }

// ── TEMAS ─────────────────────────────────────────────────────
function buildThemeSwatches() {
  const grid = document.getElementById('theme-grid');
  if (!grid) return;
  grid.innerHTML = Object.entries(THEMES).map(([key, t]) => {
    const grad = `linear-gradient(135deg, ${t.bg} 0%, ${t.surface} 50%, ${t.accent} 100%)`;
    return `<div class="theme-swatch${activeThemeKey===key?' active':''}" data-theme="${key}" style="background:${grad}" onclick="selectTheme('${key}')"><span class="theme-name">${t.name}</span></div>`;
  }).join('');
}

function selectTheme(key) {
  applyTheme(key);
  customColors = null;
  syncCustomColorPickers();
  saveTheme(key, null);
  document.querySelectorAll('.theme-swatch').forEach(s => s.classList.toggle('active', s.dataset.theme===key));
}

function saveTheme(key, custom) {
  localStorage.setItem(KEY_THEME, JSON.stringify(custom ? {key:'__custom__', custom} : {key}));
}

// Custom color pickers
function syncCustomColorPickers() {
  const style = getComputedStyle(document.documentElement);
  const get = v => {
    const c = style.getPropertyValue(v).trim();
    return c.startsWith('#') ? c : rgbaToHex(c);
  };
  setPickerVal('cp-bg',      get('--bg'));
  setPickerVal('cp-surface', get('--surface'));
  setPickerVal('cp-accent',  get('--accent'));
  setPickerVal('cp-accent2', get('--accent2'));
  setPickerVal('cp-text',    get('--text'));
}

function setPickerVal(id, val) {
  const el = document.getElementById(id);
  if (el && val && val.startsWith('#') && val.length >= 7) el.value = val.slice(0,7);
}

function rgbaToHex(rgba) {
  const m = rgba.match(/\d+/g);
  if (!m || m.length < 3) return '#888888';
  return '#'+[m[0],m[1],m[2]].map(n=>parseInt(n).toString(16).padStart(2,'0')).join('');
}

function applyCustomColors() {
  const bg      = document.getElementById('cp-bg').value;
  const surface = document.getElementById('cp-surface').value;
  const accent  = document.getElementById('cp-accent').value;
  const accent2 = document.getElementById('cp-accent2').value;
  const text    = document.getElementById('cp-text').value;

  // Derivar bg2, bg3 automáticamente
  const bg2 = blendColors(bg, '#ffffff', 0.04);
  const bg3 = blendColors(bg, '#ffffff', 0.08);
  const textDim   = blendColors(text, bg, 0.45);
  const textMuted = blendColors(text, bg, 0.25);

  customColors = { bg, bg2, bg3, surface, accent, accent2, text, textDim, textMuted };
  applyTheme('__custom__', customColors);
  saveTheme('__custom__', customColors);
  document.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
  showFeedback(document.getElementById('cfg-feedback'), '\u2713 Colores personalizados aplicados', 'ok');
}

function blendColors(hex1, hex2, t) {
  const p = (h, i) => parseInt(h.slice(1+i*2, 3+i*2), 16);
  const r = Math.round(p(hex1,0) + (p(hex2,0)-p(hex1,0))*t);
  const g = Math.round(p(hex1,1) + (p(hex2,1)-p(hex1,1))*t);
  const b = Math.round(p(hex1,2) + (p(hex2,2)-p(hex1,2))*t);
  return '#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join('');
}

// ── EXPORT / IMPORT ───────────────────────────────────────────
function exportData() {
  const ws  = getWorkouts();
  const cfg = getConfig();
  const t   = localStorage.getItem(KEY_THEME);

  const payload = {
    _version: 2,
    _app: 'Mi Entrenamiento',
    _exported: new Date().toISOString(),
    config: cfg,
    theme: t ? JSON.parse(t) : null,
    workouts: ws,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `mi-entrenamiento-${date}.json`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showFeedback(document.getElementById('cfg-feedback'), `\u2713 Exportados ${ws.length} entrenamientos`, 'ok');
}

function triggerImport() {
  document.getElementById('import-file-input').click();
}

function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);

      // Validar estructura básica
      if (!data.workouts || !Array.isArray(data.workouts)) {
        openInfoModal('\u26a0\ufe0f Archivo inv\u00e1lido', 'El archivo no contiene datos de entrenamientos v\u00e1lidos.');
        return;
      }

      const existing = getWorkouts();
      const existingIds = new Set(existing.map(w => w.id));

      // Merge: solo añadir los que no existen ya (por id)
      const newOnes = data.workouts.filter(w => !existingIds.has(w.id));
      const merged  = [...newOnes, ...existing];
      saveWorkouts(merged);

      if (data.config) saveConfig(data.config);
      if (data.theme) {
        localStorage.setItem(KEY_THEME, JSON.stringify(data.theme));
        if (data.theme.key && data.theme.key !== '__custom__') applyTheme(data.theme.key);
        else if (data.theme.custom) applyTheme(null, data.theme.custom);
        buildThemeSwatches();
      }

      updateDataStats();
      renderConfig();
      openInfoModal('\u2713 Importaci\u00f3n exitosa', `Se importaron <strong>${newOnes.length}</strong> entrenamientos nuevos (${data.workouts.length - newOnes.length} ya exist\u00edan).`);

    } catch {
      openInfoModal('\u26a0\ufe0f Error de formato', 'El archivo no es un JSON v\u00e1lido.');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

// ── DATOS DE PRUEBA ───────────────────────────────────────────
function cargarDemoData() {
  const ejercicios = ['Press de banca','Sentadilla','Peso muerto','Press militar','Dominadas','Remo con barra','Curl de b\u00edceps','Hip thrust'];
  const notas = [
    'Buena sesi\u00f3n, me sent\u00ed fuerte.',
    'Aument\u00e9 2.5kg respecto a la semana pasada.',
    'Cans\u00e1ncio acumulado, pero lo hice igual.',
    '',
    'Mejor t\u00e9cnica en la bajada.',
    '',
    'Nuevo r\u00e9cord personal!',
    'Foco en rango completo de movimiento.',
  ];

  const now = new Date();
  const demoWorkouts = [];

  // 28 sesiones en las últimas 4 semanas (7 por semana aprox.)
  for (let day = 27; day >= 0; day--) {
    // ~5 días activos por semana
    if ([0, 3].includes(day % 7)) continue; // descanso dominical y miércoles cada semana

    const d = new Date(now);
    d.setDate(now.getDate() - day);
    d.setHours(8 + Math.floor(Math.random()*3), Math.floor(Math.random()*50), 0, 0);

    // 3-4 ejercicios por sesión
    const count = 3 + Math.floor(Math.random()*2);
    const shuffled = [...ejercicios].sort(() => Math.random()-0.5).slice(0, count);

    shuffled.forEach((ej, i) => {
      const baseWeight = {
        'Press de banca': 70, 'Sentadilla': 90, 'Peso muerto': 100,
        'Press militar': 50, 'Dominadas': 0, 'Remo con barra': 65,
        'Curl de b\u00edceps': 25, 'Hip thrust': 80,
      }[ej] || 40;

      const progression = Math.max(0, (27-day) * 0.4); // progresión de peso a lo largo del tiempo
      const randomVariation = (Math.random()-0.5) * 5;

      const workout = {
        id:     now.getTime() - day * 86400000 - i * 1000,
        fecha:  new Date(d.getTime() + i * 300000).toISOString(),
        tipo:   ej,
        series: 3 + Math.floor(Math.random()*2),
        reps:   6 + Math.floor(Math.random()*7),
        peso:   baseWeight > 0 ? Math.round((baseWeight + progression + randomVariation) * 2)/2 : 0,
        notas:  notas[Math.floor(Math.random()*notas.length)],
      };
      demoWorkouts.push(workout);
    });
  }

  // Merge con existentes
  const existing = getWorkouts();
  const existingIds = new Set(existing.map(w => w.id));
  const newOnes = demoWorkouts.filter(w => !existingIds.has(w.id));
  saveWorkouts([...newOnes, ...existing]);

  // Config demo si no tiene
  const cfg = getConfig();
  if (!cfg.nombre) saveConfig({ nombre: 'Demo Atleta', objetivo: 'masa', dias: '4' });

  updateDataStats();
  renderHome();
  openInfoModal('\u2705 Datos de prueba cargados', `Se agregaron <strong>${newOnes.length} sesiones</strong> de ejemplo de las \u00faltimas 4 semanas. Pod\u00e9s explorar el progreso, gr\u00e1ficos y exportar los datos.`);
}

// ── MODAL ─────────────────────────────────────────────────────
function confirmarBorrado() {
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function cerrarModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-info').classList.add('hidden');
}
function borrarTodo() {
  saveWorkouts([]);
  cerrarModal();
  renderProgreso();
  updateDataStats();
}

function openInfoModal(title, html) {
  document.getElementById('modal-info-title').textContent = title;
  document.getElementById('modal-info-body').innerHTML = html;
  document.getElementById('modal-info').classList.remove('hidden');
}

// ── Utils ─────────────────────────────────────────────────────
function showFeedback(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className = `feedback ${type}`;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 3000);
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
