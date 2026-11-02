// «La tienda del bajo» (1.67, SPEC §67; fases 2 y 4 de docs/qa/economia-muebles.md): se entra por el escaparate de la
// planta baja. Desde la 1.68 (maquetas de Francisco) es un local isométrico dibujado con el mismo motor que los pisos
// (shopRoom.js): el antiguo videoclub con estanterías, el ventanal al puerto y la dependienta en su mostrador. Las tres
// secciones son objetos de la tienda: el expositor (Sobres), el rincón del sillón (Muebles) y la caja de reciclaje
// (Reciclar); se tocan, o su letrero, y se les enciende el contorno. Debajo, lo de la sección: los sobres de la
// temporada, la ficha del elegido, abrir de 1 o de 5, lo que falta si no llega (con un atajo a las misiones) y las
// probabilidades y garantías. Los tickets solo se ganan leyendo; muebles sueltos a precio fijo (lo raro solo sale en
// sobres) y reciclar lo que no está colocado. Todo lo decide el servidor; esto enseña y pide confirmación antes de gastar.
import { useEffect, useMemo, useState } from 'react';
import { CATALOG, catalogItem, isMistico } from './catalog';
import { MISION_TICKETS, PITY, SOBRES, TEMPORADA, TIENDA, costeDe, oddsTable, precioDe, rarezaInfo, rarezaOf, sobreOf, sobresHastaRaro, ticketsText } from './economy';
import { GachaReveal } from './GachaReveal';
import { freeCopies, isCounted } from './inventory';
import { pixelIconSrc } from './pixelUi';
import { renderThumb } from './render';
import { abrirSobre, comprar, reciclar } from './service';
import { packArt } from './shopArt';
import { createShopSfx } from './shopAudio';
import { SHOP_ROOM_H, SHOP_ROOM_W, renderShopRoom } from './shopRoom';
import './tienda.css';

const TABS = [
  { id: 'sobres', nombre: 'Sobres' },
  { id: 'muebles', nombre: 'Muebles' },
  { id: 'reciclar', nombre: 'Reciclar' },
];
const pctText = (p) => `${(p * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;
const nameOf = (id) => catalogItem(id)?.nombre ?? id;
const pct = (v) => `${(v * 100).toFixed(3)}%`;

function Ticket({ size = 22 }) {
  return <img className="px-icon ts-ticket" src={pixelIconSrc('ticket')} alt="" width={size} height={size} />;
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

/**
 * `onReveal(abierto)`: avisa al panel cuando se abre o se cierra un sobre (para que su «Volver» vuelva a la tienda).
 * `closeReveal`: un número que, al cambiar, cierra el sobre abierto (lo sube el panel con su «Volver a la tienda»).
 */
export function Tienda({ inventory, room, soundOn = false, onInventory, onGoPiso, onOpenMissions = null, onReveal = null, closeReveal = 0 }) {
  const [tab, setTab] = useState('sobres');
  const [pick, setPick] = useState(SOBRES[0].id);
  const [ask, setAsk] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [reveal, setReveal] = useState(null);
  const [closed, setClosed] = useState(closeReveal);
  const [sfx] = useState(() => createShopSfx({ muted: !soundOn }));
  useEffect(() => sfx.setMuted(!soundOn), [sfx, soundOn]);
  useEffect(() => () => sfx.destroy(), [sfx]);
  useEffect(() => onReveal?.(Boolean(reveal)), [onReveal, reveal]);
  // El «Volver a la tienda» de la barra del panel cierra el sobre
  if (closeReveal !== closed) {
    setClosed(closeReveal);
    setReveal(null);
  }

  const shop = useMemo(() => renderShopRoom(), []);
  const packs = useMemo(() => Object.fromEntries(SOBRES.map((s) => [s.id, packArt(s)])), []);
  // Todo lo que puede salir o venderse (lo de las sagas no se cuenta ni se recicla)
  const thumbs = useMemo(() => Object.fromEntries(CATALOG.filter((c) => !c.set).map((c) => [c.id, renderThumb(c.id, 0, 44).toDataURL()])), []);
  const sobre = sobreOf(pick);
  const odds = useMemo(() => oddsTable(sobre), [sobre]);
  const tickets = inventory.tickets;
  const spare = Object.keys(inventory.copias)
    .filter((id) => isCounted(id) && !isMistico(catalogItem(id)) && freeCopies(inventory, room, id) > 0)
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'es'));

  const run = async (job, ok) => {
    setBusy(true);
    setMsg('');
    try {
      await job();
      ok?.();
    } catch (e) {
      setMsg(`Uy, no ha podido ser: ${e.message}`);
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
        () => (sfx.play('buy'), setMsg(`${nameOf(ask.id)}: ya es tuyo. Lo tienes en la balda de tu piso.`)),
      );
    else
      run(
        async () => onInventory(await reciclar(ask.id)),
        () => (sfx.play('recycle'), setMsg(`Has reciclado ${nameOf(ask.id).toLowerCase()}: +${ticketsText(rarezaInfo(rarezaOf(catalogItem(ask.id))).reciclar)}.`)),
      );
  };

  const goTab = (id) => {
    if (id !== tab) sfx.play('tap');
    setTab(id);
    setAsk(null);
    setMsg('');
  };
  // Tocar la tienda: si hay una sección bajo el dedo, se abre esa
  const onScene = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = shop.hit((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
    if (id) goTab(id);
  };

  if (reveal) return <GachaReveal premios={reveal.premios} sobre={reveal.sobre} sfx={sfx} onClose={() => setReveal(null)} onGoPiso={onGoPiso} />;

  const falta = sobre.coste1 - tickets;
  // Lo que dice la nota de debajo: el aviso de lo último que pasó o, si no, lo que falta o una pista
  const note =
    msg ||
    (tab === 'sobres'
      ? falta > 0
        ? `Te faltan ${ticketsText(falta)}.`
        : ''
      : tab === 'muebles'
        ? 'Aquí, precio fijo y sin sorpresas. Lo raro solo sale en sobres.'
        : spare.length
          ? 'Lo que no tengas puesto en tu piso te lo cambio por tickets.'
          : 'Cuando te salga un repetido, tráemelo y te lo cambio por tickets.');
  const showMissions = !msg && tab === 'sobres' && falta > 0 && onOpenMissions;

  let content = null;
  if (tab === 'sobres') {
    content = (
      <>
        <div className="ts-packs" role="group" aria-label={`Sobres de la ${TEMPORADA.corto.toLowerCase()}, «${TEMPORADA.nombre}»`}>
          {SOBRES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`ts-pack${s.id === 'coleccion' ? ' is-gold' : ''}`}
              aria-pressed={pick === s.id}
              aria-label={`${s.nombre}: ${ticketsText(s.coste1)} el de 1, ${s.coste5} el de 5`}
              onClick={() => {
                sfx.play('tap');
                setAsk(null);
                setPick(s.id);
                setMsg('');
              }}
            >
              <img src={packs[s.id].full} alt="" draggable="false" />
              <span aria-hidden="true">
                {s.coste1} <Ticket size={14} />
              </span>
            </button>
          ))}
        </div>
        <section className={`ts-card${sobre.id === 'coleccion' ? ' is-gold' : ''}`} aria-labelledby="ts-card-title">
          <img className="ts-card__pack" src={packs[sobre.id].full} alt="" />
          <div className="ts-card__text">
            <h3 id="ts-card-title">{sobre.nombre}</h3>
            <p>{sobre.dice}</p>
            <p className="ts-card__price">
              <Ticket size={18} />
              <span>1 sobre · {ticketsText(sobre.coste1)}</span>
            </p>
          </div>
        </section>
        <div className="ts-open">
          {[1, 5].map((n) => (
            <button key={n} type="button" className="px-btn px-btn--sage" disabled={busy || tickets < costeDe(sobre, n)} onClick={() => openSobre(n)}>
              Abrir {n} · {costeDe(sobre, n)} <Ticket />
              <span className="px-sr">tickets</span>
            </button>
          ))}
        </div>
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
      {/* Las secciones están en la propia tienda: se toca el objeto (o su letrero) y se le enciende el contorno */}
      <div className="ts-scene" style={{ aspectRatio: `${SHOP_ROOM_W} / ${SHOP_ROOM_H}` }} onClick={onScene}>
        <img className="ts-scene__art" src={shop.scene} alt="La tienda del bajo al atardecer: un antiguo videoclub con estanterías de libros, un ventanal al puerto, el rincón de un sillón con su lámpara, una caja de reciclaje, el expositor de sobres y la dependienta en su mostrador." draggable="false" />
        <img className="ts-scene__outline" src={shop.outlines[tab]} alt="" aria-hidden="true" draggable="false" />
        <div className="ts-spots" role="tablist" aria-label="Secciones de la tienda">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" id={`ts-tab-${t.id}`} aria-controls="ts-panel" className={`ts-spot is-${t.id}`} aria-selected={tab === t.id} style={{ left: pct(shop.tags[t.id].left), top: pct(shop.tags[t.id].top) }} onClick={(e) => (e.stopPropagation(), goTab(t.id))}>
              {t.nombre}
            </button>
          ))}
        </div>
      </div>
      <div className="ts-body" role="tabpanel" id="ts-panel" aria-labelledby={`ts-tab-${tab}`}>
        {content}
        <div className="ts-note" role="status" aria-live="polite">
          {note && <p>{note}</p>}
          {showMissions && (
            <button type="button" className="ts-link" onClick={onOpenMissions}>
              Ver misiones <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
        {tab === 'sobres' && (
          <details className="ts-odds">
            <summary>
              <span>Probabilidades y garantías</span>
              <small>Raro garantizado en un máximo de {sobresHastaRaro(inventory.sinRaro)} muebles.</small>
            </summary>
            <p>
              Cada mueble de «{sobre.nombre}» se sortea así, en el servidor. Si el sobre no trae nada de una rareza, ese mueble sale de todo el catálogo. Llevas {inventory.sinRaro} {inventory.sinRaro === 1 ? 'mueble seguido' : 'muebles seguidos'} sin nada raro: cada {PITY}, uno raro seguro (en cualquier sobre). El de 5 trae al menos un poco común. Cada misión de la semana da {MISION_TICKETS} tickets.
            </p>
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
        )}
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
