// 1.153 · La app «Amigos» del ordenador del piso (docs/qa/amigos-vecinos.md, bloque 3; SPEC §153): una agenda de cuero con
// fichas. Cuatro pestañas: tus amigos (qué leen, lo que habéis empezado a la vez y lo que puedes hacer con cada uno), buscar
// (por alias o por código de amigo, y quién te sigue), el buzón (recomendaciones, propuestas y llaves) y lo que ven de ti.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { percentRead } from '../../../domain/books';
import { useAtras } from '../../../hooks/useAtras';
import { useLibrary } from '../../../state/useLibrary';
import { llaveBonita, mudarse } from '../../edificio/llave';
import { salaCitaInvitar } from '../../edificio/service';
import { useCommunity } from '../hooks/useCommunity';
import { Libo } from '../../libo/LiboRincon';
import { FRASES, FRASES_IDS, activarAmigos, diaCorto, guardarJuntos, libroDe, pendientesBuzon } from '../amigosLectura';
import { searchProfiles } from '../services/community';
import { buscarCodigo, darLlaveAmigo, dejarJuntos, guardarAjustes, loadAmigos, proponerJuntos, publicarLectura, recomendacionesVistas, recomendar, responderJuntos } from '../services/amigos';
import './amigos.css';

const PESTANAS = [
  { id: 'amigos', label: 'Amigos' },
  { id: 'buscar', label: 'Buscar' },
  { id: 'buzon', label: 'Buzón' },
  { id: 'ajustes', label: 'Lo que ven' },
];
const CODIGO = /^[A-HJ-NP-Z2-9]{8}$/;
const limpiarCodigo = (t) =>
  String(t ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();

function Avatar({ p, size = 'list' }) {
  return <ReaderAvatar userId={p?.user_id ?? p?.uid} avatarId={p?.avatar_id} alias={p?.alias ?? ''} size={size} decorative />;
}

/** Un libro con su autor, como se escribe en las fichas. */
const Libro = ({ l }) => (
  <>
    <cite>{l.titulo}</cite>
    {l.autor ? <span className="am-autor">, de {l.autor}</span> : null}
  </>
);

export function AmigosApp({ onVisitar, onSala, onComunidad }) {
  const community = useCommunity({ autoload: true });
  const { state, actions } = useLibrary();
  const uid = community.userId;
  const [vista, setVista] = useState('amigos');
  const [d, setD] = useState(null);
  const [fase, setFase] = useState('cargando');
  const [aviso, setAviso] = useState('');
  const [hoja, setHoja] = useState(null); // { tipo: 'recomendar' | 'juntos' | 'mudarse', amigo?, llave? }
  const [ocupado, setOcupado] = useState(false);
  const books = state.books;

  const cargar = useCallback(async () => {
    try {
      const datos = await loadAmigos();
      setD(datos);
      setFase('listo');
      guardarJuntos(uid, datos.juntos);
      return datos;
    } catch (e) {
      setFase(e.code === 'unavailable' ? 'sin-servidor' : 'error');
      return null;
    }
  }, [uid]);

  useEffect(() => {
    if (community.status !== 'ready' || !community.member || !uid) return;
    activarAmigos(uid);
    let vivo = true;
    cargar().then((datos) => {
      // Al abrir: lo que lees, para que tus amigos lo vean ya (y tu avance en lo que leéis a la vez)
      if (vivo && datos) publicarLectura(uid, books, { forzar: true, juntos: datos.juntos }).catch(() => {});
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [community.status, community.member, uid, cargar]);

  // El buzón, al abrirlo, da por vistas las recomendaciones
  useEffect(() => {
    if (vista === 'buzon' && d?.recomendaciones.some((r) => !r.vista)) recomendacionesVistas().catch(() => {});
  }, [vista, d]);

  useAtras(Boolean(hoja), () => setHoja(null));

  const hacer = async (fn, ok) => {
    setOcupado(true);
    setAviso('');
    try {
      const r = await fn();
      if (ok) setAviso(typeof ok === 'function' ? ok(r) : ok);
      await cargar();
      return true;
    } catch (e) {
      setAviso(e.message || 'No se ha podido. Prueba otra vez.');
      return false;
    } finally {
      setOcupado(false);
    }
  };

  if (community.status === 'off' || community.status === 'signed-out') {
    return <Vacia titulo="Tus amigos te esperan" texto="Inicia sesión en tu cuenta para buscar a tus amigos y ver qué leen." />;
  }
  if (community.status === 'ready' && !community.member) {
    return (
      <Vacia titulo="Tus amigos te esperan" texto="Activa la comunidad en tu perfil para buscar a tus amigos, ver qué leen y leer a la vez.">
        {onComunidad && (
          <button type="button" className="am-btn am-btn--tinta" onClick={onComunidad}>
            Ir a mi perfil
          </button>
        )}
      </Vacia>
    );
  }
  if (fase === 'sin-servidor') return <Vacia titulo="Amigos llega pronto" texto="El servidor aún no tiene los amigos. En cuanto los tenga, aparecerán aquí." />;
  if (fase === 'error') {
    return (
      <Vacia titulo="No se ha podido abrir la agenda" texto="Revisa la conexión y prueba otra vez.">
        <button type="button" className="am-btn am-btn--tinta" onClick={() => setFase('cargando') || cargar()}>
          Probar otra vez
        </button>
      </Vacia>
    );
  }
  if (!d) {
    return (
      <div className="am am--cargando" aria-busy="true">
        <p className="am-cargando">Abriendo la agenda…</p>
      </div>
    );
  }

  const enBuzon = pendientesBuzon(d);
  const cuentas = { amigos: d.amigos.length || null, buscar: d.solicitudes.length || null, buzon: enBuzon || null };

  return (
    <div className="am" data-am-vista={vista}>
      <div className="am-pestanas" role="tablist" aria-label="Secciones de la agenda">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            id={`am-tab-${p.id}`}
            aria-selected={vista === p.id}
            aria-controls="am-hoja"
            className={`am-pestana am-pestana--${p.id}`}
            onClick={() => setVista(p.id)}
          >
            {p.label}
            {cuentas[p.id] ? (
              <b className={p.id === 'amigos' ? 'am-cuenta am-cuenta--suave' : 'am-cuenta'} aria-label={p.id === 'amigos' ? `(${cuentas[p.id]})` : `(${cuentas[p.id]} nuevos)`}>
                {cuentas[p.id]}
              </b>
            ) : null}
          </button>
        ))}
        {/* 1.154 · Libo y su capítulo de la agenda (docs/qa/amigos-vecinos.md, bloque 4) */}
        <Libo lugar="amigos" capitulo="amigos" espera=".am-pestanas" respiro={700} variante="cabecera" />
      </div>
      <section className="am-hoja" id="am-hoja" role="tabpanel" aria-labelledby={`am-tab-${vista}`}>
        <p className="am-aviso" role="status" aria-live="polite">
          {aviso}
        </p>
        {vista === 'amigos' && <VistaAmigos d={d} books={books} ocupado={ocupado} hacer={hacer} setHoja={setHoja} onVisitar={onVisitar} onSala={onSala} irA={setVista} />}
        {vista === 'buscar' && <VistaBuscar d={d} uid={uid} ocupado={ocupado} hacer={hacer} setAviso={setAviso} />}
        {vista === 'buzon' && <VistaBuzon d={d} books={books} actions={actions} ocupado={ocupado} hacer={hacer} setHoja={setHoja} setAviso={setAviso} />}
        {vista === 'ajustes' && <VistaAjustes d={d} ocupado={ocupado} hacer={hacer} />}
      </section>
      {hoja && <Hoja hoja={hoja} books={books} ocupado={ocupado} hacer={hacer} onClose={() => setHoja(null)} />}
    </div>
  );
}

function Vacia({ titulo, texto, children }) {
  return (
    <div className="am am--vacia">
      <section className="am-hoja am-hoja--sola">
        <h3 className="am-titulo">{titulo}</h3>
        <p>{texto}</p>
        {children}
      </section>
    </div>
  );
}

// ── Tus amigos ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function VistaAmigos({ d, books, ocupado, hacer, setHoja, onVisitar, onSala, irA }) {
  const activas = d.juntos.filter((j) => j.estado === 'activa');
  const esperan = d.juntos.filter((j) => j.estado === 'invitada' && j.propuse);
  if (!d.amigos.length) {
    return (
      <div className="am-vacio">
        <h3 className="am-titulo">Tu agenda está en blanco</h3>
        <p>Amigos son quienes os seguís los dos. Busca a alguien por su alias o pásale tu código de amigo.</p>
        <p className="am-codigo-mini">
          Tu código: <b>{llaveBonita(d.codigo)}</b>
        </p>
        <button type="button" className="am-btn am-btn--tinta" onClick={() => irA('buscar')}>
          Buscar amigos
        </button>
      </div>
    );
  }
  return (
    <>
      {(activas.length > 0 || esperan.length > 0) && (
        <section className="am-juntos" aria-labelledby="am-juntos-t">
          <h3 className="am-titulo" id="am-juntos-t">
            Leemos a la vez
          </h3>
          <ul>
            {activas.map((j) => (
              <Juntos key={j.id} j={j} books={books} ocupado={ocupado} hacer={hacer} />
            ))}
            {esperan.map((j) => (
              <li key={j.id} className="am-junto am-junto--espera">
                <p>
                  Has propuesto a <b>{j.alias}</b> leer a la vez <Libro l={j} />. Aún no ha contestado.
                </p>
                <button type="button" className="am-btn am-btn--papel" disabled={ocupado} onClick={() => hacer(() => dejarJuntos(j.id), 'Propuesta retirada.')}>
                  Retirar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <h3 className="am-titulo">Tus amigos</h3>
      <ul className="am-fichas">
        {d.amigos.map((a, i) => (
          <Ficha key={a.user_id} a={a} i={i} d={d} ocupado={ocupado} hacer={hacer} setHoja={setHoja} onVisitar={onVisitar} onSala={onSala} />
        ))}
      </ul>
    </>
  );
}

function Barra({ quien, pct }) {
  return (
    <div className="am-barra">
      <span className="am-barra__quien">{quien}</span>
      {pct == null ? (
        <span className="am-barra__nada">sin compartir</span>
      ) : (
        <>
          <span className="am-barra__pista" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={pct} aria-label={`${quien}: ${pct} %`}>
            <i style={{ width: `${pct}%` }} />
          </span>
          <b>{pct} %</b>
        </>
      )}
    </div>
  );
}

function Juntos({ j, books, ocupado, hacer }) {
  const mio = libroDe(books, j.titulo);
  // Lo tuyo, del libro que tienes (aunque aún no se haya mandado); si no lo tienes, lo que diga el servidor
  const pctMio = mio ? (mio.status === 'read' ? 100 : Math.round(percentRead(mio))) : j.avance_mio;
  return (
    <li className="am-junto">
      <div className="am-junto__cabeza">
        <Avatar p={j} />
        <p>
          Con <b>{j.alias}</b>: <Libro l={j} />
        </p>
      </div>
      <Barra quien="Tú" pct={pctMio ?? 0} />
      <Barra quien={j.alias} pct={j.avance_suyo} />
      {!mio && <p className="am-nota">No tienes este libro en tu biblioteca: añádelo para que cuente tu avance.</p>}
      <button type="button" className="am-btn am-btn--papel am-junto__dejar" disabled={ocupado} onClick={() => hacer(() => dejarJuntos(j.id), 'Lo habéis dejado.')}>
        Dejarlo
      </button>
    </li>
  );
}

function Ficha({ a, i, d, ocupado, hacer, setHoja, onVisitar, onSala }) {
  const tieneLlave = d.llavesDadas.includes(a.user_id);
  const leyendo = a.leyendo?.[0];
  const terminado = a.terminados?.[0];
  return (
    <li className={`am-ficha am-ficha--${i % 3}`}>
      <div className="am-ficha__cabeza">
        <span className="am-ficha__foto">
          <Avatar p={a} size="review" />
        </span>
        <div>
          <h4>{a.alias}</h4>
          {a.vecino ? <span className="am-sello">Vive en tu edificio</span> : tieneLlave ? <span className="am-sello am-sello--llave">Tiene tu llave</span> : null}
        </div>
      </div>
      <dl className="am-ficha__lectura">
        <dt>Leyendo</dt>
        <dd>{a.leyendo == null ? <i className="am-nada">No lo comparte</i> : leyendo ? <Libro l={leyendo} /> : <i className="am-nada">Nada ahora mismo</i>}</dd>
        <dt>Terminó</dt>
        <dd>
          {a.terminados == null ? (
            <i className="am-nada">No lo comparte</i>
          ) : terminado ? (
            <>
              <Libro l={terminado} />
              {terminado.fecha ? <small className="am-dia"> · {diaCorto(terminado.fecha)}</small> : null}
            </>
          ) : (
            <i className="am-nada">Aún nada</i>
          )}
        </dd>
      </dl>
      <div className="am-ficha__acciones">
        <button type="button" className="am-btn" onClick={() => onVisitar?.(a.user_id)}>
          Visitar su piso
        </button>
        <button type="button" className="am-btn" onClick={() => setHoja({ tipo: 'recomendar', amigo: a })}>
          Recomendar un libro
        </button>
        <button type="button" className="am-btn" onClick={() => setHoja({ tipo: 'juntos', amigo: a })}>
          Leer el mismo
        </button>
        <button
          type="button"
          className="am-btn"
          disabled={ocupado}
          onClick={async () => {
            if (await hacer(() => salaCitaInvitar(a.user_id, 0, 25), `Has invitado a ${a.alias} a leer 25 minutos en la sala del hotel.`)) onSala?.();
          }}
        >
          Leer juntos en la sala
        </button>
        {!a.vecino && !tieneLlave && (
          <button
            type="button"
            className="am-btn am-btn--llave"
            disabled={ocupado}
            onClick={() => hacer(() => darLlaveAmigo(a.user_id), `Le has dado la llave de tu edificio a ${a.alias}: le llegará a su agenda.`)}
          >
            Darle la llave
          </button>
        )}
      </div>
    </li>
  );
}

// ── Buscar ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
function VistaBuscar({ d, uid, ocupado, hacer, setAviso }) {
  const community = useCommunity();
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState(null); // null | { por: 'codigo' | 'alias', lista: [] }
  const [buscando, setBuscando] = useState(false);
  const siguiendo = useMemo(() => new Set([...d.amigos, ...d.esperando].map((x) => x.user_id)), [d]);

  const buscar = async (e) => {
    e.preventDefault();
    const cod = limpiarCodigo(texto);
    setBuscando(true);
    setAviso('');
    try {
      if (CODIGO.test(cod)) {
        const p = await buscarCodigo(cod);
        setResultado({ por: 'codigo', lista: p ? [p] : [] });
      } else {
        setResultado({ por: 'alias', lista: await searchProfiles(texto, uid) });
      }
    } catch (err) {
      setAviso(err.message || 'No se ha podido buscar.');
    } finally {
      setBuscando(false);
    }
  };

  const seguir = (p) =>
    hacer(() => community.setFollow(p.user_id, true), d.solicitudes.some((s) => s.user_id === p.user_id) ? `Ya sois amigos ${p.alias} y tú.` : `Sigues a ${p.alias}. Seréis amigos cuando te siga.`);

  const compartir = async () => {
    const t = `Mi código de amigo en Libotown: ${llaveBonita(d.codigo)}`;
    try {
      if (navigator.share) await navigator.share({ text: t });
      else {
        await navigator.clipboard.writeText(t);
        setAviso('Código copiado.');
      }
    } catch {
      // Compartir cancelado
    }
  };

  return (
    <>
      <section className="am-carnet" aria-labelledby="am-carnet-t">
        <h3 className="am-titulo" id="am-carnet-t">
          Tu código de amigo
        </h3>
        <p className="am-carnet__codigo" aria-label={`Tu código: ${d.codigo.split('').join(' ')}`}>
          {llaveBonita(d.codigo)}
        </p>
        <p className="am-nota">Pásaselo a quien quieras: con él te encuentra sin buscar tu alias.</p>
        <button type="button" className="am-btn am-btn--tinta" onClick={compartir}>
          Compartir mi código
        </button>
      </section>

      <form className="am-busca" onSubmit={buscar} role="search">
        <label htmlFor="am-busca-texto">Busca por alias o por código</label>
        <div>
          <input id="am-busca-texto" type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Alias o ABCD-EFGH" autoComplete="off" enterKeyHint="search" />
          <button type="submit" className="am-btn am-btn--tinta" disabled={buscando || texto.trim().length < 2}>
            Buscar
          </button>
        </div>
      </form>
      {resultado && (
        <ul className="am-lista" aria-label="Resultados">
          {resultado.lista.length === 0 && <li className="am-nada">{resultado.por === 'codigo' ? 'Ese código no es de nadie que puedas ver.' : 'Nadie con ese alias.'}</li>}
          {resultado.lista.map((p) => (
            <li key={p.user_id}>
              <Avatar p={p} />
              <b>{p.alias}</b>
              {d.amigos.some((a) => a.user_id === p.user_id) ? (
                <span className="am-sello">Amigos</span>
              ) : siguiendo.has(p.user_id) ? (
                <span className="am-sello am-sello--gris">Le sigues</span>
              ) : (
                <button type="button" className="am-btn am-btn--tinta" disabled={ocupado} onClick={() => seguir(p)}>
                  Seguir
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="am-sol-t">
        <h3 className="am-titulo" id="am-sol-t">
          Te siguen
        </h3>
        {d.solicitudes.length === 0 ? (
          <p className="am-nada">Nadie nuevo.</p>
        ) : (
          <ul className="am-lista">
            {d.solicitudes.map((p) => (
              <li key={p.user_id}>
                <Avatar p={p} />
                <b>{p.alias}</b>
                <button type="button" className="am-btn am-btn--tinta" disabled={ocupado} onClick={() => seguir(p)}>
                  Seguir también
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {d.esperando.length > 0 && (
        <section aria-labelledby="am-esp-t">
          <h3 className="am-titulo" id="am-esp-t">
            Esperando a que te sigan
          </h3>
          <ul className="am-lista">
            {d.esperando.map((p) => (
              <li key={p.user_id}>
                <Avatar p={p} />
                <b>{p.alias}</b>
                <span className="am-sello am-sello--gris">Le sigues</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

// ── El buzón ───────────────────────────────────────────────────────────────────────────────────────────────────────────
function VistaBuzon({ d, books, actions, ocupado, hacer, setHoja, setAviso }) {
  const propuestas = d.juntos.filter((j) => j.estado === 'invitada' && !j.propuse);
  const vacio = !d.llaves.length && !propuestas.length && !d.recomendaciones.length;
  const anadir = (l) => {
    actions.addBook({ title: l.titulo, author: l.autor || 'Autor desconocido', status: 'want' });
    setAviso(`«${l.titulo}» está en tu biblioteca, en Quiero leer.`);
  };
  if (vacio) {
    return (
      <div className="am-vacio">
        <h3 className="am-titulo">El buzón está vacío</h3>
        <p>Aquí llegan los libros que te recomiendan tus amigos, sus propuestas para leer a la vez y las llaves de sus edificios.</p>
      </div>
    );
  }
  return (
    <ul className="am-cartas">
      {d.llaves.map((k) => (
        <li key={k.codigo} className="am-carta am-carta--llave">
          <Avatar p={k} />
          <div>
            <p>
              <b>{k.alias}</b> te ha dado la llave de su edificio.
            </p>
            <p className="am-nota">Abre hasta el {diaCorto(k.caduca)}. Si te mudas, te llevas tu piso y tus muebles.</p>
            <button type="button" className="am-btn am-btn--tinta" disabled={ocupado} onClick={() => setHoja({ tipo: 'mudarse', llave: k })}>
              Mudarme
            </button>
          </div>
        </li>
      ))}
      {propuestas.map((j) => {
        const tengo = libroDe(books, j.titulo);
        return (
          <li key={j.id} className="am-carta am-carta--juntos">
            <Avatar p={j} />
            <div>
              <p>
                <b>{j.alias}</b> te propone leer a la vez <Libro l={j} />.
              </p>
              <p className="am-nota">Veréis el avance del otro en porcentaje, nada más.</p>
              <div className="am-carta__acciones">
                <button
                  type="button"
                  className="am-btn am-btn--tinta"
                  disabled={ocupado}
                  onClick={async () => {
                    if (!tengo) anadir(j);
                    await hacer(() => responderJuntos(j.id, true), `Leéis a la vez «${j.titulo}».`);
                  }}
                >
                  {tengo ? 'Leerlo a la vez' : 'Añadirlo y leerlo a la vez'}
                </button>
                <button type="button" className="am-btn am-btn--papel" disabled={ocupado} onClick={() => hacer(() => responderJuntos(j.id, false), 'Le has dicho que ahora no.')}>
                  Ahora no
                </button>
              </div>
            </div>
          </li>
        );
      })}
      {d.recomendaciones.map((r) => {
        const tengo = libroDe(books, r.titulo);
        return (
          <li key={r.id} className={r.vista ? 'am-carta' : 'am-carta am-carta--nueva'}>
            <Avatar p={r} />
            <div>
              <p>
                <b>{r.alias ?? 'Un amigo'}</b> te recomienda <Libro l={r} />.
              </p>
              <blockquote>«{FRASES[r.frase] ?? FRASES.te_gustara}»</blockquote>
              {tengo ? (
                <span className="am-sello am-sello--gris">Ya lo tienes</span>
              ) : (
                <button type="button" className="am-btn" onClick={() => anadir(r)}>
                  Añadir a Quiero leer
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ── Lo que ven de ti ───────────────────────────────────────────────────────────────────────────────────────────────────
const AJUSTES = [
  { id: 'leyendo', titulo: 'Qué leo ahora', texto: 'El título y el autor de lo que tienes empezado (hasta tres).' },
  { id: 'terminados', titulo: 'Qué termino', texto: 'Los cinco últimos libros que terminas y el día.' },
  { id: 'juntos', titulo: 'Mi avance cuando leemos a la vez', texto: 'El porcentaje del libro que leéis a la vez, solo para ese amigo.' },
];

function VistaAjustes({ d, ocupado, hacer }) {
  const cambiar = (id) => hacer(() => guardarAjustes({ ...d.ajustes, [id]: !d.ajustes[id] }), d.ajustes[id] ? 'Hecho: ya no lo ven.' : 'Hecho: tus amigos lo verán.');
  return (
    <>
      <h3 className="am-titulo">Lo que ven tus amigos</h3>
      <p className="am-nota">Solo tus amigos (os seguís los dos), nunca el resto de la comunidad. Nunca tus notas, tus reseñas privadas ni tus páginas por día. Lo que apagas se borra del servidor.</p>
      <ul className="am-ajustes">
        {AJUSTES.map((a) => (
          <li key={a.id}>
            <label>
              <input type="checkbox" role="switch" checked={d.ajustes[a.id]} disabled={ocupado} onChange={() => cambiar(a.id)} />
              <span>
                <b>{a.titulo}</b>
                <small>{a.texto}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}

// ── Las hojas: recomendar, leer el mismo y mudarse ─────────────────────────────────────────────────────────────────────
function Hoja({ hoja, books, ocupado, hacer, onClose }) {
  const ref = useRef(null);
  const [libro, setLibro] = useState(null);
  const [frase, setFrase] = useState('te_gustara');
  const [filtro, setFiltro] = useState('');
  useEffect(() => {
    ref.current?.querySelector('h3')?.focus();
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const candidatos = useMemo(() => {
    const base = hoja.tipo === 'recomendar' ? books.filter((b) => b.status === 'read') : books.filter((b) => b.status === 'reading' || b.status === 'want');
    const f = filtro.trim().toLowerCase();
    return base
      .filter((b) => !f || `${b.title} ${b.author}`.toLowerCase().includes(f))
      .sort((a, b) => String(b.finishedAt ?? b.updatedAt ?? '').localeCompare(String(a.finishedAt ?? a.updatedAt ?? '')))
      .slice(0, 12);
  }, [books, hoja.tipo, filtro]);

  const a = hoja.amigo;
  let cuerpo;
  if (hoja.tipo === 'mudarse') {
    const k = hoja.llave;
    cuerpo = (
      <>
        <h3 tabIndex={-1}>¿Te mudas al edificio de {k.alias}?</h3>
        <p>Te llevas tu piso y tus muebles; tu puerta será una de las libres. Si un día quieres, te puedes ir desde el telefonillo.</p>
        <div className="am-hoja-flot__acciones">
          <button
            type="button"
            className="am-btn am-btn--tinta"
            disabled={ocupado}
            onClick={async () => {
              if (await hacer(() => mudarse(k.codigo), `Ya vives en el edificio de ${k.alias}.`)) onClose();
            }}
          >
            Mudarme
          </button>
          <button type="button" className="am-btn am-btn--papel" onClick={onClose}>
            Ahora no
          </button>
        </div>
      </>
    );
  } else {
    const recomendando = hoja.tipo === 'recomendar';
    cuerpo = (
      <>
        <h3 tabIndex={-1}>{recomendando ? `Recomendar un libro a ${a.alias}` : `Leer el mismo libro que ${a.alias}`}</h3>
        <p className="am-nota">
          {recomendando ? 'Elige uno de los que has terminado y una frase: le llega a su buzón.' : 'Elige uno que estés leyendo o quieras leer. Si acepta, veréis el avance del otro en porcentaje.'}
        </p>
        <label className="am-filtro">
          <span className="px-sr">Filtrar tus libros</span>
          <input type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Busca entre tus libros" autoComplete="off" />
        </label>
        {candidatos.length === 0 ? (
          <p className="am-nada">{recomendando ? 'Aún no has terminado ningún libro.' : 'No tienes libros empezados ni por leer.'}</p>
        ) : (
          <ul className="am-libros" role="radiogroup" aria-label="Tus libros">
            {candidatos.map((b) => (
              <li key={b.id}>
                <button type="button" role="radio" aria-checked={libro?.id === b.id} onClick={() => setLibro(b)}>
                  <cite>{b.title}</cite>
                  <small>{b.author}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
        {recomendando && (
          <fieldset className="am-frases">
            <legend>Con una frase</legend>
            {FRASES_IDS.map((id) => (
              <label key={id}>
                <input type="radio" name="am-frase" value={id} checked={frase === id} onChange={() => setFrase(id)} />
                <span>«{FRASES[id]}»</span>
              </label>
            ))}
          </fieldset>
        )}
        <div className="am-hoja-flot__acciones">
          <button
            type="button"
            className="am-btn am-btn--tinta"
            disabled={!libro || ocupado}
            onClick={async () => {
              const l = { titulo: libro.title, autor: libro.author };
              const ok = recomendando
                ? await hacer(() => recomendar(a.user_id, l, frase), `Le has recomendado «${libro.title}» a ${a.alias}.`)
                : await hacer(() => proponerJuntos(a.user_id, l), `Le has propuesto a ${a.alias} leer a la vez «${libro.title}».`);
              if (ok) onClose();
            }}
          >
            {recomendando ? 'Recomendárselo' : 'Proponérselo'}
          </button>
          <button type="button" className="am-btn am-btn--papel" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </>
    );
  }
  return (
    <div className="am-velo" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section
        ref={ref}
        className="am-hoja-flot"
        role="dialog"
        aria-modal="true"
        aria-label={hoja.tipo === 'mudarse' ? 'Mudarse' : hoja.tipo === 'recomendar' ? 'Recomendar un libro' : 'Leer el mismo libro'}
        data-escape-local="open"
      >
        {cuerpo}
      </section>
    </div>
  );
}

export default AmigosApp;
