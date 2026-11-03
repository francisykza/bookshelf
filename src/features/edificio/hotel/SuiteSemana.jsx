// La suite de la semana, en el ático del Gran Hotel (1.79; paso B de docs/qa/gran-hotel.md §9.3, rehecho con
// Francisco el 3-11-2026: el hotel es lo social y el edificio lo personal, así que ningún piso sale de su edificio y no
// se vota). Es una habitación común que empieza vacía cada lunes: cada huésped lleva un mueble suyo (no lo pierde), lo
// puede poner en otro sitio, cambiarlo por otro o retirarlo, y se ve quién ha traído cada cosa. Con cuatro semanas
// aportando llega la «Placa de la suite». Lo decide el servidor (supabase/migrations/20261109130000_hotel_suite_semana.sql).
// Se entra tocando el ático en la fachada, desde el Directorio o con la «Á» del ascensor.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCommunity } from '../../social/hooks/useCommunity';
import { catalogItem } from '../catalog';
import { mountPiso } from '../piso';
import { renderThumb } from '../render';
import { loadInventario, loadSuite, llevarASuite, retirarDeSuite } from '../service';
import { llevables, sitioEnSuite } from './suite';

const NOTE = {
  loading: 'Un momento, que subimos al ático…',
  'signed-out': 'Inicia sesión y activa la comunidad para subir a la suite.',
  'no-community': 'Activa la comunidad en tu perfil para subir a la suite.',
  soon: 'La suite aún está cerrada: abre muy pronto.',
};

/** La suite para mirar (se monta otra vez cuando cambia lo que hay). */
function SuiteMirar({ room, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const piso = mountPiso(ref.current, { room, editable: false, inside: true, label });
    if (import.meta.env.DEV) window.__suitePiso = piso;
    return () => piso.destroy();
    // La clave de quien lo usa cambia con lo que hay: aquí se monta una vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} className="ed-piso gh-suite__piso" />;
}

const nombreDe = (id) => catalogItem(id)?.nombre ?? id;
const sinMio = (room, aportes) => ({ ...room, items: room.items.filter((i) => !aportes.some((a) => a.yo && a.uid === i.uid)) });

export function SuiteSemana({ onStreet }) {
  const community = useCommunity({ autoload: true });
  const member = community.status === 'ready' && community.member;
  const [data, setData] = useState(undefined);
  const [inv, setInv] = useState(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [intento, setIntento] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const root = useRef(null);

  useEffect(() => {
    if (!member) return undefined;
    let alive = true;
    loadSuite().then(
      (d) => alive && setData(d),
      () => alive && setData(null),
    );
    loadInventario().then(
      (i) => alive && setInv(i),
      () => alive && setInv(false),
    );
    return () => {
      alive = false;
    };
  }, [member]);
  useEffect(() => {
    root.current?.scrollIntoView({ block: 'start' });
  }, []);
  // Escape: con la lista de muebles abierta, la cierra; si no, a la plaza (no cierra el hotel)
  const elegirRef = useRef(false);
  useEffect(() => {
    elegirRef.current = eligiendo;
  }, [eligiendo]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (elegirRef.current) setEligiendo(false);
      else onStreet();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onStreet]);

  let status = 'loading';
  if (['signed-out', 'off'].includes(community.status)) status = 'signed-out';
  else if (['unavailable', 'error'].includes(community.status)) status = 'soon';
  else if (community.status === 'ready' && !community.member) status = 'no-community';
  else if (member && data === null) status = 'soon';
  else if (member && data) status = 'ready';

  const opciones = useMemo(() => llevables(inv), [inv]);
  const thumbs = useMemo(() => Object.fromEntries(opciones.map((c) => [c.id, renderThumb(c.id, 0, 44).toDataURL()])), [opciones]);

  const run = async (fn, done) => {
    setBusy(true);
    setMsg('');
    try {
      const next = await fn();
      setData(next);
      setMsg(done(next));
      return true;
    } catch (e) {
      setMsg(`No se ha podido: ${e.message}`);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const llevar = async (id, siguiente = 0) => {
    const item = sitioEnSuite(sinMio(data.room, data.aportes), id, { antes: data.mio, intento: siguiente });
    if (!item) return setMsg(`${nombreDe(id)}: no cabe en la suite esta semana.`);
    setIntento(siguiente);
    const ok = await run(
      () => llevarASuite(item),
      (next) =>
        next.placa && !data.placa
          ? '¡Cuatro semanas decorando la suite! Tienes la Placa de la suite para tu piso.'
          : data.mio?.id === id
            ? 'Lo has puesto en otro sitio.'
            : `Has llevado ${nombreDe(id).toLowerCase()} a la suite.`,
    );
    if (ok) setEligiendo(false);
  };
  const retirar = () => run(retirarDeSuite, () => 'Te has llevado tu mueble de vuelta.');

  const aportes = data?.aportes ?? [];
  const huespedes = aportes.length;
  return (
    <section className="gh-suite" ref={root} aria-labelledby="gh-suite-title" data-escape-local="open">
      <h3 className="px-sr" id="gh-suite-title">
        La suite de la semana
      </h3>
      <div className="gh-suite__stage">
        {/* La placa de latón, colgada encima de la habitación */}
        {status === 'ready' && (
          <p className="gh-suite__plate">
            <small>Suite de la semana</small>
            <b>{huespedes ? `${huespedes} ${huespedes === 1 ? 'huésped la decora' : 'huéspedes la decoran'}` : 'Recién vaciada'}</b>
          </p>
        )}
        {status === 'ready' && data.room ? (
          <SuiteMirar
            key={data.room.items.map((i) => `${i.uid}:${i.id}:${i.x ?? i.pared}:${i.y ?? i.a}:${i.rot ?? ''}`).join('|') || 'vacia'}
            room={data.room}
            label="La suite de la semana, decorada entre todos los huéspedes"
          />
        ) : (
          <div className="gh-suite__empty">
            <p>{NOTE[status] ?? NOTE.soon}</p>
          </div>
        )}
      </div>
      {status === 'ready' && (
        <div className="gh-desk gh-suite__desk">
          <h4>Tu mueble de esta semana</h4>
          {data.mio && !eligiendo ? (
            <>
              <p className="gh-say gh-say--small">Has traído {nombreDe(data.mio.id).toLowerCase()}. Sigue siendo tuyo: el lunes vuelve a tu casa.</p>
              <div className="gh-suite__acts">
                <button type="button" className="px-btn" disabled={busy} onClick={() => llevar(data.mio.id, intento + 1)}>
                  Otro sitio
                </button>
                <button type="button" className="px-btn" disabled={busy} onClick={() => setEligiendo(true)}>
                  Cambiar
                </button>
                <button type="button" className="px-btn" disabled={busy} onClick={retirar}>
                  Retirar
                </button>
              </div>
            </>
          ) : opciones.length ? (
            <>
              <p className="gh-say gh-say--small">Elige uno de los tuyos: no lo pierdes, solo lo prestas esta semana.</p>
              <ul className="gh-suite__picks" aria-label="Tus muebles para llevar">
                {opciones.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="gh-suite__pick" disabled={busy} aria-pressed={data.mio?.id === c.id} onClick={() => llevar(c.id)}>
                      <img src={thumbs[c.id]} alt="" width={44} height={44} />
                      <span>{c.nombre}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {data.mio && (
                <button type="button" className="px-btn" onClick={() => setEligiendo(false)}>
                  Dejar el que tenía
                </button>
              )}
            </>
          ) : (
            <p className="gh-say gh-say--small">
              {inv
                ? 'Aún no tienes muebles que llevar: los de tu piso y los de la tienda del bajo sirven.'
                : inv === false
                  ? 'No se ha podido mirar qué tienes en casa.'
                  : 'Mirando qué tienes en casa…'}
            </p>
          )}
          <p className="gh-suite__goal">{data.placa ? 'Ya tienes la Placa de la suite.' : `Semanas decorando: ${Math.min(data.semanas, data.meta)} de ${data.meta} para la Placa de la suite.`}</p>
          <h4>Esta semana han traído</h4>
          {aportes.length ? (
            <ul className="gh-suite__who">
              {aportes.map((a) => (
                <li key={a.uid}>
                  <strong>{a.yo ? 'Tú' : a.alias}</strong> · {nombreDe(a.mueble)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="gh-say gh-say--small">Nadie todavía: estrénala tú.</p>
          )}
          <p className="gh-say gh-say--small" role="status" aria-live="polite">
            {msg}
          </p>
        </div>
      )}
    </section>
  );
}
