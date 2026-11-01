// «La tienda del bajo» (1.67, SPEC §67; fases 2 y 4 de docs/qa/economia-muebles.md): se entra por el escaparate de la
// planta baja. Por dentro es el antiguo videoclub (shopScene.js): la pared de sobres de la temporada colgados de sus
// ganchos, el dependiente detrás del mostrador y su bocadillo abajo, que cuenta qué trae cada sobre. Los tickets solo se
// ganan leyendo (misiones semanales) y aquí se gastan: sobres por tipo, de 1 o de 5, con las probabilidades a la vista y
// el pity contado; muebles sueltos a precio fijo (lo raro solo sale en sobres); y reciclar lo que no está colocado.
// Todo lo decide el servidor; esto enseña y pide confirmación antes de gastar.
import { useEffect, useMemo, useState } from 'react';
import { CATALOG, catalogItem } from './catalog';
import { MISION_TICKETS, PITY, SOBRES, TEMPORADA, TIENDA, costeDe, oddsTable, precioDe, rarezaInfo, rarezaOf, sobreOf, sobresHastaRaro, ticketsText } from './economy';
import { GachaReveal } from './GachaReveal';
import { freeCopies, isCounted } from './inventory';
import { pixelIconSrc } from './pixelUi';
import { renderThumb } from './render';
import { abrirSobre, comprar, reciclar } from './service';
import { packArt } from './shopArt';
import { createShopSfx } from './shopAudio';
import { SHOP_H, SHOP_W, renderShop } from './shopScene';
import './tienda.css';

const TABS = [
  { id: 'sobres', nombre: 'Sobres' },
  { id: 'muebles', nombre: 'Muebles' },
  { id: 'reciclar', nombre: 'Reciclar' },
];
const TYPE_MS = 16;
const pctText = (p) => `${(p * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;
const nameOf = (id) => catalogItem(id)?.nombre ?? id;
const pct = (v) => `${(v * 100).toFixed(3)}%`;
const box = (r) => ({ left: pct(r.left), top: pct(r.top), width: pct(r.width), height: pct(r.height) });
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function Ticket() {
  return <img className="px-icon ts-ticket" src={pixelIconSrc('ticket')} alt="" width={22} height={22} />;
}

/** Un mueble de la tienda: miniatura, nombre, rareza y lo que tienes. */
function ItemCard({ id, thumb, owned, children, onClick, label, pressed }) {
  const r = rarezaOf(catalogItem(id));
  return (
    <button type="button" className={`ts-item is-${r}`} onClick={onClick} aria-label={label} aria-pressed={pressed}>
      <img src={thumb} alt="" width={44} height={44} />
      <span className="ts-item__name">{nameOf(id)}</span>
      <span className="ts-item__tag">{rarezaInfo(r).nombre}</span>
      {owned > 0 && <span className="ts-item__owned">Tienes {owned}</span>}
      {children}
    </button>
  );
}

/** Lo que dice el dependiente, letra a letra (con movimiento reducido, de golpe). Se anuncia entero una sola vez. */
function Said({ text }) {
  const still = useMemo(() => reducedMotion(), []);
  const [shown, setShown] = useState({ text, n: still ? text.length : 0 });
  useEffect(() => {
    if (still) return undefined;
    let n = 0;
    const id = setInterval(() => {
      n = Math.min(text.length, n + 2);
      setShown({ text, n });
      if (n >= text.length) clearInterval(id);
    }, TYPE_MS);
    return () => clearInterval(id);
  }, [text, still]);
  const visible = still ? text : shown.text === text ? text.slice(0, shown.n) : '';
  return (
    <p className="ts-talk__text">
      <span aria-hidden="true">{visible}</span>
      <span className="px-sr" aria-live="polite">
        {text}
      </span>
    </p>
  );
}

export function Tienda({ inventory, room, soundOn = false, onInventory, onGoPiso }) {
  const [tab, setTab] = useState('sobres');
  const [pick, setPick] = useState(SOBRES[0].id);
  const [ask, setAsk] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [reveal, setReveal] = useState(null);
  const [talk, setTalk] = useState(0);
  const [sfx] = useState(() => createShopSfx({ muted: !soundOn }));
  useEffect(() => sfx.setMuted(!soundOn), [sfx, soundOn]);
  useEffect(() => () => sfx.destroy(), [sfx]);

  const shop = useMemo(() => renderShop(), []);
  const packs = useMemo(() => Object.fromEntries(SOBRES.map((s) => [s.id, packArt(s)])), []);
  // Todo lo que puede salir o venderse (lo de las sagas no se cuenta ni se recicla)
  const thumbs = useMemo(() => Object.fromEntries(CATALOG.filter((c) => !c.set).map((c) => [c.id, renderThumb(c.id, 0, 44).toDataURL()])), []);
  const sobre = sobreOf(pick);
  const odds = useMemo(() => oddsTable(sobre), [sobre]);
  const tickets = inventory.tickets;
  const spare = Object.keys(inventory.copias)
    .filter((id) => isCounted(id) && freeCopies(inventory, room, id) > 0)
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'es'));

  // El dependiente mueve la boca un momento cada vez que dice algo nuevo
  const say = (fn) => {
    fn();
    setTalk((k) => k + 1);
  };

  let line;
  if (msg) line = msg;
  else if (tab === 'sobres') line = tickets < sobre.coste1 ? `${sobre.nombre}: te faltan ${ticketsText(sobre.coste1 - tickets)}. Cada misión de la semana da ${MISION_TICKETS}.` : sobre.dice;
  else if (tab === 'muebles') line = 'Aquí, precio fijo y sin sorpresas. Lo raro solo sale en sobres.';
  else line = spare.length ? '¿Te sobra algo? Lo que no tengas puesto en tu piso te lo cambio por tickets.' : 'Cuando te salga un repetido, tráemelo y te lo cambio por tickets.';

  const run = async (job, ok) => {
    setBusy(true);
    setMsg('');
    try {
      await job();
      ok?.();
    } catch (e) {
      say(() => setMsg(`Uy, no ha podido ser: ${e.message}`));
    } finally {
      setBusy(false);
      setAsk(null);
    }
  };

  const openSobre = (cuantos) =>
    run(async () => {
      sfx.play('rustle');
      const r = await abrirSobre(sobre.id, cuantos);
      if (r.inventario) onInventory(r.inventario);
      setReveal({ premios: r.premios, sobre });
    });

  const confirm = () => {
    if (!ask) return;
    if (ask.kind === 'buy')
      run(
        async () => onInventory(await comprar(ask.id)),
        () => (sfx.play('buy'), say(() => setMsg(`${nameOf(ask.id)}: ya es tuyo. Lo tienes en la balda de tu piso.`))),
      );
    else
      run(
        async () => onInventory(await reciclar(ask.id)),
        () => (sfx.play('recycle'), say(() => setMsg(`Has reciclado ${nameOf(ask.id).toLowerCase()}: +${ticketsText(rarezaInfo(rarezaOf(catalogItem(ask.id))).reciclar)}.`))),
      );
  };

  if (reveal) return <GachaReveal premios={reveal.premios} sobre={reveal.sobre} sfx={sfx} onClose={() => setReveal(null)} onGoPiso={onGoPiso} />;

  let content = null;
  if (tab === 'sobres') {
    content = (
      <>
        <div className="ts-open">
          {[1, 5].map((n) => (
            <button key={n} type="button" className="px-btn px-btn--sage" disabled={busy || tickets < costeDe(sobre, n)} onClick={() => openSobre(n)}>
              Abrir {n} · {costeDe(sobre, n)} <Ticket />
              <span className="px-sr">tickets</span>
            </button>
          ))}
        </div>
        <p className="ts-pity">
          Llevas {inventory.sinRaro} {inventory.sinRaro === 1 ? 'mueble seguido' : 'muebles seguidos'} sin nada raro. Como mucho en {sobresHastaRaro(inventory.sinRaro)} más sale uno seguro (cada {PITY}, en cualquier sobre). El de 5 trae al menos un poco común.
        </p>
        <details className="ts-odds">
          <summary>Probabilidades de «{sobre.nombre}»</summary>
          <p>Cada mueble se sortea así, en el servidor. Si el sobre no trae nada de una rareza, ese mueble sale de todo el catálogo.</p>
          {odds.map((r) => (
            <section key={r.id} className={`ts-odds__row is-${r.id}`}>
              <h4>
                {r.nombre} · {pctText(r.prob)}
                {r.fuera && r.items.length > 0 && <small> (de fuera del sobre)</small>}
              </h4>
              <ul>
                {r.items.map((c) => (
                  <li key={c.id}>
                    {c.nombre} <span>{pctText(r.cada)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </details>
      </>
    );
  } else if (tab === 'muebles') {
    content = (
      <div className="ts-grid">
        {TIENDA.map((c) => (
          <ItemCard key={c.id} id={c.id} thumb={thumbs[c.id]} owned={inventory.copias[c.id] ?? 0} pressed={ask?.id === c.id} label={`${c.nombre}, ${rarezaInfo(rarezaOf(c)).nombre.toLowerCase()}, ${ticketsText(precioDe(c.id))}`} onClick={() => (sfx.play('tap'), setAsk({ kind: 'buy', id: c.id }))}>
            <span className="ts-item__price">
              {precioDe(c.id)} <Ticket />
            </span>
          </ItemCard>
        ))}
      </div>
    );
  } else if (spare.length) {
    content = (
      <div className="ts-grid">
        {spare.map((id) => {
          const vale = rarezaInfo(rarezaOf(catalogItem(id))).reciclar;
          return (
            <ItemCard key={id} id={id} thumb={thumbs[id]} owned={0} pressed={ask?.id === id} label={`${nameOf(id)}: ${freeCopies(inventory, room, id)} sin colocar; reciclar por ${ticketsText(vale)}`} onClick={() => (sfx.play('tap'), setAsk({ kind: 'recycle', id }))}>
              <span className="ts-item__owned">{freeCopies(inventory, room, id)} sin colocar</span>
              <span className="ts-item__price">
                +{vale} <Ticket />
              </span>
            </ItemCard>
          );
        })}
      </div>
    );
  }

  const price = ask ? (ask.kind === 'buy' ? precioDe(ask.id) : rarezaInfo(rarezaOf(catalogItem(ask.id))).reciclar) : 0;
  const bar = tab === 'sobres' ? sobre.nombre : tab === 'muebles' ? 'Muebles sueltos' : 'Reciclar';
  return (
    <section className="ts" aria-labelledby="ts-title">
      <header className="ts-head">
        <h2 className="ed-title" id="ts-title">
          La tienda del bajo
        </h2>
        <p className="ts-wallet" aria-label={`Tienes ${ticketsText(tickets)}`}>
          <Ticket />
          <strong>{tickets}</strong>
        </p>
      </header>
      <div className="ts-scene" style={{ aspectRatio: `${SHOP_W} / ${SHOP_H}` }}>
        <img className="ts-scene__art" src={shop.scene} alt="Por dentro, el antiguo videoclub del bajo: un cartel de «Videoclub» tachado con un papel que dice «Muebles», estanterías de cintas, la pared de sobres y el dependiente detrás del mostrador." />
        <img className="ts-clerk ts-clerk--blink" src={shop.blink} alt="" aria-hidden="true" style={box(shop.face)} />
        {talk > 0 && <img key={talk} className="ts-clerk ts-clerk--talk" src={shop.talk} alt="" aria-hidden="true" style={box(shop.face)} />}
        <div className="ts-wall" role="group" aria-label={`Sobres de la ${TEMPORADA.corto.toLowerCase()}, «${TEMPORADA.nombre}»`}>
          {SOBRES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`ts-wallpack${s.id === 'coleccion' ? ' is-gold' : ''}`}
              style={box(shop.slots[i])}
              aria-pressed={tab === 'sobres' && pick === s.id}
              aria-label={`${s.nombre}: ${ticketsText(s.coste1)} el de 1, ${s.coste5} el de 5`}
              onClick={() => {
                sfx.play('tap');
                setAsk(null);
                say(() => (setPick(s.id), setTab('sobres'), setMsg('')));
              }}
            >
              <img src={packs[s.id].full} alt="" draggable="false" />
            </button>
          ))}
        </div>
      </div>
      <div className="ts-talk">
        <div className="ts-talk__bar">
          <span className="ts-talk__name">{bar}</span>
          {tab === 'sobres' ? (
            <span className="ts-talk__price">
              {sobre.coste1} <Ticket /> · ×5 {sobre.coste5} <Ticket />
            </span>
          ) : (
            <span className="ts-talk__price">{TEMPORADA.corto}</span>
          )}
        </div>
        <Said text={line} />
      </div>
      <div className="ts-tabs" role="tablist" aria-label="Secciones de la tienda">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" className="px-btn" aria-selected={tab === t.id} onClick={() => say(() => (setTab(t.id), setAsk(null), setMsg('')))}>
            {t.nombre}
          </button>
        ))}
      </div>
      <div className="ts-body" role="tabpanel">
        {content}
      </div>
      {ask && (
        <div className="ts-ask" role="group" aria-label="Confirmar">
          <p>{ask.kind === 'buy' ? `¿Comprar ${nameOf(ask.id).toLowerCase()} por ${ticketsText(price)}?` : `¿Reciclar una copia de ${nameOf(ask.id).toLowerCase()} por ${ticketsText(price)}?`}</p>
          {ask.kind === 'buy' && tickets < price && <p className="ts-ask__no">Te faltan {ticketsText(price - tickets)}.</p>}
          <div>
            <button type="button" className="px-btn" onClick={() => setAsk(null)}>
              No
            </button>
            <button type="button" className="px-btn px-btn--sage" disabled={busy || (ask.kind === 'buy' && tickets < price)} onClick={confirm}>
              {ask.kind === 'buy' ? 'Comprar' : 'Reciclar'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
