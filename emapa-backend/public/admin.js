// Panel de administración EMAPA. Todo el contenido que viene del servidor se inserta
// con textContent (nunca innerHTML) para evitar inyección de código desde los trámites.
'use strict';

const TOKEN_KEY = 'emapa_admin_token';
let token = sessionStorage.getItem(TOKEN_KEY);
let sectors = [];

const $ = (id) => document.getElementById(id);

/** Crea un elemento. Los hijos de tipo string se insertan como texto plano. */
function el(tag, props = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k in e) e[k] = v;
    else e.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

const fmt = (iso) => new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
const sectorName = (id) => sectors.find((s) => s.id === id)?.name ?? id;

let toastTimer;
function toast(msg, isError = false) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('err', isError);
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
}

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && path !== '/auth/login') { logout(); throw new Error('Sesión expirada'); }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
  return data;
}

/** Deshabilita el botón mientras corre la acción y muestra errores. */
async function withButton(btn, fn) {
  btn.disabled = true;
  try { await fn(); } catch (e) { toast(e.message, true); } finally { btn.disabled = false; }
}

// ---------------- sesión ----------------
$('login-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  $('login-error').textContent = '';
  try {
    const r = await api('POST', '/auth/login', { id: $('login-id').value.trim(), password: $('login-pass').value });
    if (r.user.role !== 'admin') throw new Error('Esta cuenta no tiene permisos de administración');
    token = r.token;
    sessionStorage.setItem(TOKEN_KEY, token);
    $('login-pass').value = '';
    showApp();
  } catch (e) {
    $('login-error').textContent = e.message;
  }
});

function logout() {
  token = null;
  sessionStorage.removeItem(TOKEN_KEY);
  $('app-view').hidden = true;
  $('login-view').hidden = false;
}
$('logout').addEventListener('click', logout);

async function showApp() {
  try {
    const me = await api('GET', '/me');
    if (me.role !== 'admin') return logout();
  } catch { return logout(); }
  $('login-view').hidden = true;
  $('app-view').hidden = false;
  sectors = await api('GET', '/sectors');
  renderSectorChecks();
  setDefaultDates();
  openTab('resumen');
}

// ---------------- pestañas ----------------
const loaders = { resumen: loadStats, cortes: loadIncidents, calidad: loadQuality, tramites: loadProcedures };
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => openTab(b.dataset.tab)));

function openTab(name) {
  document.querySelectorAll('.tab').forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle('active', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
  });
  for (const k of Object.keys(loaders)) $(`tab-${k}`).hidden = k !== name;
  loaders[name]().catch((e) => toast(e.message, true));
}

// ---------------- resumen ----------------
async function loadStats() {
  const s = await api('GET', '/admin/stats');
  const items = [
    ['Usuarios registrados', s.users],
    ['Con notificaciones activas', s.withPush],
    ['Incidentes activos', s.activeIncidents],
    ['Trámites pendientes', s.pendingProcedures],
    ['Recaudado hoy', `$${s.paidToday.toFixed(2)}`],
  ];
  $('stats').replaceChildren(...items.map(([l, v]) =>
    el('div', { class: 'card stat' }, el('div', { class: 'num' }, v), el('div', { class: 'muted' }, l))));
}

// ---------------- cortes ----------------
const typeLabel = { corte_programado: 'Corte programado', falla: 'Falla', baja_presion: 'Baja presión' };

function renderSectorChecks() {
  $('incident-sectors').replaceChildren(...sectors.map((s) =>
    el('label', {}, el('input', { type: 'checkbox', value: s.id, name: 'sector' }), s.name)));
}

/** Valor para <input type="datetime-local"> en hora local. */
function toLocalInput(d) {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
function setDefaultDates() {
  const now = new Date();
  $('inc-start').value = toLocalInput(now);
  $('inc-end').value = toLocalInput(new Date(now.getTime() + 4 * 3600_000));
}

$('incident-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const btn = ev.submitter ?? ev.target.querySelector('button[type="submit"]');
  withButton(btn, async () => {
    const sectorIds = [...document.querySelectorAll('input[name="sector"]:checked')].map((c) => c.value);
    if (sectorIds.length === 0) throw new Error('Selecciona al menos un sector');
    const start = new Date($('inc-start').value);
    const end = new Date($('inc-end').value);
    if (!(end > start)) throw new Error('La hora de restablecimiento debe ser posterior al inicio');
    await api('POST', '/admin/incidents', {
      sectorIds,
      type: $('inc-type').value,
      title: $('inc-title').value.trim(),
      description: $('inc-desc').value.trim(),
      startsAt: start.toISOString(),
      estimatedEnd: end.toISOString(),
    });
    ev.target.reset();
    setDefaultDates();
    toast('Incidente publicado y notificado a los sectores');
    await loadIncidents();
  });
});

async function loadIncidents() {
  const list = await api('GET', '/admin/incidents');
  const body = $('incidents-body');
  if (list.length === 0) {
    body.replaceChildren(el('tr', {}, el('td', { colSpan: 7, class: 'muted' }, 'No hay incidentes registrados.')));
    return;
  }
  body.replaceChildren(...list.map((i) => {
    const resolveBtn = el('button', { class: 'btn small' }, 'Marcar restablecido');
    resolveBtn.addEventListener('click', () => {
      if (!confirm(`¿Confirmas que el servicio de "${i.title}" fue restablecido? Se notificará a los usuarios.`)) return;
      withButton(resolveBtn, async () => {
        await api('POST', `/admin/incidents/${encodeURIComponent(i.id)}/resolve`);
        toast('Servicio marcado como restablecido');
        await loadIncidents();
      });
    });
    return el('tr', {},
      el('td', {}, el('span', { class: `badge ${i.type === 'falla' ? 'b-danger' : 'b-warn'}` }, typeLabel[i.type])),
      el('td', {}, el('strong', {}, i.title), el('div', { class: 'muted' }, i.description)),
      el('td', {}, i.sectorIds.map(sectorName).join(', ')),
      el('td', {}, fmt(i.startsAt)),
      el('td', {}, fmt(i.estimatedEnd)),
      el('td', {}, el('span', { class: `badge ${i.resolved ? 'b-ok' : 'b-danger'}` }, i.resolved ? 'Restablecido' : 'Activo')),
      el('td', {}, i.resolved ? '' : resolveBtn),
    );
  }));
}

// ---------------- calidad ----------------
const qLabel = { apta: ['Apta', 'b-ok'], precaucion: ['Precaución', 'b-warn'], no_apta: ['No apta', 'b-danger'] };

async function loadQuality() {
  const list = await api('GET', '/admin/quality');
  $('quality-body').replaceChildren(...list.map((q) => {
    const num = (v, label) => el('input', { type: 'number', step: '0.01', min: '0', value: v, 'aria-label': `${label} en ${sectorName(q.sectorId)}` });
    const cl = num(q.chlorine, 'Cloro');
    const ph = num(q.ph, 'pH');
    const tu = num(q.turbidity, 'Turbidez');
    const save = el('button', { class: 'btn small' }, 'Guardar');
    save.addEventListener('click', () => withButton(save, async () => {
      const inputs = [cl, ph, tu];
      if (inputs.some((x) => x.value.trim() === '')) throw new Error('Completa los tres valores');
      const vals = inputs.map((x) => Number(x.value));
      if (vals.some((v) => !Number.isFinite(v) || v < 0)) throw new Error('Ingresa valores numéricos válidos');
      const r = await api('PUT', `/admin/quality/${encodeURIComponent(q.sectorId)}`, {
        chlorine: vals[0], ph: vals[1], turbidity: vals[2],
      });
      toast(r.status === 'no_apta'
        ? `Valores fuera de norma: se envió alerta a ${sectorName(q.sectorId)}`
        : 'Datos de calidad actualizados');
      await loadQuality();
    }));
    const [lbl, cls] = qLabel[q.status];
    return el('tr', {},
      el('td', {}, el('strong', {}, sectorName(q.sectorId))),
      el('td', {}, cl), el('td', {}, ph), el('td', {}, tu),
      el('td', {}, el('span', { class: `badge ${cls}` }, lbl)),
      el('td', {}, fmt(q.updatedAt)),
      el('td', {}, save),
    );
  }));
}

// ---------------- trámites ----------------
const statusLabel = { recibido: 'Recibido', en_revision: 'En revisión', atendido: 'Atendido' };

async function loadProcedures() {
  const list = await api('GET', '/admin/procedures');
  const body = $('procedures-body');
  if (list.length === 0) {
    body.replaceChildren(el('tr', {}, el('td', { colSpan: 7, class: 'muted' }, 'No hay trámites todavía.')));
    return;
  }
  body.replaceChildren(...list.map((p) => {
    const sel = el('select', { 'aria-label': `Estado del trámite ${p.id}` },
      Object.entries(statusLabel).map(([v, l]) => el('option', { value: v, selected: v === p.status }, l)));
    sel.addEventListener('change', () => withButton(sel, async () => {
      await api('PATCH', `/admin/procedures/${encodeURIComponent(p.id)}`, { status: sel.value });
      toast(`Trámite ${p.id} actualizado. Se notificó al ciudadano.`);
    }));
    return el('tr', {},
      el('td', {}, el('strong', {}, p.id)),
      el('td', {}, p.typeName),
      el('td', {}, p.userName, el('div', { class: 'muted' }, p.cedula)),
      el('td', {}, p.accountNumber),
      el('td', { class: 'detail' }, p.detail),
      el('td', {}, fmt(p.createdAt)),
      el('td', {}, sel),
    );
  }));
}

// ---------------- inicio ----------------
if (token) showApp(); else $('login-view').hidden = false;
