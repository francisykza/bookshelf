// La lata de los garbanzos (1.82; Francisco, 4-11-2026: «una opción discreta y orgánica que no se cargue la distribución
// que hay ya de la caja»): plegada al pie de la caja, con tres premios humildes y el cambio de garbanzos y tickets, que
// tiene un tope a la semana en cada sentido. Las cantidades son fijas y se pide confirmación antes de cambiar. Lo cobra
// y lo da el servidor (20261112120000_hotel_casino_garbanzos.sql).
import { useState } from 'react';
import { canjearLata, cambiarGarbanzos } from '../service';
import { CASINO, garbanzosDe, LATA } from './veintiuna';

const ticketsDe = (n) => `${n} ${n === 1 ? 'ticket' : 'tickets'}`;

export function LataGarbanzos({ data, dia, onData, sfx, arte }) {
  const [pide, setPide] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const tienes = new Map(data.lata.map((x) => [x.id, x.tienes]));

  const hacer = async (fn, listo) => {
    setBusy(true);
    setMsg('');
    try {
      onData(await fn());
      setPide(null);
      setMsg(listo);
      sfx.play('chips');
    } catch (e) {
      setMsg(`No se ha podido: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  /** El botón de cada cosa, con la confirmación en el sitio. */
  const boton = (id, texto, puede, pregunta, accion) =>
    pide === id ? (
      <div className="gh-lata__do" role="group" aria-label={pregunta}>
        <button type="button" className="gh-21btn is-deal is-small" disabled={busy} onClick={accion}>
          Sí, cambiar
        </button>
        <button type="button" className="gh-21link" disabled={busy} onClick={() => setPide(null)}>
          No
        </button>
      </div>
    ) : (
      <div className="gh-lata__do">
        <button
          type="button"
          className="gh-21btn is-small gh-caja__buy"
          disabled={!puede}
          aria-label={pregunta}
          onClick={() => {
            sfx.play('tap');
            setPide(id);
            setMsg('');
          }}
        >
          {texto}
        </button>
      </div>
    );

  const { cambioGarbanzos, cambioTickets, vueltaGarbanzos, topeCambio } = CASINO;
  const queda = (hecho) => hecho + cambioTickets <= topeCambio;
  return (
    <details className="gh-lata">
      <summary>
        La lata de los garbanzos
        <span>{garbanzosDe(data.garbanzos)}</span>
      </summary>
      <ul aria-label="Premios de la lata">
        {LATA.map((a) => (
          <li key={a.id}>
            <img src={arte(a.id)} alt="" width="48" height="48" />
            <p>
              <b>{a.nombre}</b>
              {a.texto} {garbanzosDe(a.precio)}.
            </p>
            {tienes.get(a.id) ? (
              <p>Ya es tuyo</p>
            ) : (
              boton(a.id, 'Cambiar', data.garbanzos >= a.precio, `¿Cambias ${garbanzosDe(a.precio)} por ${a.nombre}?`, () =>
                hacer(() => canjearLata(dia, a.id), `${a.nombre}: ya está en tu inventario, colócalo en tu piso.`),
              )
            )}
          </li>
        ))}
      </ul>
      <p className="gh-lata__title">Cambio</p>
      <ul aria-label="Cambio de garbanzos y tickets">
        <li className="is-text">
          <p>
            <b>
              {cambioGarbanzos} garbanzos por {ticketsDe(cambioTickets)}
            </b>
            Esta semana, {data.cambio.aTickets} de {topeCambio} tickets.
          </p>
          {boton('a-tickets', 'Cambiar', queda(data.cambio.aTickets) && data.garbanzos >= cambioGarbanzos, `¿Cambias ${cambioGarbanzos} garbanzos por ${ticketsDe(cambioTickets)}?`, () =>
            hacer(() => cambiarGarbanzos(dia, 'a-tickets'), `Hecho: ${ticketsDe(cambioTickets)} más.`),
          )}
        </li>
        <li className="is-text">
          <p>
            <b>
              {ticketsDe(cambioTickets)} por {vueltaGarbanzos} garbanzos
            </b>
            Esta semana, {data.cambio.aGarbanzos} de {topeCambio} tickets.
          </p>
          {boton('a-garbanzos', 'Cambiar', queda(data.cambio.aGarbanzos) && data.tickets >= cambioTickets, `¿Cambias ${ticketsDe(cambioTickets)} por ${vueltaGarbanzos} garbanzos?`, () =>
            hacer(() => cambiarGarbanzos(dia, 'a-garbanzos'), `Hecho: ${garbanzosDe(vueltaGarbanzos)} más.`),
          )}
        </li>
      </ul>
      <p className="gh-lata__msg" role="status" aria-live="polite">
        {msg}
      </p>
    </details>
  );
}
