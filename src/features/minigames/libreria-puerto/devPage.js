// Página de desarrollo de «La librería del puerto» (dev/libreria-puerto.html). Monta el juego con el adaptador de
// recompensas de demostración; no forma parte de la app ni del build (Vite solo construye index.html). Guarda la partida
// en `localStorage` con claves propias de la demo, nunca en la de la biblioteca.
//
// Con `?vista=app` (pantalla completa) o `?vista=pc` (dentro de una ventana del ordenador) se ve como se vería en la app,
// sin la barra de desarrollo; lo usa la vista previa dev/libreria-puerto-app.html. `?nivel=semana` abre el nivel de la
// semana y `&semana=2026-W44` elige otra semana.
//
// Ranking: SOLO de demostración. Los demás lectores son inventados (`demoResults`) y tu resultado se guarda en este
// navegador. En la app de verdad, el servidor valida cada partida repitiendo sus movimientos, guarda el ranking y
// concede las distinciones (ver docs/qa/libreria-puerto.md, «Ranking y distinciones»).
import { mountLibreria } from './game';
import { LEVELS, levelById } from './levels';
import { replay } from './puzzle';
import { PODIUM, RANKING_DISTINCTIONS, demoResults, monthlyRanking, weeklyRanking } from './ranking';
import { DEMO_REWARD, createDemoAdapter } from './rewards';
import { generateLevel, monthOfWeek, previousWeek, weekId, weekStart } from './weekly';

const SAVE_KEY = 'bookshelf:dev:libreria-puerto';
const STARS_KEY = 'bookshelf:dev:libreria-puerto:estrellas';
const RANK_KEY = 'bookshelf:dev:libreria-puerto:semanas';
const ME = 'yo';
const $ = (id) => document.getElementById(id);
const levelSelect = $('level');
const log = $('log');
const reward = $('reward');
const ticketRow = $('ticket-row');
const ticketText = $('ticket-text');

const params = new URLSearchParams(location.search);
// 'app': pantalla completa con su cabecera; 'pc': dentro de una ventana del ordenador (la cabecera la pone la ventana)
const vista = params.get('vista');
const appView = vista === 'app' || vista === 'pc';
document.body.classList.toggle('is-app', appView);
document.body.classList.toggle('is-pc', vista === 'pc');

const WEEK = /^\d{4}-W\d{2}$/.test(params.get('semana') ?? '') ? params.get('semana') : weekId();
const WEEKLY = generateLevel(WEEK);
const weekNumber = (id) => Number(id.split('-W')[1]);
const levelFor = (id) => (id === WEEKLY.id ? WEEKLY : levelById(id));

const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch {
    return {};
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento: dura lo que la página
  }
};
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

// ── Niveles y estrellas ──
let best = read(STARS_KEY);
const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
function showLevels() {
  // Rehacer las opciones no debe cambiar el nivel elegido
  const current = levelSelect.value;
  levelSelect.replaceChildren(
    new Option(`Semana ${weekNumber(WEEK)} · ${WEEKLY.nombre}${best[WEEKLY.id] ? ` · ${starText(best[WEEKLY.id])}` : ''}`, WEEKLY.id),
    ...LEVELS.map((l) => new Option(`${l.id.toUpperCase()} · ${l.nombre}${best[l.id] ? ` · ${starText(best[l.id])}` : ''}`, l.id)),
  );
  levelSelect.value = current || LEVELS[0].id;
  const button = (id, label, n, extra = '') => {
    const b = el('button', { type: 'button', className: `app-level${extra}` }, el('span', { className: 'app-level__n', textContent: n }), el('span', { className: 'app-level__stars', textContent: starText(best[id] ?? 0) }));
    b.setAttribute('aria-pressed', String(levelSelect.value === id));
    b.setAttribute('aria-label', `${label}${best[id] ? `, ${best[id]} de 3 estrellas` : ''}`);
    b.addEventListener('click', () => {
      levelSelect.value = id;
      mount();
    });
    return b;
  };
  const rankBtn = el('button', { type: 'button', className: 'app-level app-level--rank' }, el('span', { className: 'app-level__n', textContent: 'Ranking' }), el('span', { className: 'app-level__stars', textContent: `sem. ${weekNumber(WEEK)}` }));
  rankBtn.setAttribute('aria-label', 'Ranking semanal y mensual');
  rankBtn.addEventListener('click', () => openRanking());
  $('app-levels').replaceChildren(button(WEEKLY.id, `Nivel de la semana ${weekNumber(WEEK)}`, 'Semana', ' app-level--week'), ...LEVELS.map((l, i) => button(l.id, `Nivel ${i + 1}: ${l.nombre}`, String(i + 1))), rankBtn);
}
function recordWin(e) {
  if (e.type !== 'win' || !e.stars) return;
  best = { ...read(STARS_KEY), [e.level]: Math.max(best[e.level] ?? 0, e.stars) };
  write(STARS_KEY, best);
  if (e.level === WEEKLY.id) {
    // Como haría el servidor: repetir las jugadas sobre el nivel y contar los movimientos desde ellas, no fiarse de e.moves
    const checked = replay(WEEKLY, e.jugadas);
    if (!checked?.won) return;
    // Tu mejor resultado de la semana (demo): menos movimientos; a igualdad, el primero que lo consiguió
    const mine = read(RANK_KEY);
    const prev = mine[WEEK];
    if (!prev || checked.moves < prev.moves) mine[WEEK] = { moves: checked.moves, min: WEEKLY.libros.length, at: Date.now() };
    write(RANK_KEY, mine);
  }
  showLevels();
}
showLevels();
const wanted = params.get('nivel') === 'semana' ? WEEKLY.id : params.get('nivel');
if (levelFor(wanted)) levelSelect.value = wanted;
if (params.get('modo') === 'reto') document.querySelector('input[name="mode"][value="reto"]').checked = true;

const mode = () => (levelSelect.value === WEEKLY.id ? 'semanal' : document.querySelector('input[name="mode"]:checked').value);

// ── Ranking (demostración) ──
function monthWeeks() {
  // Las semanas del mes de esta semana, hasta ella
  const out = [];
  for (let w = WEEK; monthOfWeek(w) === monthOfWeek(WEEK); w = previousWeek(w)) out.unshift(w);
  return out;
}
function allResults() {
  const weeks = monthWeeks().map((w) => ({ week: w, min: generateLevel(w).libros.length, start: weekStart(w) }));
  const mine = read(RANK_KEY);
  const own = Object.entries(mine)
    .filter(([w]) => weeks.some((x) => x.week === w))
    .map(([w, r]) => ({ user: ME, nombre: 'Tú', week: w, ...r }));
  return [...demoResults(weeks), ...own];
}
let rankTab = 'semana';
function renderRanking() {
  const results = allResults();
  const month = monthOfWeek(WEEK);
  const monthName = new Date(`${month}-15`).toLocaleDateString('es-ES', { month: 'long' });
  const weekly = rankTab === 'semana';
  const rows = weekly ? weeklyRanking(results, WEEK) : monthlyRanking(results, month);
  const periodo = weekly ? `semana ${weekNumber(WEEK)}` : monthName;
  for (const t of document.querySelectorAll('[data-rank-tab]')) t.setAttribute('aria-selected', String(t.dataset.rankTab === rankTab));
  $('rank-rule').textContent = weekly
    ? `Nivel de la semana ${weekNumber(WEEK)} · mínimo ${WEEKLY.libros.length} movimientos. Menos movimientos primero; a igualdad, quien lo consiguió antes.`
    : `Semanas de ${monthName}. Primero quien completa más semanas; luego, menos movimientos de más en total; luego, quien terminó antes.`;
  const shown = rows.slice(0, 10);
  const me = rows.find((r) => r.user === ME);
  if (me && !shown.includes(me)) shown.push(me);
  const line = (r) =>
    el(
      'li',
      { className: `rank-row${r.user === ME ? ' is-me' : ''}${r.puesto <= PODIUM ? ' is-podium' : ''}` },
      el('span', { className: 'rank-row__pos', textContent: `${r.puesto}.º` }),
      el('span', { className: 'rank-row__name', textContent: r.nombre }),
      el('span', { className: 'rank-row__score', textContent: weekly ? `${r.moves} mov.` : `${r.semanas} sem. · +${r.extra}` }),
    );
  $('rank-list').replaceChildren(...shown.map(line));
  $('rank-empty').hidden = rows.length > 0;
  // Cómo se vería la distinción en el perfil, y dónde estarías tú si el periodo cerrara ahora
  const kind = weekly ? 'libreria-semana' : 'libreria-mes';
  const info = RANKING_DISTINCTIONS[kind];
  $('badge-name').textContent = info.name;
  $('badge-text').textContent = `${info.meaning} Ejemplo de nota: «1.º · ${periodo}».`;
  $('rank-me').textContent = me
    ? me.puesto <= PODIUM
      ? `Si ${weekly ? 'la semana' : 'el mes'} cerrara ahora, estarías en el podio (${me.puesto}.º) y recibirías esta distinción.`
      : `Si ${weekly ? 'la semana' : 'el mes'} cerrara ahora, estarías en el puesto ${me.puesto}.`
    : weekly
      ? 'Aún no has jugado el nivel de esta semana.'
      : 'Aún no has completado ninguna semana de este mes.';
}
function openRanking() {
  $('ranking').hidden = false;
  renderRanking();
  $('rank-close').focus();
}
for (const t of document.querySelectorAll('[data-rank-tab]')) {
  t.addEventListener('click', () => {
    rankTab = t.dataset.rankTab;
    renderRanking();
  });
}
$('rank-close').addEventListener('click', () => {
  $('ranking').hidden = true;
  document.querySelector('.app-level--rank')?.focus();
});
// Escape cierra el ranking esté donde esté el foco (en Safari, pulsar un botón no lo enfoca)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('ranking').hidden) $('rank-close').click();
});

// ── Reto mensual de demostración (ticket) ──
function showAdapter(s) {
  log.replaceChildren(...s.log.map((line) => Object.assign(document.createElement('li'), { textContent: line })));
  ticketText.textContent = s.unlocked ? `Reto del mes abierto · intentos: ${s.attempts}` : `Tickets dorados (demo): ${s.tickets}`;
  $('unlock').hidden = s.unlocked;
  reward.hidden = !s.rewarded;
  reward.textContent = `Recompensa ilustrativa: «${DEMO_REWARD.nombre}» · ${DEMO_REWARD.etiqueta}. No se ha concedido nada real.`;
}
const adapter = createDemoAdapter({ month: 'demo-mes', onChange: showAdapter });

let game = null;
function mount(saved = null) {
  game?.destroy();
  game = null;
  const m = mode();
  ticketRow.hidden = m !== 'reto';
  if (m === 'reto' && !adapter.state.unlocked) {
    $('game').replaceChildren(Object.assign(document.createElement('p'), { className: 'dev-note', textContent: 'El reto mensual (demo) se abre con un ticket dorado de demostración. No se gasta en los reintentos.' }));
    return;
  }
  $('game').replaceChildren();
  const level = levelFor(levelSelect.value);
  showLevels();
  const i = LEVELS.indexOf(level);
  game = mountLibreria($('game'), {
    level,
    mode: m,
    saved,
    onEvent: (e) => {
      adapter.handle(e);
      recordWin(e);
    },
    onNext: i >= 0 && i < LEVELS.length - 1 ? () => ((levelSelect.value = LEVELS[i + 1].id), mount()) : null,
  });
  window.__libreria = game;
}

levelSelect.addEventListener('change', () => mount());
for (const r of document.querySelectorAll('input[name="mode"]')) r.addEventListener('change', () => mount());
$('unlock').addEventListener('click', () => {
  adapter.unlock();
  mount();
});
$('save').addEventListener('click', () => {
  if (!game) return;
  try {
    localStorage.setItem(SAVE_KEY, game.exportState());
  } catch {
    // Sin almacenamiento: la demo sigue
  }
});
$('load').addEventListener('click', () => {
  let saved = null;
  try {
    saved = localStorage.getItem(SAVE_KEY);
  } catch {
    saved = null;
  }
  if (saved) {
    const data = JSON.parse(saved);
    if (levelFor(data.level)) levelSelect.value = data.level;
    mount(saved);
  }
});
$('remount').addEventListener('click', () => mount(game?.exportState() ?? null));
// En la vista de app, «Volver al rincón» avisa a la vista previa que la contiene (si no hay, no hace nada)
$('app-back').addEventListener('click', () => window.parent !== window && window.parent.postMessage({ libreria: 'volver' }, location.origin));

window.__libreriaAdapter = adapter;
window.__libreriaWeekly = WEEKLY;
showAdapter(adapter.state);
mount();
