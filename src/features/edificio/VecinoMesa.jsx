// Lo que se puede hacer en el piso de un vecino (1.71, SPEC §71; encargo de Francisco del 1-11-2026), en la misma
// franja de abajo que antes solo tenía los sellos, para no quitarle sitio a la habitación: tres pestañas de papel,
// «Buzón» (los sellos de siempre), «Libro de visitas» (firmar con una frase cerrada) y «Regalar» (una copia libre de
// un mueble tuyo). Sin texto libre en ningún caso. El «me gusta» de cada mueble va en la habitación (piso.js).
import { useMemo, useState } from 'react';
import { CATALOG, FIRMAS, SELLOS } from './catalog';
import { freeCopies } from './inventory';
import { renderThumb } from './render';

const firmaText = (id) => FIRMAS.find((f) => f.id === id)?.texto ?? '';

/**
 * `vecino`: el del piso; `social`: su libro y sus «me gusta» (null sin la migración); `inventory` y `myRoom`: lo tuyo
 * (para saber qué copias tienes libres; sin inventario no hay pestaña de regalar). `myId`: tu usuario.
 */
export function VecinoMesa({ vecino, social, inventory, myRoom, myId, today, selloMsg, onSello, onFirmar, onRegalar }) {
  const [tab, setTab] = useState('buzon');
  const [gift, setGift] = useState(null);
  const [msg, setMsg] = useState('');
  const canGift = Boolean(social && inventory && myRoom);
  const tabs = [{ id: 'buzon', nombre: 'Buzón' }, ...(social ? [{ id: 'libro', nombre: 'Libro de visitas' }] : []), ...(canGift ? [{ id: 'regalar', nombre: 'Regalar' }] : [])];
  // Lo que puedes regalar: copias libres (no puestas en tu piso) de muebles que no son de sagas
  const free = useMemo(() => (canGift ? CATALOG.filter((c) => !c.set).map((c) => ({ c, n: freeCopies(inventory, myRoom, c.id) })).filter((x) => x.n > 0 && x.n !== Infinity) : []), [canGift, inventory, myRoom]);
  const thumbs = useMemo(() => Object.fromEntries(free.map(({ c }) => [c.id, renderThumb(c.id).toDataURL()])), [free]);
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
  const give = async () => {
    const c = gift;
    try {
      await onRegalar(c.id);
      setGift(null);
      setMsg(`Le has regalado: ${c.nombre.toLowerCase()}. Le aparecerá en su balda.`);
    } catch (e) {
      setMsg(`No se ha podido regalar: ${e.message}`);
    }
  };

  let content;
  if (tab === 'libro') {
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
  } else if (tab === 'regalar') {
    content = (
      <>
        {free.length ? (
          <div className="ed-sellos__row ed-gifts" role="group" aria-label="Elige qué regalarle">
            {free.map(({ c, n }) => (
              <button key={c.id} type="button" className="ed-gift" aria-pressed={gift?.id === c.id} aria-label={`${c.nombre} (tienes ${n} libre${n === 1 ? '' : 's'})`} onClick={() => (setGift(c), setMsg(''))}>
                <img src={thumbs[c.id]} alt="" width="44" height="44" />
                <span>{c.nombre}</span>
                <b aria-hidden="true">×{n}</b>
              </button>
            ))}
          </div>
        ) : (
          <p className="ed-sellos__empty">No tienes muebles libres. Guarda alguno de tu piso para poder regalarlo.</p>
        )}
        <div className="ed-sellos__msg" role="status" aria-live="polite">
          {gift ? (
            <button type="button" className="px-btn px-btn--sage ed-gift__go" onClick={give}>
              <span className="px-btn__text">
                Regalar {gift.nombre.toLowerCase()} a {vecino.alias}
              </span>
            </button>
          ) : (
            msg || 'Una copia libre pasa de tu balda a la suya.'
          )}
        </div>
      </>
    );
  } else {
    content = (
      <>
        <div className="ed-sellos__row" role="group" aria-label="Dejar un sello en su buzón">
          {SELLOS.map((s) => (
            <button key={s.id} type="button" className="ed-sello" aria-pressed={vecino.sello_dado === s.id} onClick={() => onSello(s.id)}>
              {s.texto}
            </button>
          ))}
        </div>
        <p className="ed-sellos__msg" role="status" aria-live="polite">
          {selloMsg || (vecino.sello_dado ? `Ya le dejaste «${SELLOS.find((s) => s.id === vecino.sello_dado)?.texto}». Tócalo otra vez para quitarlo.` : '')}
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
        <h3 id="ed-sellos-title">Dejar un sello en su buzón</h3>
      )}
      {content}
    </section>
  );
}
