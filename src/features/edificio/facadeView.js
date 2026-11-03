// La fachada montada en la página (SPEC §64): el dibujo de facade.js y, encima, un botón por ventana (con su placa:
// puerta y quién vive). Al tocar una ventana, la vista se acerca a ella (te asomas) y entras; al volver, se aleja
// desde esa misma ventana. Con movimiento reducido, sin animación. Lo usan el panel de la app y la página de desarrollo.
import { DEFAULT_AVATAR, facingOf, validateAvatar } from './actor';
import { FACADE_H, FACADE_W, renderFacade } from './facade';
import { misticoOf, misticoSprite } from './misticos';
import { ROOM_SCALE, renderActorWalk } from './render';

const pct = (v) => `${(v * 100).toFixed(3)}%`;
const ZOOM = 3.4;
const ZOOM_MS = 520;
const ARRIVE_MS = 1100;
const WALK_PX_S = 30; // lo que anda tu personaje por el muelle, en píxeles del dibujo por segundo
const STEP_MS = 150; // cada fotograma de la tira de pasos
const FADE_MS = 200;
const PAL_LAG_MS = 380; // lo que tarda tu compañero en salir detrás de ti

// La última ventana a la que te asomaste: al volver al portal, la vista se aleja desde ella
let lastPeek = null;

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const centerOf = (w) => `${pct(w.left + w.width / 2)} ${pct(w.top + w.height * 0.45)}`;
const box = (node, r) => Object.assign(node.style, { left: pct(r.left), top: pct(r.top), width: pct(r.width), height: pct(r.height) });

/** Las estrellas ya pintadas: píxeles claros y sueltos en la parte de arriba (con el cielo alrededor). */
function findStars(canvas, max = 14) {
  const { width: w, height: h } = canvas;
  const data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const lum = (x, y) => {
    const i = (y * w + x) * 4;
    return data[i] * 0.3 + data[i + 1] * 0.55 + data[i + 2] * 0.15;
  };
  const found = [];
  for (let y = 2; y < h * 0.4; y += 1)
    for (let x = 1; x < w - 1; x += 1) {
      if (lum(x, y) > 200 && lum(x - 1, y) < 140 && lum(x + 1, y) < 140 && lum(x, y - 1) < 140 && lum(x, y + 1) < 140) found.push({ x, y });
    }
  // Unas pocas, repartidas (siempre las mismas: el dibujo no cambia)
  const step = Math.max(1, Math.floor(found.length / max));
  return found.filter((_, i) => i % step === 0).slice(0, max);
}

/** Una gaviota de píxeles, dos fotogramas (alas arriba y abajo) en una tira. */
function gullSprite() {
  const frames = [
    ['#.......#', '.##...##.', '...#.#...', '....#....'],
    ['.........', '.........', '###.#.###', '...###...'],
  ];
  const c = document.createElement('canvas');
  c.width = 18;
  c.height = 4;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f6eee0';
  frames.forEach((rows, f) => rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && ctx.fillRect(f * 9 + x, y, 1, 1))));
  return c.toDataURL();
}

/** Destellos del agua: rayitas de 2 a 4 píxeles en una tesela de 40 × 12 que se repite. */
function glintSprite() {
  const c = document.createElement('canvas');
  c.width = 40;
  c.height = 12;
  const ctx = c.getContext('2d');
  const dashes = [[3, 1, 3, '#ffe2b0'], [21, 3, 2, '#fff0d0'], [33, 6, 4, '#ffd9a0'], [11, 8, 2, '#fff0d0'], [26, 10, 3, '#ffe2b0']];
  for (const [x, y, w, color] of dashes) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 1);
  }
  return c.toDataURL();
}

/**
 * La vida de la fachada (1.65): estrellas que titilan, un brillo que corre por el agua, la luz de las ventanas habitadas
 * que respira y, de vez en cuando, una gaviota (1.78: dos, una estrella fugaz y luciérnagas en el muelle). Solo CSS
 * sobre el dibujo; con movimiento reducido, nada (lo quita el CSS).
 */
function ambientLayer(canvas, { panes, shore }) {
  const layer = document.createElement('div');
  layer.className = 'ed-ambient';
  layer.setAttribute('aria-hidden', 'true');
  // Un píxel del dibujo, en unidades del contenedor (la fachada)
  layer.style.setProperty('--px', `${(100 / FACADE_W).toFixed(4)}cqw`);
  for (const [k, s] of findStars(canvas).entries()) {
    const star = document.createElement('span');
    star.className = 'ed-star';
    box(star, { left: s.x / FACADE_W, top: s.y / FACADE_H, width: 1 / FACADE_W, height: 1 / FACADE_H });
    star.style.animationDelay = `${-((k * 1.37) % 5).toFixed(2)}s`;
    star.style.animationDuration = `${3 + (k % 4) * 0.9}s`;
    layer.append(star);
  }
  for (const [k, p] of panes.entries()) {
    const glow = document.createElement('span');
    glow.className = 'ed-glow';
    box(glow, p);
    glow.style.animationDelay = `${-((k * 2.3) % 7).toFixed(2)}s`;
    layer.append(glow);
  }
  const water = document.createElement('span');
  water.className = 'ed-water';
  const [a, b] = shore;
  water.style.backgroundImage = `url(${glintSprite()})`;
  water.style.clipPath = `polygon(${pct(a.x)} ${pct(a.y)}, ${pct(b.x)} ${pct(b.y)}, 100% 100%, 0 100%)`;
  layer.append(water);
  const sprite = gullSprite();
  // 1.78 (encargo del 3-11-2026, «algún efecto más en el edificio»): una segunda gaviota, más lejos y en sentido
  // contrario; una estrella fugaz de tarde en tarde; y luciérnagas sobre el muelle, junto al agua
  for (const cls of ['ed-gull', 'ed-gull ed-gull--far']) {
    const gull = document.createElement('span');
    gull.className = cls;
    gull.style.backgroundImage = `url(${sprite})`;
    layer.append(gull);
  }
  const shoot = document.createElement('span');
  shoot.className = 'ed-shoot';
  layer.append(shoot);
  const [s0, s1] = shore;
  for (let k = 0; k < 7; k += 1) {
    const u = (k + 0.5) / 7;
    const fly = document.createElement('span');
    fly.className = 'ed-firefly';
    // Un poco por encima de la orilla, repartidas a lo largo de ella
    fly.style.left = pct(s0.x + (s1.x - s0.x) * u);
    fly.style.top = pct(s0.y + (s1.y - s0.y) * u - 0.025 - (k % 3) * 0.012);
    fly.style.animationDelay = `${-((k * 1.7) % 6).toFixed(2)}s, ${-((k * 0.9) % 3).toFixed(2)}s`;
    layer.append(fly);
  }
  return layer;
}

/**
 * Tu personaje sale del portal y anda por el muelle (1.78, encargo del 3-11-2026: «que se vea yendo a los sitios»)
 * siguiendo `path` (puntos del suelo en fracciones del dibujo); al final se mete (se desvanece) y llama a `done`. Si
 * te acompaña un legendario (`who.companion`), va detrás, con un poco de retraso, moviéndose a su manera.
 * Devuelve una función que lo acaba ya (si vuelves a tocar mientras anda). Sin animaciones, `done` directamente.
 */
function walkAlong(stage, walk, who, path, done) {
  let over = false;
  const nodes = [];
  const runs = [];
  let raf = 0;
  const finish = () => {
    if (over) return;
    over = true;
    cancelAnimationFrame(raf);
    for (const n of nodes) n.remove();
    walk.front.remove();
    done();
  };
  // Sin aspecto guardado (o uno que ya no vale), el de siempre
  const look = who.avatar && validateAvatar(who.avatar) ? who.avatar : DEFAULT_AVATAR;
  const strips = new Map();
  const stripOf = (facing) => {
    if (!strips.has(facing)) strips.set(facing, renderActorWalk(look, { facing, S: walk.S, yaw: walk.yaw }));
    return strips.get(facing);
  };
  const sprite = (w, h) => {
    const el = document.createElement('span');
    el.className = 'ed-walker';
    el.setAttribute('aria-hidden', 'true');
    el.style.setProperty('--px', `${(100 / FACADE_W).toFixed(4)}cqw`);
    el.style.width = `calc(var(--px) * ${w})`;
    el.style.height = `calc(var(--px) * ${h})`;
    nodes.push(el);
    return el;
  };
  const first = stripOf(0);
  const el = sprite(first.w, first.h);
  const img = document.createElement('img');
  img.className = 'ed-walker__strip';
  img.alt = '';
  el.append(img);
  // El compañero, a la escala del personaje (los místicos se dibujan a la del piso)
  const pal = who.companion && misticoOf(who.companion)?.legendario ? misticoSprite(who.companion) : null;
  const k = walk.S / ROOM_SCALE;
  let palEl = null;
  const palState = { moving: true, flip: false };
  if (pal) {
    palEl = sprite(pal.canvas.width * k, pal.canvas.height * k);
    palEl.classList.add('ed-walker--pal');
    pal.canvas.className = 'ed-walker__pal';
    palEl.append(pal.canvas);
    const tick = (now) => {
      pal.paint(now / 1000, palState);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  // La limusina va delante del muelle: se pone encima, para que tape a los dos cuando pasan por detrás; todo, por
  // debajo de las placas, que siguen leyéndose encima
  const front = walk.front;
  front.className = 'ed-walker__front';
  front.setAttribute('aria-hidden', 'true');
  const flats = stage.querySelector('.ed-facade__flats');
  stage.insertBefore(front, flats);
  if (palEl) stage.insertBefore(palEl, front);
  stage.insertBefore(el, front);
  const at = (pt, sp) => ({ left: pct(pt.x - sp.ax / FACADE_W), top: pct(pt.y - sp.ay / FACADE_H) });
  const pts = [walk.door, ...path];
  runs.push(img.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-100%)' }], { duration: STEP_MS * 4, iterations: Infinity, easing: 'steps(4, jump-end)' }));
  const fade = (node, from, to) => {
    const a = node.animate([{ opacity: from }, { opacity: to }], { duration: FADE_MS, fill: 'forwards' });
    runs.push(a);
    return a.finished;
  };
  const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
  // Recorre el camino: `turn(dx, dy)` elige hacia dónde mira y devuelve dónde caen sus pies en el dibujo
  const go = async (node, turn) => {
    Object.assign(node.style, at(walk.door, turn(0, 1)));
    await fade(node, 0, 1);
    for (let i = 1; i < pts.length && !over; i += 1) {
      const a = pts[i - 1];
      const b = pts[i];
      const dx = (b.x - a.x) * FACADE_W;
      const dy = (b.y - a.y) * FACADE_H;
      const sp = turn(dx, dy);
      const run = node.animate([at(a, sp), at(b, sp)], { duration: (Math.hypot(dx, dy) / WALK_PX_S) * 1000, fill: 'forwards' });
      runs.push(run);
      await run.finished;
    }
    await fade(node, 1, 0);
  };
  const walking = go(el, (dx, dy) => {
    // En la pantalla, bajar es acercarse (más y) e ir a la derecha es más x: así se elige hacia dónde mira
    const facing = facingOf(dx, dy, 0);
    img.src = stripOf(facing).canvas.toDataURL();
    return stripOf(facing);
  });
  const following = palEl
    ? wait(PAL_LAG_MS).then(() =>
        go(palEl, (dx) => {
          if (Math.abs(dx) > 0.5) palState.flip = dx < 0;
          return { ax: pal.ax * k, ay: pal.ay * k };
        }),
      )
    : null;
  Promise.all([walking, following]).then(finish, finish);
  return () => {
    for (const r of runs) r.cancel();
    finish();
  };
}

/**
 * `flats`: [{ puerta, room, label (aria), name (placa), mine, badge, onOpen }] de las puertas ocupadas. Devuelve
 * { destroy }. `onOpenShop` (opcional) hace tocable la tienda del bajo, con `shopBadge` en su placa (p. ej. el saldo).
 * `mail` (opcional, 1.73): { lines: [texto] } con el correo del buzón dibujado junto al portal (sellos, regalos y firmas).
 * `onOpenLimo` (opcional, 1.74): hace tocable la limusina negra aparcada en el muelle, que lleva al Gran Hotel.
 * `walker` (opcional, 1.78): { avatar, companion } de tu personaje (companion: el legendario que te sigue, o null); con él, antes de entrar en la tienda o de subir a la limusina,
 * sale del portal y va andando hasta allí (con movimiento reducido, directo).
 */
export function mountFacade(container, { flats, onOpenShop = null, shopBadge = '', mail = null, onOpenLimo = null, walker = null }) {
  const byDoor = Object.fromEntries(flats.map((f) => [f.puerta, { room: f.room }]));
  const { canvas, windows, panes, shore, shop, mailbox, limo, walk, sign } = renderFacade(byDoor);
  const root = document.createElement('div');
  root.className = 'ed-facade';
  root.style.aspectRatio = `${FACADE_W} / ${FACADE_H}`;
  // Que el edificio entero quepa en la pantalla también en escritorio
  root.style.maxWidth = `min(460px, calc(78dvh * ${(FACADE_W / FACADE_H).toFixed(4)}))`;
  const stage = document.createElement('div');
  stage.className = 'ed-facade__stage';
  root.append(stage);
  let busy = false;
  // Mientras tu personaje anda, tocar otra vez lo acaba ya (`skipWalk`)
  let skipWalk = null;
  const canWalk = () => Boolean(walker) && !reducedMotion() && typeof stage.animate === 'function';
  const walkThen = (path, then) => {
    busy = true;
    const after = () => {
      skipWalk = null;
      then();
    };
    try {
      skipWalk = walkAlong(stage, walk, walker, path, after);
    } catch {
      // Si no se puede dibujar el paseo, se entra directamente
      after();
    }
  };
  canvas.className = 'ed-facade__art';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `La fachada del edificio. En la azotea, un cartel: «${sign}».`);
  stage.append(canvas, ambientLayer(canvas, { panes, shore }));

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
  // La tienda del bajo (1.67, §67): se entra igual que en un piso, asomándose a su escaparate
  if (onOpenShop) {
    const li = document.createElement('li');
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'ed-window ed-shop';
    el.setAttribute('aria-label', 'Entrar en la tienda del bajo');
    box(el, shop);
    const plate = document.createElement('span');
    plate.className = 'ed-window__plate';
    const name = document.createElement('strong');
    name.textContent = 'Tienda';
    plate.append(name);
    if (shopBadge) {
      const who = document.createElement('span');
      who.textContent = shopBadge;
      plate.append(who);
    }
    el.append(plate);
    const peekShop = () => {
      busy = true;
      root.classList.add('is-peeking');
      stage.style.transformOrigin = centerOf(shop);
      const run = stage.animate([{ transform: 'scale(1)' }, { transform: `scale(${ZOOM})` }], { duration: ZOOM_MS, easing: 'cubic-bezier(0.55, 0, 0.75, 0.2)', fill: 'forwards' });
      run.finished.then(onOpenShop, onOpenShop);
    };
    el.addEventListener('click', () => {
      if (skipWalk) return skipWalk();
      if (busy) return;
      lastPeek = { shop: true, at: Date.now() };
      if (reducedMotion() || typeof stage.animate !== 'function') {
        onOpenShop();
        return;
      }
      // Tu personaje va andando hasta la puerta de la tienda y, al entrar, te asomas a su escaparate
      if (canWalk()) walkThen(walk.shop, peekShop);
      else peekShop();
    });
    li.append(el);
    list.append(li);
  }
  // La limusina negra (1.74, §74): el chófer espera; al tocarla, al Gran Hotel
  if (onOpenLimo) {
    const li = document.createElement('li');
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'ed-window ed-limo';
    el.setAttribute('aria-label', 'Coger la limusina al Gran Hotel');
    box(el, limo);
    const plate = document.createElement('span');
    plate.className = 'ed-window__plate';
    const name = document.createElement('strong');
    name.textContent = 'Al Gran Hotel';
    plate.append(name);
    el.append(plate);
    el.addEventListener('click', () => {
      if (skipWalk) return skipWalk();
      if (busy) return;
      // Tu personaje va andando hasta la limusina y sube; luego, el viaje
      if (canWalk()) walkThen(walk.limo, onOpenLimo);
      else onOpenLimo();
    });
    li.append(el);
    list.append(li);
  }
  stage.append(list);
  // El buzón (1.73, en lugar de la tarjeta «Tu buzón»): si hay algo nuevo, asoma una carta con cuántas cosas son; al
  // tocarlo, una nota de papel encima del buzón dice qué hay. Se cierra tocando otra vez o fuera. Desde la 1.78, lo
  // leído deja de contar (`mail.read`, y `mail.onRead` lo guarda): la carta se va al abrir la nota y no vuelve.
  let offOutside = null;
  if (mail) {
    const read = mail.read ?? new Set();
    let n = mail.lines.filter((l) => !read.has(l)).length;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'ed-mailnote');
    // Un poco más grande que el dibujo, para el dedo
    box(btn, { left: mailbox.left - mailbox.width * 0.5, top: mailbox.top - mailbox.height * 0.7, width: mailbox.width * 2, height: mailbox.height * 1.9 });
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
    const note = document.createElement('div');
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
    note.style.left = pct(Math.min(0.62, Math.max(0.04, mailbox.left - 0.18)));
    note.style.bottom = pct(1 - mailbox.top + 0.02);
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
    root.append(btn, note);
  }
  container.replaceChildren(root);
  // Vuelves de un piso: la vista se aleja desde su ventana
  const back = lastPeek && Date.now() - lastPeek.at < 10 * 60 * 1000 ? (lastPeek.shop ? shop : windows.find((x) => x.puerta === lastPeek.puerta)) : null;
  lastPeek = null;
  if (back && !reducedMotion() && typeof stage.animate === 'function') {
    stage.style.transformOrigin = centerOf(back);
    stage.animate([{ transform: `scale(${ZOOM})` }, { transform: 'scale(1)' }], { duration: ZOOM_MS, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
  } else if (!back && !reducedMotion() && typeof stage.animate === 'function') {
    // Llegas por el muelle: la vista sube desde el agua hasta el cartel y las placas aparecen al final
    root.classList.add('is-arriving');
    stage.style.transformOrigin = '50% 100%';
    const run = stage.animate(
      [
        { transform: 'scale(1.35) translateY(-4%)', filter: 'brightness(0.75)' },
        { transform: 'scale(1)', filter: 'brightness(1)' },
      ],
      { duration: ARRIVE_MS, easing: 'cubic-bezier(0.25, 0.6, 0.25, 1)' },
    );
    run.finished.then(
      () => root.classList.remove('is-arriving'),
      () => root.classList.remove('is-arriving'),
    );
  }
  return {
    destroy() {
      offOutside?.();
      skipWalk = null;
      root.remove();
    },
  };
}
