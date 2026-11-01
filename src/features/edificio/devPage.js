// Página de desarrollo de «El edificio del puerto» (/dev/edificio-puerto.html). No forma parte de la app ni del build:
// el portal del edificio, tu piso (se decora y se guarda solo en este navegador) y los pisos de cinco vecinos inventados,
// que se visitan y en cuyo buzón se puede dejar un sello. Nada toca la biblioteca, la nube ni las recompensas.
import { DEMO_INBOX, NEIGHBOURS, SELLOS, starterRoom } from './demo';
import { mountPiso } from './piso';
import { ART_H, ART_W, createRoomRenderer } from './render';
import { exportRoom, importRoom } from './room';

const ROOM_KEY = 'bookshelf:dev:edificio-puerto:piso';
const SELLOS_KEY = 'bookshelf:dev:edificio-puerto:sellos';
const SOUND_KEY = 'bookshelf:dev:edificio-puerto:sonido';

const params = new URLSearchParams(location.search);
if (params.get('vista') === 'app') document.body.classList.add('is-app');

const $ = (id) => document.getElementById(id);
const portal = $('portal');
const pisoView = $('piso');
const doors = $('doors');
const inbox = $('inbox');
const mount = $('piso-mount');
const title = $('piso-title');
const sub = $('piso-sub');
const sellosBox = $('sellos');
const selloRow = $('sello-row');
const selloMsg = $('sello-msg');
const soundBtn = $('sound');

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* sin almacenamiento: el piso dura lo que la página */
  }
}

let muted = read(SOUND_KEY) !== 'si';
let myRoom = importRoom(read(ROOM_KEY) ?? '') ?? starterRoom();
let sellos = {};
try {
  sellos = JSON.parse(read(SELLOS_KEY) ?? '{}') ?? {};
} catch {
  sellos = {};
}
const rooms = new Map(NEIGHBOURS.filter((n) => !n.propio).map((n) => [n.id, n.room()]));
const roomOf = (n) => (n.propio ? myRoom : rooms.get(n.id));
let current = null;

// ── Portal ──
const thumbRenderer = createRoomRenderer();
const thumbCanvas = document.createElement('canvas');
thumbCanvas.width = ART_W;
thumbCanvas.height = ART_H;
const thumbCtx = thumbCanvas.getContext('2d');
const thumbImage = thumbCtx.createImageData(ART_W, ART_H);

function thumbOf(room) {
  thumbRenderer.bake(room);
  thumbRenderer.draw(thumbCtx, thumbImage, { evening: true });
  return thumbCanvas.toDataURL();
}

const PODIO = { semana: 'Podio de la semana', mes: 'Podio del mes' };

function renderPortal() {
  doors.replaceChildren();
  for (const n of NEIGHBOURS) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `door${n.propio ? ' door--mine' : ''}`;
    b.setAttribute('aria-label', n.propio ? `Entrar en tu piso, ${n.puerta}` : `Llamar y entrar en el piso de ${n.nombre}, ${n.puerta}`);
    const img = document.createElement('img');
    img.src = thumbOf(roomOf(n));
    img.alt = '';
    img.width = ART_W;
    img.height = ART_H;
    const label = document.createElement('span');
    label.className = 'door__label';
    const door = document.createElement('strong');
    door.textContent = n.puerta;
    const who = document.createElement('span');
    who.textContent = n.propio ? 'Tu piso' : `${n.nombre} · de prueba`;
    label.append(door, who);
    b.append(img, label);
    if (n.podio) {
      const badge = document.createElement('span');
      badge.className = 'door__badge';
      badge.textContent = PODIO[n.podio];
      b.append(badge);
    }
    b.addEventListener('click', () => open(n.id, true));
    li.append(b);
    doors.append(li);
  }
  inbox.replaceChildren(
    ...DEMO_INBOX.map((s) => {
      const li = document.createElement('li');
      li.textContent = `${s.de} (${s.puerta}) te dejó «${SELLOS.find((x) => x.id === s.sello).texto}».`;
      return li;
    }),
  );
}

// ── Un piso ──
function renderSellos(n) {
  selloRow.replaceChildren();
  selloMsg.textContent = '';
  for (const s of SELLOS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sello';
    b.textContent = s.texto;
    b.setAttribute('aria-pressed', String(sellos[n.id] === s.id));
    b.addEventListener('click', () => {
      sellos = { ...sellos, [n.id]: s.id };
      write(SELLOS_KEY, JSON.stringify(sellos));
      for (const x of selloRow.children) x.setAttribute('aria-pressed', String(x === b));
      selloMsg.textContent = `Has dejado «${s.texto}» en el buzón de ${n.nombre}. Puedes cambiarlo cuando quieras.`;
      current?.api.setMuted(muted);
    });
    selloRow.append(b);
  }
  if (sellos[n.id]) selloMsg.textContent = `Ya le dejaste «${SELLOS.find((x) => x.id === sellos[n.id]).texto}».`;
}

function open(id, push) {
  const n = NEIGHBOURS.find((x) => x.id === id);
  if (!n) return showPortal(push);
  current?.api.destroy();
  portal.hidden = true;
  pisoView.hidden = false;
  title.textContent = n.propio ? `Tu piso · ${n.puerta}` : `Piso de ${n.nombre} · ${n.puerta}`;
  sub.textContent = n.propio ? 'Se guarda solo en este navegador.' : 'Piso de prueba con datos inventados: solo se puede mirar.';
  if (n.podio) sub.textContent += ` En su puerta: «${PODIO[n.podio]}».`;
  sellosBox.hidden = !!n.propio;
  const api = mountPiso(mount, {
    room: roomOf(n),
    editable: !!n.propio,
    evening: false,
    muted,
    label: n.propio ? `Tu piso, ${n.puerta}` : `Piso de ${n.nombre}, ${n.puerta}`,
    onChange: (room) => {
      myRoom = room;
      write(ROOM_KEY, exportRoom(room));
    },
    onAction: n.propio ? () => location.assign(`/dev/libreria-puerto.html?nivel=semana${document.body.classList.contains('is-app') ? '&vista=pc' : ''}`) : null,
  });
  current = { id, api };
  if (!n.propio) renderSellos(n);
  if (push) history.pushState({ piso: id }, '', `?${new URLSearchParams({ ...Object.fromEntries(params), piso: id })}`);
  title.focus({ preventScroll: false });
  window.scrollTo({ top: 0 });
}

function showPortal(push) {
  current?.api.destroy();
  current = null;
  pisoView.hidden = true;
  portal.hidden = false;
  renderPortal();
  if (push) {
    const p = new URLSearchParams(params);
    p.delete('piso');
    history.pushState({}, '', `?${p}`);
  }
}

$('back').addEventListener('click', () => showPortal(true));
window.addEventListener('popstate', () => {
  const id = new URLSearchParams(location.search).get('piso');
  if (id) open(id, false);
  else showPortal(false);
});

soundBtn.setAttribute('aria-pressed', String(!muted));
soundBtn.addEventListener('click', () => {
  muted = !muted;
  write(SOUND_KEY, muted ? 'no' : 'si');
  soundBtn.setAttribute('aria-pressed', String(!muted));
  current?.api.setMuted(muted);
});

$('reset').addEventListener('click', () => {
  myRoom = starterRoom();
  write(ROOM_KEY, exportRoom(myRoom));
  if (current && NEIGHBOURS.find((n) => n.id === current.id)?.propio) open(current.id, false);
  else renderPortal();
});

const start = params.get('piso');
if (start) open(start, false);
else showPortal(false);

// Para las pruebas
window.__edificio = {
  get piso() {
    return current?.api ?? null;
  },
  open: (id) => open(id, true),
};
