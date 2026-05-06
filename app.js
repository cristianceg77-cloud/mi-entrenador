/* ============================================================
   MI ENTRENAMIENTO — app.js
   ============================================================ */

'use strict';

// ── Service Worker ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => console.log('[SW] registrado:', reg.scope))
      .catch(err => console.warn('[SW] error:', err));
  });
}

// ── Constantes de localStorage ────────────────────────────────
const KEY_WORKOUTS = 'me_workouts';
const KEY_CONFIG   = 'me_config';

// ── Estado ────────────────────────────────────────────────────
let currentScreen = 'screen-home';

// ── Navegación ────────────────────────────────────────────────
function goTo(screenId) {
  const current = document.getElementById(currentScreen);
  const next    = document.getElementById(screenId);
  if (!next || screenId === currentScreen) return;

  current.classList.add('exit-left');
  current.classList.remove('active');

  setTimeout(() => {
    current.classList.remove('exit-left');
    next.classList.add('active');
    currentScreen = screenId;
    onScreenEnter(screenId);
  }, 220);
}

function onScreenEnter(screenId) {
  if (screenId === 'screen-home')     renderHome();
  if (screenId === 'screen-registro') renderLista();
  if (screenId === 'screen-progreso') renderProgreso();
  if (screenId === 'screen-config')   renderConfig();
}

// ── Datos ─────────────────────────────────────────────────────
function getWorkouts() {
  try { return JSON.parse(localStorage.getItem(KEY_WORKOUTS)) || []; }
  catch { return []; }
}
function saveWorkouts(arr) {
  localStorage.setItem(KEY_WORKOUTS, JSON.stringify(arr));
}
function getConfig() {
  try { return JSON.parse(localStorage.getItem(KEY_CONFIG)) || {}; }
  catch { return {}; }
}
function saveConfig(obj) {
  localStorage.setItem(KEY_CONFIG, JSON.stringify(obj));
}

// ── HOME ──────────────────────────────────────────────────────
function renderHome() {
  const cfg      = getConfig();
  const workouts = getWorkouts();

  // Saludo
  const greeting = document.getElementById('home-greeting');
  if (cfg.nombre) {
    greeting.textContent = `Hola, ${cfg.nombre}`;
  } else {
    const hour = new Date().getHours();
    greeting.textContent = hour < 12 ? 'Buenos días, Atleta' : hour < 19 ? 'Buenas tardes, Atleta' : 'Buenas noches, Atleta';
  }

  // Stats
  document.getElementById('stat-total').textContent = workouts.length;
  document.getElementById('stat-week').textContent  = workoutsThisWeek(workouts);
  const maxKg = workouts.reduce((m, w) => Math.max(m, parseFloat(w.peso) || 0), 0);
  document.getElementById('stat-kg').textContent = maxKg > 0 ? maxKg : 0;
}

function workoutsThisWeek(workouts) {
  const now   = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  return workouts.filter(w => new Date(w.fecha) >= start).length;
}

// ── REGISTRO ─────────────────────────────────────────────────
const tipoSelect = () => document.getElementById('reg-tipo');
const tipoCustom = () => document.getElementById('reg-tipo-custom');

document.addEventListener('DOMContentLoaded', () => {
  tipoSelect().addEventListener('change', function () {
    if (this.value === '__otro__') {
      tipoCustom().classList.remove('hidden');
      tipoCustom().focus();
    } else {
      tipoCustom().classList.add('hidden');
    }
  });

  renderHome();
});

function guardarEntrenamiento() {
  const selectVal = tipoSelect().value;
  const tipo = selectVal === '__otro__'
    ? tipoCustom().value.trim()
    : selectVal;

  const series = document.getElementById('reg-series').value.trim();
  const reps   = document.getElementById('reg-reps').value.trim();
  const peso   = document.getElementById('reg-peso').value.trim();
  const notas  = document.getElementById('reg-notas').value.trim();

  const fb = document.getElementById('reg-feedback');

  if (!tipo) {
    showFeedback(fb, 'Elegí o escribí un ejercicio.', 'err');
    return;
  }
  if (!series || !reps) {
    showFeedback(fb, 'Completá series y repeticiones.', 'err');
    return;
  }

  const workout = {
    id:     Date.now(),
    fecha:  new Date().toISOString(),
    tipo,
    series: parseInt(series),
    reps:   parseInt(reps),
    peso:   parseFloat(peso) || 0,
    notas
  };

  const all = getWorkouts();
  all.unshift(workout);
  saveWorkouts(all);

  // Reset
  tipoSelect().value = '';
  tipoCustom().classList.add('hidden');
  tipoCustom().value = '';
  document.getElementById('reg-series').value = '';
  document.getElementById('reg-reps').value   = '';
  document.getElementById('reg-peso').value   = '';
  document.getElementById('reg-notas').value  = '';

  showFeedback(fb, '✓ Sesión guardada correctamente', 'ok');
  renderLista();
}

function renderLista() {
  const container = document.getElementById('lista-entrenamientos');
  const workouts  = getWorkouts();

  if (workouts.length === 0) {
    container.innerHTML = '<div class="empty-state">Aún no hay sesiones registradas.<br/>¡Empezá hoy!</div>';
    return;
  }

  const items = workouts.slice(0, 20).map(w => {
    const fecha = new Date(w.fecha);
    const dateStr = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    const timeStr = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const pesoStr = w.peso > 0 ? ` · ${w.peso}kg` : '';
    return `
      <div class="workout-item" id="wi-${w.id}">
        <div class="workout-item-body">
          <div class="workout-item-name">${escHtml(w.tipo)}</div>
          <div class="workout-item-meta">${w.series} series × ${w.reps} reps${pesoStr}</div>
          ${w.notas ? `<div class="workout-item-note">${escHtml(w.notas)}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <span class="workout-item-date">${dateStr}<br/>${timeStr}</span>
          <button class="workout-delete" onclick="deleteWorkout(${w.id})" title="Eliminar">✕</button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = items;
}

function deleteWorkout(id) {
  const all = getWorkouts().filter(w => w.id !== id);
  saveWorkouts(all);
  renderLista();
}

// ── PROGRESO ──────────────────────────────────────────────────
function renderProgreso() {
  const workouts = getWorkouts();

  document.getElementById('prog-total').textContent = workouts.length;
  document.getElementById('prog-week').textContent  = workoutsThisWeek(workouts);

  renderBarChart(workouts);
  renderPesoChart(workouts);
}

function renderBarChart(workouts) {
  const container = document.getElementById('bar-chart');
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const today = new Date();
  const todayIdx = today.getDay();

  // Últimos 7 días
  const counts = Array(7).fill(0);
  const labels = [];
  const isToday = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const idx = 6 - i;
    counts[idx] = workouts.filter(w => {
      const wd = new Date(w.fecha);
      return wd >= d && wd < next;
    }).length;
    labels[idx] = days[d.getDay()];
    isToday[idx] = (i === 0);
  }

  const max = Math.max(...counts, 1);

  container.innerHTML = counts.map((c, i) => `
    <div class="bar-col">
      <span class="bar-num">${c > 0 ? c : ''}</span>
      <div class="bar-fill-wrap">
        <div class="bar-fill${isToday[i] ? ' today' : ''}" style="height:${Math.round((c / max) * 100)}%"></div>
      </div>
      <span class="bar-label">${labels[i]}</span>
    </div>
  `).join('');
}

function renderPesoChart(workouts) {
  const container = document.getElementById('peso-chart');

  if (workouts.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:16px">Sin datos aún</div>';
    return;
  }

  // Peso máximo por ejercicio
  const pesoMap = {};
  workouts.forEach(w => {
    if (w.peso > 0) {
      pesoMap[w.tipo] = Math.max(pesoMap[w.tipo] || 0, w.peso);
    }
  });

  const sorted = Object.entries(pesoMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:16px">Ningún ejercicio con peso registrado</div>';
    return;
  }

  const max = sorted[0][1];

  container.innerHTML = sorted.map(([name, kg]) => `
    <div class="hbar-row">
      <span class="hbar-label">${escHtml(name)}</span>
      <div class="hbar-track">
        <div class="hbar-fill" style="width:${Math.round((kg / max) * 100)}%">
          <span>${kg}kg</span>
        </div>
      </div>
    </div>
  `).join('');
}

// ── CONFIGURACIÓN ─────────────────────────────────────────────
function renderConfig() {
  const cfg = getConfig();
  document.getElementById('cfg-nombre').value = cfg.nombre || '';

  // Objetivo
  document.querySelectorAll('.goal-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.val === cfg.objetivo);
  });

  // Días
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.classList.toggle('selected', String(btn.dataset.val) === String(cfg.dias));
  });
}

function selectGoal(btn) {
  document.querySelectorAll('.goal-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function selectDays(btn) {
  document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function guardarConfig() {
  const nombre   = document.getElementById('cfg-nombre').value.trim();
  const objetivo = document.querySelector('.goal-btn.selected')?.dataset.val || '';
  const dias     = document.querySelector('.day-btn.selected')?.dataset.val || '';

  saveConfig({ nombre, objetivo, dias });

  const fb = document.getElementById('cfg-feedback');
  showFeedback(fb, '✓ Configuración guardada', 'ok');
}

// ── MODAL ─────────────────────────────────────────────────────
function confirmarBorrado() {
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function cerrarModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}
function borrarTodo() {
  saveWorkouts([]);
  cerrarModal();
  renderProgreso();
}

// ── Utilidades ────────────────────────────────────────────────
function showFeedback(el, msg, type) {
  el.textContent = msg;
  el.className   = `feedback ${type}`;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 3000);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
