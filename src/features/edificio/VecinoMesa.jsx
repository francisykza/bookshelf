// Lo que se puede hacer en el piso de un vecino (1.71, SPEC §71; encargo de Francisco del 1-11-2026), en la franja de
// abajo, para no quitarle sitio a la habitación: dos pestañas de papel, «Libro de visitas» (firmar con una frase
// cerrada) y «Regalar» (una copia de sobra de un mueble tuyo). Sin texto libre en ningún caso. El «me gusta» de cada
// mueble va en la habitación (piso.js). Desde la 1.78 (encargo del 3-11-2026) no hay sellos, que eran casi lo mismo
// que el libro, y se regala uno al día, solo hasta «raro» y solo si te queda otro (lo comprueba también el servidor).
import { useEffect, useMemo, useState } from 'react';
import { CATALOG, FIRMAS } from './catalog';
import { acabadoOf } from './acabados';
import { acabadosDe, freeCopies, ownedCopies } from './inventory';
import { renderThumb } from './render';
import { PostItForm } from '../tablon/TablonVisita';
import { loadVisit } from '../tablon/service';

const firmaText = (id) => FIRMAS.find((f) => f.id === id)?.texto ?? '';
const REGALABLES = new Set(['comun', 'poco-comun', 'raro']);
const DAY_MS = 24 * 60 * 60 * 1000;
const TODAY_GIFT = 'Ya has hecho tu regalo de hoy; mañana, otro.';
// Cuándo regalaste por última vez desde este aparato (la cuenta de verdad la lleva el servidor)
const giftKey = (uid) => `bookshelf:edificio:ultimo-regalo:${uid}`;
const lastGift = (uid) => {
  try {
    return Number(localStorage.getItem(giftKey(uid))) || 0;
  } catch {
    return 0;
  }
};
const markGift = (uid) => {
  try {
    localStorage.setItem(giftKey(uid), String(Date.now()));
  } catch {
    // Sin almacenamiento, el servidor sigue diciendo que no
  }
};

/** Lo que puedes regalar: hasta «raro», sin sagas, y solo si tienes más de una copia y alguna sin colocar. */
function giftable(inventory, room) {
  return CATALOG.filter((c) => !c.set && REGALABLES.has(c.rareza ?? 'comun'))
    .flatMap((c) => [null, ...Object.keys(acabadosDe(inventory, c.id))].map((acabado) => ({ c, acabado, owned: ownedCopies(inventory, c.id), n: freeCopies(inventory, room, c.id, acabado) })))
    .filter((x) => x.owned !== Infinity && x.owned > 1 && x.n > 0)
    .map(({ c, n, acabado }) => ({ c, n, acabado, key: `${c.id}@${acabado ?? ''}`, nombre: acabado ? `${c.nombre} ${acabadoOf(acabado).nombre}` : c.nombre }));
}

/**
 * `vecino`: el del piso; `social`: su libro y sus «me gusta» (null sin la migración: entonces solo se mira);
 * `inventory` y `myRoom`: lo tuyo (para saber qué te sobra; sin inventario no hay pestaña de regalar). `myId`: tu usuario.
 */
export function VecinoMesa({ vecino, social, inventory, myRoom, myId, today, onFirmar, onRegalar }) {
  const [tab, setTab] = useState('libro');
  const [gift, setGift] = useState(null);
  const [msg, setMsg] = useState('');
  const [givenAt, setGivenAt] = useState(() => lastGift(myId));
  const [now] = useState(() => Date.now());
  const canGift = Boolean(social && inventory && myRoom);
  // Sin la migración del tablón sigue el libro de visitas de antes
  const [visita, setVisita] = useState(null);
  useEffect(() => {
    let off = false;
    loadVisit(vecino.user_id).then((v) => !off && setVisita(v), () => {});
    return () => {
      off = true;
    };
  }, [vecino.user_id]);
  const tabs = [{ id: 'libro', nombre: visita ? 'Dejar un post-it' : 'Libro de visitas' }, ...(canGift ? [{ id: 'regalar', nombre: 'Regalar' }] : [])];
  const free = useMemo(() => (canGift ? giftable(inventory, myRoom) : []), [canGift, inventory, myRoom]);
  const thumbs = useMemo(() => Object.fromEntries(free.map(({ c, acabado, key }) => [key, renderThumb(c.id, 0, 44, acabado).toDataURL()])), [free]);
  const giftedToday = Math.max(now, givenAt) - givenAt < DAY_MS;
  const mineToday = social?.visitas.find((v) => v.de === myId && v.dia === today)?.frase ?? null;
  const others = social?.visitas.filter((v) => v.de !== myId).slice(0, 2) ?? [];

  const go = (id) => {
    setTab(id);
    setGift(null);
    setMsg('');
  };
  const sign = async (frase) => {
    try {
      await onFirmar(frase);
      setMsg(`Has firmado su libro: «${firmaText(frase)}».`);
    } catch (e) {
      setMsg(`No se ha podido firmar: ${e.message}`);
    }
  };
  const remember = () => {
    markGift(myId);
    setGivenAt(Date.now());
  };
  const give = async () => {
    const c = gift;
    try {
      await onRegalar(c.c.id, c.acabado);
      remember();
      setGift(null);
      setMsg(`Le has regalado: ${c.nombre.toLowerCase()}. Le aparecerá en su balda. Mañana podrás regalar otro.`);
    } catch (e) {
      // El servidor dice que ya regalaste hoy (quizá desde otro aparato): se recuerda aquí también
      if (/regalo de hoy/.test(e.message)) remember();
      setGift(null);
      setMsg(`No se ha podido regalar: ${e.message}`);
    }
  };

  // Sin la migración de vecinos no hay nada que hacer en su piso: solo se mira
  if (!social) return null;

  let content;
  if (tab === 'regalar') {
    content = giftedToday ? (
      <p className="ed-sellos__msg" role="status" aria-live="polite">
        {msg || TODAY_GIFT}
      </p>
    ) : (
      <>
        {free.length ? (
          <div className="ed-sellos__row ed-gifts" role="group" aria-label="Elige qué regalarle">
            {free.map((x) => (
              <button key={x.key} type="button" className={`ed-gift${x.acabado ? ' is-acabado' : ''}`} aria-pressed={gift?.key === x.key} aria-label={`${x.nombre} (tienes ${x.n} libre${x.n === 1 ? '' : 's'})`} onClick={() => (setGift(x), setMsg(''))}>
                <img src={thumbs[x.key]} alt="" width="44" height="44" />
                <span>{x.nombre}</span>
                <b aria-hidden="true">×{x.n}</b>
              </button>
            ))}
          </div>
        ) : (
          <p className="ed-sellos__empty">Solo se regalan muebles de los que tengas más de uno, hasta «raro», con alguno guardado en tu balda.</p>
        )}
        <div className="ed-sellos__msg" role="status" aria-live="polite">
          {gift ? (
            <button type="button" className="px-btn px-btn--sage ed-gift__go" onClick={give}>
              <span className="px-btn__text">
                Regalar {gift.nombre.toLowerCase()} a {vecino.alias}
              </span>
            </button>
          ) : (
            msg || 'Un regalo al día: una copia de sobra pasa de tu balda a la suya.'
          )}
        </div>
      </>
    );
  } else if (visita) {
    content = <PostItForm destino={vecino.user_id} alias={vecino.alias} visit={visita} />;
  } else {
    content = (
      <>
        <div className="ed-sellos__row" role="group" aria-label="Firmar su libro de visitas">
          {FIRMAS.map((f) => (
            <button key={f.id} type="button" className="ed-sello" aria-pressed={mineToday === f.id} onClick={() => sign(f.id)}>
              {f.texto}
            </button>
          ))}
        </div>
        <p className="ed-sellos__msg" role="status" aria-live="polite">
          {msg || (others.length ? `En su libro: ${others.map((v) => `${v.alias ?? 'Un vecino'}, «${firmaText(v.frase)}»`).join(' · ')}` : 'Aún no ha firmado nadie más. Sé la primera visita.')}
        </p>
      </>
    );
  }

  return (
    <section className="ed-sellos ed-desk" aria-label={`Para ${vecino.alias}`}>
      {tabs.length > 1 ? (
        <div className="ed-desk__tabs" role="tablist" aria-label="Qué hacer">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" className="ed-desk__tab" aria-selected={tab === t.id} onClick={() => go(t.id)}>
              {t.nombre}
            </button>
          ))}
        </div>
      ) : (
        <h3 id="ed-sellos-title">Firmar su libro de visitas</h3>
      )}
      {content}
    </section>
  );
}
