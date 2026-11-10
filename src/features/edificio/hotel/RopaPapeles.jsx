// 2.ª ampliación del Almacén del Puerto (encargo de Francisco del 10-11-2026), bloque 2: los papeles de la planta de ropa.
// La zona que tocas enseña sus prendas (con de dónde sale cada una) y lo que te gusta va a la cesta; con la cesta se va al
// probador. Lo de misiones, casino y estiba no se vende: dice cómo se gana.
// Bloque 3 (1.105): la ropa propia de la planta lleva su precio y se paga desde la cesta, con tickets y sin rebajas.
import { DEFAULT_AVATAR } from '../actor';
import { ticketsText } from '../economy';
import { renderActorThumb } from '../render';
import { CESTA_MAX, ORIGEN_TEXTO, cambioDe, esTuya, nombrePrenda, origenDe, precioRopa } from './plantaRopa';

const FRAME = { jersey: 'torso', pantalon: 'legs', gafas: 'head', complemento: 'head' };
const muestras = new Map();
/** La prenda puesta en un maniquí (tu personaje, si se sabe; si no, el de serie). */
export function muestraPrenda(p, base = DEFAULT_AVATAR, size = 44) {
  const avatar = { ...DEFAULT_AVATAR, ...base, ...cambioDe(p) };
  const key = JSON.stringify(avatar) + p + size;
  if (!muestras.has(key)) muestras.set(key, renderActorThumb(avatar, { frame: FRAME[p.split(':')[0]] ?? 'all', size }).toDataURL());
  return muestras.get(key);
}

/** Lo que se puede pagar de la cesta: la ropa de la planta que aún no es tuya. */
export const porPagar = (cesta, prendas) => (prendas ? cesta.filter((p) => precioRopa(p) != null && !esTuya(p, prendas)) : []);

function Prenda({ p, prendas, base, enCesta, llena, onCesta }) {
  const tuya = esTuya(p, prendas);
  const origen = origenDe(p);
  const precio = precioRopa(p);
  return (
    <li className="alm-prenda" data-prenda={p} data-origen={origen} data-tuya={tuya || undefined}>
      <img src={muestraPrenda(p, base)} width="44" height="44" alt="" />
      <span className="alm-prenda__txt">
        <b>{nombrePrenda(p)}</b>
        <small>{tuya ? (origen === 'serie' ? 'De serie: ya es tuya' : 'Ya es tuya') : ORIGEN_TEXTO[origen]}</small>
      </span>
      {precio != null && !tuya && (
        <span className="alm-prenda__precio">
          <b>{precio}</b>
          <small>tickets</small>
        </span>
      )}
      <button type="button" className="alm-btn alm-prenda__cesta" aria-pressed={enCesta} disabled={!enCesta && llena} onClick={() => onCesta(p)}>
        {enCesta ? 'Quitar' : 'A la cesta'}
      </button>
    </li>
  );
}

/** El papel de una zona: sus prendas, y a la cesta o al probador. Lo de la planta (con precio), primero. */
export function ZonaRopa({ zona, cesta, prendas, base, onCesta, onProbador }) {
  const llena = cesta.length >= CESTA_MAX;
  const lista = [...zona.prendas].sort((a, b) => (precioRopa(b) != null) - (precioRopa(a) != null));
  const nuevas = zona.prendas.filter((p) => precioRopa(p) != null).length;
  return (
    <div className="alm-zona">
      <p className="alm-nota alm-zona__donde">
        {zona.donde} · {zona.prendas.length} prendas{nuevas ? ` · ${nuevas} de la planta, a la venta` : ''}
      </p>
      <ul className="alm-zona__lista">
        {lista.map((p) => (
          <Prenda key={p} p={p} prendas={prendas} base={base} enCesta={cesta.includes(p)} llena={llena} onCesta={onCesta} />
        ))}
      </ul>
      <div className="alm-acciones">
        <button type="button" className="alm-btn alm-btn--primario" onClick={onProbador}>
          {cesta.length ? `Al probador con la cesta (${cesta.length})` : 'Al probador'}
        </button>
      </div>
      {llena && <p className="alm-nota">La cesta está llena: caben {CESTA_MAX} prendas.</p>}
    </div>
  );
}

/**
 * El papel de la cesta: lo que llevas para probarte y, si hay ropa de la planta que aún no es tuya, pagarla.
 * `cobro`: { fase: 'lista' | 'pagando', error, hecho: { ropa, total } | null }; `tickets`: tu saldo (null si no se sabe).
 */
export function CestaRopa({ cesta, prendas, base, tickets = null, cobro = { fase: 'lista' }, onCesta, onVaciar, onProbador, onPagar }) {
  const pagar = porPagar(cesta, prendas);
  const total = pagar.reduce((t, p) => t + precioRopa(p), 0);
  if (!cesta.length)
    return (
      <>
        {cobro.hecho && <Pagado hecho={cobro.hecho} />}
        <p className="alm-nota">La cesta está vacía. Toca el letrero de una zona y elige lo que te quieras probar.</p>
      </>
    );
  const falta = tickets != null && tickets < total;
  return (
    <div className="alm-zona">
      {cobro.hecho && <Pagado hecho={cobro.hecho} />}
      <ul className="alm-zona__lista">
        {cesta.map((p) => (
          <Prenda key={p} p={p} prendas={prendas} base={base} enCesta llena={false} onCesta={onCesta} />
        ))}
      </ul>
      <p className="alm-nota">
        {cesta.length} de {CESTA_MAX}. En el probador te lo pones todo; lo que todavía no es tuyo, solo para verte.
      </p>
      {pagar.length > 0 && (
        <div className="alm-cesta__pago">
          <p>
            <span>
              {pagar.length === 1 ? '1 prenda de la planta' : `${pagar.length} prendas de la planta`}
              <small>Sin rebajas{tickets != null ? ` · tienes ${ticketsText(tickets)}` : ''}</small>
            </span>
            <b>{ticketsText(total)}</b>
          </p>
          {cobro.error && (
            <p className="alm-aviso" role="alert">
              {cobro.error}
            </p>
          )}
          <button type="button" className="alm-btn alm-btn--primario" disabled={cobro.fase === 'pagando' || falta} onClick={() => onPagar(pagar, total)}>
            {cobro.fase === 'pagando' ? 'Pagando…' : falta ? 'No te llegan los tickets' : `Pagar ${ticketsText(total)}`}
          </button>
        </div>
      )}
      <div className="alm-acciones">
        <button type="button" className="alm-btn alm-btn--primario" onClick={onProbador}>
          Al probador
        </button>
        <button type="button" className="alm-btn alm-btn--papel" onClick={onVaciar}>
          Vaciar la cesta
        </button>
      </div>
    </div>
  );
}

function Pagado({ hecho }) {
  return (
    <p className="alm-cesta__pagado" role="status">
      Pagado: {hecho.ropa.map(nombrePrenda).join(', ')} ({ticketsText(hecho.total)}). Ya es tuyo: póntelo en el probador.
    </p>
  );
}
