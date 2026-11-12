// 1.117 (§117) · «Leer con un amigo», en el panel de la sala de lectura: invitar (ahora, en 15 o en 30 min; 15, 25 o
// 45 min), aceptar o no lo que te llega, cómo va tu cita y, al acabar, cuántos minutos habéis leído juntos. Frases
// cerradas, sin texto libre; no contestar y decir que no se ven igual («No ha podido venir»).
// 1.118 (§118): los gestos cerrados con tu amigo durante la cita (`FilaGestos`) y vuestras placas del sofá, sin rachas.
import { useEffect, useState } from 'react';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { GESTOS, METALES, tiempoJuntos } from './gestos';

/**
 * Los gestos cerrados para alguien que lee contigo. `onGesto(id)` devuelve una promesa con si ha salido; si no (dentro
 * del cupo), se dice sin insistir. `solo`: solo «¡Hola!» (el servidor aún no tiene los gestos nuevos).
 */
export function FilaGestos({ para, onGesto, solo = false, compacta = false }) {
  const [estado, setEstado] = useState(null); // { id, ok }
  const [busy, setBusy] = useState(false);
  const lista = solo ? GESTOS.slice(0, 1) : GESTOS;
  const enviar = (id) => {
    setBusy(true);
    Promise.resolve(onGesto(id))
      .then(
        (ok) => setEstado({ id, ok: ok !== false }),
        () => setEstado({ id, ok: false }),
      )
      .finally(() => setBusy(false));
  };
  return (
    <div className={`gh-gestos${compacta ? ' is-compacta' : ''}`}>
      <div className="gh-gestos__fila" role="group" aria-label={`Un gesto para ${para}`}>
        {lista.map((g) => (
          <button type="button" key={g.id} disabled={busy} aria-pressed={estado?.ok && estado.id === g.id ? true : undefined} onClick={() => enviar(g.id)}>
            {g.boton}
          </button>
        ))}
      </div>
      {estado && (
        <p className="gh-gestos__msg" role="status">
          {estado.ok ? `${GESTOS.find((g) => g.id === estado.id).boton} — enviado.` : 'Ya le has hecho un gesto hace muy poco: espera un momento.'}
        </p>
      )}
    </div>
  );
}

/** Vuestras placas del sofá: una por amigo con el que has leído juntos. Sin rachas ni cuentas atrás. */
function Placas({ placas }) {
  if (!placas?.length) return null;
  return (
    <div className="gh-placas">
      <h5 className="gh-placas__titulo">Vuestras placas del sofá</h5>
      <ul aria-label="Vuestras placas del sofá">
        {placas.map((p) => (
          <li key={p.uid} className="gh-placa" data-metal={p.metal}>
            <span className="gh-placa__metal" aria-hidden="true" />
            <p>
              <b>{p.alias ?? 'Tu amigo'} y tú</b> · {tiempoJuntos(p.minutos)} juntos
              <span>
                Placa de {METALES[p.metal] ?? 'latón'}
                {p.hito > 0 ? ` · ${p.hito === 1 ? '1 hora' : `${p.hito} horas`}` : ''}
                {p.libros.length > 0 &&
                  ` · ${p.libros.length === 1 ? 'un libro terminado juntos' : `${p.libros.length} libros terminados juntos`}: ${p.libros
                    .slice(-3)
                    .map((l) => `«${l.titulo}»`)
                    .join(', ')}${p.libros.length > 3 ? '…' : ''}`}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const cuando = (c, ahora) => {
  const n = Math.round((c.empieza - ahora) / 60000);
  return n > 0 ? `dentro de ${n} min` : 'ahora';
};
const minJuntos = (n) => (n === 1 ? '1 minuto' : `${n} minutos`);
export const nombreCita = (c) => c?.alias ?? 'Tu amigo';

const EN = [
  [0, 'Ahora'],
  [15, 'En 15 min'],
  [30, 'En 30 min'],
];
const CUANTO = [15, 25, 45];

/** La fase de una cita aceptada según la hora del servidor: 'espera' (aún no empieza), 'leyendo' o 'fin'. */
export function faseCita(c, ahora) {
  if (!c || c.estado === 'terminada') return 'fin';
  if (c.estado !== 'aceptada') return null;
  if (ahora < c.empieza) return 'espera';
  return ahora < c.fin ? 'leyendo' : 'fin';
}

export function CitaSala({ cita, enSofa, onSofa, onGesto, conGestos = true }) {
  const [abierto, setAbierto] = useState(false);
  const [amigo, setAmigo] = useState(null);
  const [en, setEn] = useState(0);
  const [cuanto, setCuanto] = useState(25);
  const [busy, setBusy] = useState(false);
  const [fallo, setFallo] = useState('');
  const [vistas, setVistas] = useState(() => new Set());
  const [, setTic] = useState(0);
  const { mia, invitaciones, amigos } = cita;
  const ahora = cita.ahora();
  const fase = faseCita(mia, ahora);
  // Con una cita en marcha (o a punto), la cuenta va al segundo
  const conReloj = mia?.estado === 'aceptada' && fase !== 'fin';
  useEffect(() => {
    if (!conReloj) return undefined;
    const t = setInterval(() => setTic((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [conReloj]);

  const hacer = (p, mal) => {
    setBusy(true);
    setFallo('');
    return p
      .then(
        () => true,
        () => {
          setFallo(mal);
          return false;
        },
      )
      .finally(() => setBusy(false));
  };
  const invitar = () =>
    hacer(cita.invitar(amigo, en, cuanto), 'No se ha podido invitar. Prueba otra vez.').then((ok) => {
      if (ok) setAbierto(false);
    });
  const visto = (id) => setVistas((v) => new Set(v).add(id));
  const invitacion = invitaciones.find((x) => !vistas.has(x.cita)) ?? null;
  const resumen = mia && (mia.estado === 'no_vino' || fase === 'fin') && !vistas.has(mia.cita) ? mia : null;
  const enCurso = mia && !resumen && (mia.estado === 'invitada' || mia.estado === 'aceptada') && fase !== 'fin' ? mia : null;

  let cuerpo;
  if (invitacion) {
    cuerpo = (
      <div className="gh-cita__fila" role="status">
        <ReaderAvatar avatarId={invitacion.avatar_id} alias={nombreCita(invitacion)} size="list" decorative />
        <p>
          {nombreCita(invitacion)} te invita a leer juntos {cuando(invitacion, ahora)} ({invitacion.minutos} min) en el sofá para dos.
        </p>
        <div className="gh-21__acts">
          <button type="button" className="gh-21btn is-deal" disabled={busy} onClick={() => hacer(cita.responder(invitacion.cita, true), 'No se ha podido aceptar: quizá ya ha caducado.')}>
            Aceptar
          </button>
          <button type="button" className="gh-21btn is-stand" disabled={busy} onClick={() => hacer(cita.responder(invitacion.cita, false), '').then(() => visto(invitacion.cita))}>
            Ahora no
          </button>
        </div>
      </div>
    );
  } else if (enCurso?.estado === 'invitada') {
    cuerpo = (
      <div className="gh-cita__fila" role="status">
        <ReaderAvatar avatarId={enCurso.avatar_id} alias={nombreCita(enCurso)} size="list" decorative />
        <p>
          Has invitado a {nombreCita(enCurso)} a leer {cuando(enCurso, ahora)} ({enCurso.minutos} min). Si acepta, os veréis en el sofá para dos.
        </p>
        <button type="button" className="gh-21link" disabled={busy} onClick={() => hacer(cita.dejar(enCurso.cita), '')}>
          Anular la invitación
        </button>
      </div>
    );
  } else if (enCurso) {
    cuerpo = (
      <div className="gh-cita__fila" role="status">
        <ReaderAvatar avatarId={enCurso.avatar_id} alias={nombreCita(enCurso)} size="list" decorative />
        <p>
          {fase === 'espera' ? (
            <>
              Habéis quedado {nombreCita(enCurso)} y tú en el sofá para dos. Empieza en <b>{mmss(enCurso.empieza - ahora)}</b> ({enCurso.minutos} min).
            </>
          ) : (
            <>
              Leyendo con {nombreCita(enCurso)}: quedan <b>{mmss(enCurso.fin - ahora)}</b>. {enCurso.juntos > 0 ? `Juntos, ${minJuntos(enCurso.juntos)}.` : ''}
              {enCurso.otro_aqui ? ` ${nombreCita(enCurso)} está en el sofá.` : ''}
            </>
          )}
        </p>
        <div className="gh-21__acts">
          {!enSofa && onSofa && (
            <button type="button" className="gh-21btn is-deal" onClick={onSofa}>
              Ir al sofá
            </button>
          )}
          <button type="button" className="gh-21btn is-stand" disabled={busy} onClick={() => hacer(cita.dejar(enCurso.cita), '')}>
            Dejar la cita
          </button>
        </div>
        {enCurso.estado === 'aceptada' && onGesto && <FilaGestos para={nombreCita(enCurso)} solo={!conGestos} onGesto={(g) => onGesto(enCurso.uid, g)} />}
        <p className="gh-cita__nota">Los minutos juntos cuentan mientras estáis los dos en el sofá con la app a la vista.</p>
      </div>
    );
  } else if (resumen) {
    cuerpo = (
      <div className="gh-cita__fila" role="status">
        <ReaderAvatar avatarId={resumen.avatar_id} alias={nombreCita(resumen)} size="list" decorative />
        <p>{resumen.estado === 'no_vino' ? `${nombreCita(resumen)} no ha podido venir.` : `Habéis leído juntos ${minJuntos(resumen.juntos)}, ${nombreCita(resumen)} y tú.`}</p>
        <button type="button" className="gh-21link" onClick={() => visto(resumen.cita)}>
          Vale
        </button>
      </div>
    );
  } else if (abierto) {
    cuerpo = (
      <div className="gh-cita__form">
        {amigos.length ? (
          <>
            <div className="gh-cita__amigos" role="group" aria-label="A quién invitas">
              {amigos.map((a) => (
                <button type="button" key={a.uid} aria-pressed={amigo === a.uid} onClick={() => setAmigo(a.uid)}>
                  <ReaderAvatar avatarId={a.avatar_id} alias={a.alias ?? 'Tu amigo'} size="list" decorative />
                  <span>{a.alias ?? 'Tu amigo'}</span>
                </button>
              ))}
            </div>
            <div className="gh-lect__dura" role="group" aria-label="Cuándo">
              {EN.map(([m, t]) => (
                <button type="button" key={m} aria-pressed={en === m} onClick={() => setEn(m)}>
                  {t}
                </button>
              ))}
            </div>
            <div className="gh-lect__dura" role="group" aria-label="Cuánto">
              {CUANTO.map((m) => (
                <button type="button" key={m} aria-pressed={cuanto === m} onClick={() => setCuanto(m)}>
                  {m} min
                </button>
              ))}
            </div>
            <div className="gh-21__acts">
              <button type="button" className="gh-21btn is-deal" disabled={busy || !amigo} onClick={invitar}>
                Invitar
              </button>
              <button type="button" className="gh-21btn is-stand" onClick={() => setAbierto(false)}>
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="gh-21__note">Cuando alguien y tú os sigáis, podréis quedar aquí a leer en el sofá para dos.</p>
            <button type="button" className="gh-21link" onClick={() => setAbierto(false)}>
              Vale
            </button>
          </>
        )}
      </div>
    );
  } else {
    cuerpo = (
      <div className="gh-cita__fila">
        <p>Queda con un amigo a leer a la vez en el sofá para dos, con un reloj para los dos.</p>
        <button
          type="button"
          className="gh-21btn is-deal"
          onClick={() => {
            setAmigo(amigos.length === 1 ? amigos[0].uid : null);
            setAbierto(true);
          }}
        >
          Invitar a un amigo
        </button>
      </div>
    );
  }

  return (
    <section className="gh-cita" aria-labelledby="gh-cita-title">
      <h4 className="gh-21__lobbytitle" id="gh-cita-title">
        Leer con un amigo
      </h4>
      {cuerpo}
      <Placas placas={cita.placas} />
      {fallo && (
        <p className="gh-21__msg" role="status">
          {fallo}
        </p>
      )}
    </section>
  );
}
