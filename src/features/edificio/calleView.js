// El portal del edificio en 3D («Exteriores en 3D», 11-11-2026): la calle de calle3d.js a pantalla completa y, encima,
// los mismos botones que en la fachada 2D (facadeView.js), cada uno sobre lo que toca en 3D y movido con la vista: un
// piso por cuerpo de ventanas, con su placa; la tienda del bajo; el buzón con su nota, y la limusina. Al tocar un piso o
// la tienda, la vista se acerca (te asomas) y entras; al volver, se aleja desde allí. Arrastrar, también encima de los
// botones, gira la vista. Si no hay WebGL (o se pierde), se monta la fachada 2D de siempre.
import { EYE, SPOTS, mountCalle } from './calle3d';
import { FACADE_PARTS, FLATS } from './facade';
import { mountFacade } from './facadeView';
import { olvidarSalida, vienesDeSalir } from './salida';

const { BD } = FACADE_PARTS;
const ZOOM = 3.2;
const ZOOM_MS = 520;
const ARRIVE_MS = 1300;
// Salir del portal (del umbral a la vista de siempre) y andar a la limusina o a la tienda
const LEAVE_MS = 3400;
const WALK_MS = 1700;

// Lo último en lo que entraste: al volver al portal, la vista se aleja desde ahí
let lastPeek = null;
// Si el portal se vuelve a montar enseguida (llega el correo o el saldo), sigue donde estaba: ni llegada ni giro nuevos
let lastView = null;

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Rectángulos del mundo de la app (en un plano de y fija) para cada botón. */
const BAY = (f) => ({ x0: f.x0 - 0.05, x1: f.x1 + 0.05, z0: f.z0 + 0.25, z1: f.gz1 + 0.36, y: BD + 0.2 });
const SHOP = { x0: 5.15, x1: 7.8, z0: 0.95, z1: 2.15, y: BD + 0.3 };
const LIMO = { x0: 4.3, x1: 8.25, z0: 0, z1: 0.95, y: BD + 1.5 };
const MAILBOX = { x0: 2.7, x1: 3.46, z0: 0.6, z1: 1.55, y: BD + 0.25 };

/** Mismas opciones que mountFacade (facadeView.js). Devuelve { destroy }. */
export function mountCalleView(container, opts) {
  const { flats, onOpenShop = null, shopBadge = '', mail = null, onOpenLimo = null } = opts;
  const root = document.createElement('div');
  root.className = 'ed-facade ed-calle';
  const stage = document.createElement('div');
  stage.className = 'ed-facade__stage';
  const view = document.createElement('div');
  view.className = 'ed-calle__view';
  stage.append(view);
  root.append(stage);
  container.replaceChildren(root);

  let fallback = null;
  let calle = null;
  let busy = false;
  const spots = [];
  let offOutside = null;
  let note = null;
  let mailBtn = null;
  const place = () => {
    if (!calle) return;
    const w = view.clientWidth;
    const h = view.clientHeight;
    for (const { el, r } of spots) {
      const pts = [
        [r.x0, r.z0],
        [r.x1, r.z0],
        [r.x0, r.z1],
        [r.x1, r.z1],
      ].map(([x, z]) => calle.toScreen(x, r.y, z));
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      // Lo que asoma por un borde (la limusina, girando) se toca solo en lo que se ve
      const left = Math.max(0, Math.min(...xs));
      const top = Math.max(0, Math.min(...ys));
      const right = Math.min(w, Math.max(...xs));
      const bottom = Math.min(h, Math.max(...ys));
      // Fuera de la vista (o casi), el botón no se ve ni se toca, pero sigue ahí para el teclado y los lectores de
      // pantalla: al llegar a él, la vista gira hasta él
      const off = pts.some((p) => !p.visible) || right - left < w * 0.06 || bottom - top < 4;
      el.classList.toggle('is-off', off);
      Object.assign(el.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });
    }
    if (note && mailBtn) {
      // La nota mide min(62 %, 260 px) de ancho (edificio.css): que no se salga por la derecha
      note.style.left = `${Math.min(w - Math.min(w * 0.62, 260) - 8, Math.max(w * 0.04, parseFloat(mailBtn.style.left) - w * 0.18))}px`;
      note.style.bottom = `${h - parseFloat(mailBtn.style.top) + 6}px`;
    }
  };

  const byDoor = Object.fromEntries(flats.map((f) => [f.puerta, { room: f.room }]));
  const toFallback = () => {
    if (fallback) return;
    calle?.destroy();
    calle = null;
    offOutside?.();
    fallback = mountFacade(container, opts);
  };
  // Se olvida al terminar de alejarse, no al montar: en desarrollo (StrictMode) el portal se monta dos veces seguidas
  const back = lastPeek && Date.now() - lastPeek.at < 10 * 60 * 1000 ? lastPeek : null;
  const forget = () => {
    if (lastPeek === back) lastPeek = null;
  };
  // Sales de tu piso por la puerta: apareces en el umbral del portal, mirando al muelle, y te das la vuelta
  const leaving = !back && vienesDeSalir();
  const again = !back && lastView && Date.now() - lastView.at < 4000 ? lastView : null;
  try {
    calle = mountCalle(view, {
      flats: byDoor,
      dragArea: stage,
      // Llegas por el muelle: con la vista algo baja, que sube hasta el cartel (si vuelves de dentro, ya está arriba)
      startPitch: again ? again.pitch : back || reducedMotion() ? 0 : -0.28,
      startYaw: again?.yaw ?? back?.yaw ?? 0,
      onFrame: place,
      onLost: toFallback,
    });
  } catch {
    toFallback();
    return { destroy: () => fallback?.destroy() };
  }
  // Con la clase del dibujo 2D, para los estilos y las pruebas que tocan fuera de los botones
  calle.canvas.classList.add('ed-facade__art');
  calle.canvas.setAttribute('aria-label', 'El edificio del puerto desde el muelle, con el cartel «AQUÍ NO HAY QUIEN LEA». Arrastra o usa las flechas para mirar.');

  const peek = (el, then) => {
    if (reducedMotion() || typeof stage.animate !== 'function') {
      then();
      return;
    }
    busy = true;
    root.classList.add('is-peeking');
    const cx = parseFloat(el.style.left) + parseFloat(el.style.width) / 2;
    const cy = parseFloat(el.style.top) + parseFloat(el.style.height) * 0.45;
    stage.style.transformOrigin = `${cx}px ${cy}px`;
    const run = stage.animate([{ transform: 'scale(1)' }, { transform: `scale(${ZOOM})` }], { duration: ZOOM_MS, easing: 'cubic-bezier(0.55, 0, 0.75, 0.2)', fill: 'forwards' });
    run.finished.then(then, then);
  };
  // Andar hasta un sitio de SPOTS mirando a un rectángulo; los botones se esconden mientras (no se pulsan a medio paso)
  const walking = (on) => {
    busy = on;
    root.classList.toggle('is-walking', on);
  };
  const walkTo = (spot, r, pitch) => {
    const p = SPOTS[spot];
    walking(true);
    return calle.walk([{ spot, yaw: Math.atan2((r.x0 + r.x1) / 2 - p.x, p.y - r.y), pitch }], { ms: WALK_MS }).then(() => walking(false));
  };
  const plateOf = (title, sub) => {
    const plate = document.createElement('span');
    plate.className = 'ed-window__plate';
    const strong = document.createElement('strong');
    strong.textContent = title;
    plate.append(strong);
    if (sub) {
      const span = document.createElement('span');
      span.textContent = sub;
      plate.append(span);
    }
    return plate;
  };

  const list = document.createElement('ul');
  list.className = 'ed-facade__flats';
  // De arriba abajo, como se lee un edificio (y como se recorren con el tabulador)
  for (const puerta of ['3A', '3B', '2A', '2B', '1A', '1B']) {
    const f = FLATS.find((x) => x.puerta === puerta);
    const flat = flats.find((x) => x.puerta === puerta);
    const li = document.createElement('li');
    const el = document.createElement(flat ? 'button' : 'div');
    el.className = `ed-window${flat?.mine ? ' ed-window--mine' : ''}${flat ? '' : ' ed-window--free ed-door--free'}`;
    el.append(plateOf(`${puerta[0]}.º ${puerta[1]}`, flat ? flat.name : 'Libre'));
    if (flat) {
      el.type = 'button';
      el.setAttribute('aria-label', flat.label);
      el.addEventListener('click', () => {
        if (busy) return;
        lastPeek = { at: Date.now(), yaw: calle?.yaw() ?? 0, puerta };
        peek(el, flat.onOpen);
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
    spots.push({ el, r: BAY(f), key: puerta });
  }
  if (onOpenShop) {
    const li = document.createElement('li');
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'ed-window ed-shop';
    el.setAttribute('aria-label', 'Entrar en la tienda del bajo');
    el.append(plateOf('Tienda', shopBadge));
    el.addEventListener('click', () => {
      if (busy) return;
      lastPeek = { at: Date.now(), yaw: calle?.yaw() ?? 0, shop: true };
      // Andas hasta el escaparate y te asomas
      walkTo('shop', SHOP, 0).then(() => peek(el, onOpenShop));
    });
    li.append(el);
    list.append(li);
    spots.push({ el, r: SHOP, key: 'shop' });
  }
  if (onOpenLimo) {
    const li = document.createElement('li');
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'ed-window ed-limo';
    el.setAttribute('aria-label', 'Coger la limusina al Gran Hotel');
    el.append(plateOf('Al Gran Hotel'));
    el.addEventListener('click', () => {
      if (busy) return;
      // Vas andando hasta la limusina antes de subir
      walkTo('limo', LIMO, -0.2).then(onOpenLimo);
    });
    li.append(el);
    list.append(li);
    spots.push({ el, r: LIMO, key: 'limo' });
  }
  stage.append(list);
  for (const { el, r } of spots.filter((x) => x.key !== 'mail')) {
    el.addEventListener('focus', () => {
      if (el.classList.contains('is-off')) calle?.glideTo(Math.atan2((r.x0 + r.x1) / 2 - EYE.x, EYE.y - r.y), 0, 500);
    });
  }

  // El buzón (como en la fachada 2D): una carta asoma si hay algo nuevo; al tocarlo, una nota encima dice qué hay
  if (mail) {
    const read = mail.read ?? new Set();
    let n = mail.lines.filter((l) => !read.has(l)).length;
    const btn = document.createElement('button');
    mailBtn = btn;
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'ed-mailnote');
    const letter = document.createElement('span');
    letter.className = 'ed-mailbox__letter';
    letter.setAttribute('aria-hidden', 'true');
    const count = document.createElement('b');
    letter.append(count);
    const paint = () => {
      btn.className = `ed-mailbox${n ? ' has-mail' : ''}`;
      btn.setAttribute('aria-label', n ? `Tu buzón: ${n === 1 ? 'una cosa nueva' : `${n} cosas nuevas`}` : mail.lines.length ? 'Tu buzón, ya leído' : 'Tu buzón, vacío');
      count.textContent = n > 9 ? '9+' : String(n);
      if (n) btn.append(letter);
      else letter.remove();
    };
    paint();
    note = document.createElement('div');
    note.className = 'ed-mailnote';
    note.id = 'ed-mailnote';
    note.hidden = true;
    note.setAttribute('role', 'region');
    note.setAttribute('aria-label', 'Tu buzón');
    if (mail.lines.length) {
      const ul = document.createElement('ul');
      for (const line of mail.lines) {
        const li = document.createElement('li');
        li.textContent = line;
        if (!read.has(line)) li.className = 'is-new';
        ul.append(li);
      }
      note.append(ul);
    } else {
      const p = document.createElement('p');
      p.textContent = 'Nada por ahora. Cuando un vecino firme tu libro de visitas o te regale algo, aparecerá aquí.';
      note.append(p);
    }
    const show = (open) => {
      note.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      root.classList.toggle('is-reading-mail', open);
      if (open && n) {
        n = 0;
        mail.onRead?.(mail.lines);
        paint();
      }
    };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      show(note.hidden);
    });
    note.addEventListener('click', (e) => e.stopPropagation());
    const outside = () => show(false);
    document.addEventListener('click', outside);
    offOutside = () => document.removeEventListener('click', outside);
    stage.append(btn);
    root.append(note);
    spots.push({ el: btn, r: MAILBOX, key: 'mail' });
  }

  // Al llegar: la vista sube desde el muelle hasta el cartel y las placas aparecen al final. Al volver de dentro, se
  // aleja desde donde entraste
  if (leaving || again?.walking) {
    // Del umbral (mirando al muelle) a unos pasos, girando, y a la vista de siempre. Si el portal se vuelve a montar a
    // medio camino, sigue desde donde iba
    const keys = [
      { spot: 'turn', yaw: Math.PI * 0.72, pitch: -0.04 },
      { spot: 'home', yaw: 0, pitch: 'home' },
    ];
    const from = again?.walking ? again.pose : { spot: 'door', yaw: Math.PI, pitch: -0.06 };
    walking(true);
    calle.walk(again?.walking ? keys.slice(again.pose.y > SPOTS.turn.y - 0.2 ? 1 : 0) : keys, { from, ms: again?.walking ? 1400 : LEAVE_MS }).then(() => {
      walking(false);
      olvidarSalida();
    });
  } else if (back && !reducedMotion() && typeof stage.animate === 'function') {
    const spot = spots.find((s) => s.key === (back.shop ? 'shop' : back.puerta));
    busy = true;
    root.classList.add('is-returning');
    // Sin esperar a un fotograma: la primera imagen ya sale ampliada sobre esa ventana
    {
      place();
      const el = spot?.el;
      if (el) stage.style.transformOrigin = `${parseFloat(el.style.left) + parseFloat(el.style.width) / 2}px ${parseFloat(el.style.top) + parseFloat(el.style.height) * 0.45}px`;
      const run = stage.animate([{ transform: `scale(${ZOOM})` }, { transform: 'scale(1)' }], { duration: ZOOM_MS, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
      const done = () => {
        forget();
        busy = false;
        root.classList.remove('is-returning');
      };
      run.finished.then(done, done);
    }
  } else if (back) forget();
  else if (!again && !reducedMotion()) {
    root.classList.add('is-arriving');
    calle.glideTo(0, 0, ARRIVE_MS);
    setTimeout(() => root.classList.remove('is-arriving'), ARRIVE_MS);
  } else if (again?.arriving) {
    // Se montó otra vez a media llegada: que termine de subir
    root.classList.add('is-arriving');
    calle.glideTo(0, 0, Math.max(300, ARRIVE_MS - (Date.now() - again.since)));
    setTimeout(() => root.classList.remove('is-arriving'), Math.max(300, ARRIVE_MS - (Date.now() - again.since)));
  }
  const since = again?.since ?? Date.now();

  return {
    /** Para las pruebas y la página de desarrollo. */
    calle: () => calle,
    destroy() {
      offOutside?.();
      if (calle)
        lastView = {
          at: Date.now(),
          yaw: calle.yaw(),
          pitch: calle.pitch() - calle.pitchHome(),
          since,
          arriving: root.classList.contains('is-arriving'),
          // A medio salir del portal: el próximo montaje sigue andando desde aquí
          walking: (leaving || again?.walking) && calle.walking(),
          pose: { ...calle.where(), yaw: calle.yaw(), pitch: calle.pitch() },
        };
      calle?.destroy();
      fallback?.destroy();
      root.remove();
    },
  };
}
