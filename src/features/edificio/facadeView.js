// La fachada montada en la página (SPEC §64): el dibujo de facade.js y, encima, un botón por ventana (con su placa:
// puerta y quién vive). Al tocar una ventana, la vista se acerca a ella (te asomas) y entras; al volver, se aleja
// desde esa misma ventana. Con movimiento reducido, sin animación. Lo usan el panel de la app y la página de desarrollo.
import { FACADE_H, FACADE_W, renderFacade } from './facade';

const pct = (v) => `${(v * 100).toFixed(3)}%`;
const ZOOM = 3.4;
const ZOOM_MS = 520;

// La última ventana a la que te asomaste: al volver al portal, la vista se aleja desde ella
let lastPeek = null;

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const centerOf = (w) => `${pct(w.left + w.width / 2)} ${pct(w.top + w.height * 0.45)}`;

/**
 * `flats`: [{ puerta, room, label (aria), name (placa), mine, badge, onOpen }] de las puertas ocupadas. Devuelve
 * { destroy }.
 */
export function mountFacade(container, { flats }) {
  const byDoor = Object.fromEntries(flats.map((f) => [f.puerta, { room: f.room }]));
  const { canvas, windows, sign } = renderFacade(byDoor);
  const root = document.createElement('div');
  root.className = 'ed-facade';
  root.style.aspectRatio = `${FACADE_W} / ${FACADE_H}`;
  // Que el edificio entero quepa en la pantalla también en escritorio
  root.style.maxWidth = `min(460px, calc(78dvh * ${(FACADE_W / FACADE_H).toFixed(4)}))`;
  const stage = document.createElement('div');
  stage.className = 'ed-facade__stage';
  root.append(stage);
  let busy = false;
  canvas.className = 'ed-facade__art';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `La fachada del edificio. En la azotea, un cartel: «${sign}».`);
  stage.append(canvas);

  const list = document.createElement('ul');
  list.className = 'ed-facade__flats';
  // De arriba abajo, como se lee un edificio (y como se recorren con el tabulador)
  const order = ['3A', '3B', '2A', '2B', '1A', '1B'];
  for (const puerta of order) {
    const w = windows.find((x) => x.puerta === puerta);
    const flat = flats.find((f) => f.puerta === puerta);
    const li = document.createElement('li');
    const el = document.createElement(flat ? 'button' : 'div');
    el.className = `ed-window${flat?.mine ? ' ed-window--mine' : ''}${flat ? '' : ' ed-window--free ed-door--free'}`;
    Object.assign(el.style, { left: pct(w.left), top: pct(w.top), width: pct(w.width), height: pct(w.height) });
    const plate = document.createElement('span');
    plate.className = 'ed-window__plate';
    const door = document.createElement('strong');
    door.textContent = `${puerta[0]}.º ${puerta[1]}`;
    const who = document.createElement('span');
    who.textContent = flat ? flat.name : 'Libre';
    plate.append(door, who);
    el.append(plate);
    if (flat) {
      el.type = 'button';
      el.setAttribute('aria-label', flat.label);
      el.addEventListener('click', () => {
        if (busy) return;
        lastPeek = { puerta, at: Date.now() };
        if (reducedMotion() || typeof stage.animate !== 'function') {
          flat.onOpen();
          return;
        }
        busy = true;
        root.classList.add('is-peeking');
        stage.style.transformOrigin = centerOf(w);
        const run = stage.animate([{ transform: 'scale(1)' }, { transform: `scale(${ZOOM})` }], { duration: ZOOM_MS, easing: 'cubic-bezier(0.55, 0, 0.75, 0.2)', fill: 'forwards' });
        run.finished.then(() => flat.onOpen(), () => flat.onOpen());
      });
      if (flat.badge) {
        const badge = document.createElement('span');
        badge.className = 'ed-window__badge';
        badge.textContent = flat.badge;
        el.append(badge);
      }
    } else {
      el.setAttribute('aria-label', `${puerta[0]}.º ${puerta[1]}: puerta libre`);
      el.setAttribute('role', 'img');
    }
    li.append(el);
    list.append(li);
  }
  stage.append(list);
  container.replaceChildren(root);
  // Vuelves de un piso: la vista se aleja desde su ventana
  const back = lastPeek && Date.now() - lastPeek.at < 10 * 60 * 1000 ? windows.find((x) => x.puerta === lastPeek.puerta) : null;
  lastPeek = null;
  if (back && !reducedMotion() && typeof stage.animate === 'function') {
    stage.style.transformOrigin = centerOf(back);
    stage.animate([{ transform: `scale(${ZOOM})` }, { transform: 'scale(1)' }], { duration: ZOOM_MS, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
  }
  return {
    destroy() {
      root.remove();
    },
  };
}
