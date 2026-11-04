// La Lonja del entresuelo del Gran Hotel (docs/qa/gran-hotel.md §9.2): un puesto por persona para cambiar muebles o venderlos
// por tickets, con frases cerradas y sin texto libre. Es la primera sala de dos plantas y se ve entera, en corte: abajo, la
// nave, donde cada puesto es alguien de verdad con sus muebles en el mostrador; arriba, el altillo con lo tuyo. El panel es de
// mercado, con la soltura del casino pero su propia cara: un toldo con tres faldones, la pizarra de las cuentas y etiquetas de
// papel de estraza en la pared de ladrillo (clases `lj-`). Remedios, la lonjera, solo dice cosas ciertas y nunca mete prisa.
// Todo lo decide el servidor (20261114120000_hotel_lonja.sql); aquí solo se elige, y lo que no se puede hacer, se dice.
import { acabadoOf } from '../acabados';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_AVATAR } from '../actor';
import { CATALOG, catalogItem, isEspecial, isMistico } from '../catalog';
import { rarezaOf } from '../economy';
import { renderActorThumb, renderThumb } from '../render';
import { aceptarLonja, buscarLonja, canjearLonja, cargarLonja, loadInventario, ponerLonja, recogerTaller, retirarLonja, toldoLonja, zarparEstiba } from '../service';
import { createShopSfx } from '../shopAudio';
import { PixelNum } from './cartas21';
import { LONJA_H, LONJA_W, PUESTOS_POR_PASILLO, REMEDIOS, TOLDOS, TOLDOS_ESPECIALES, renderLonja } from './lonjaArt';
import { LonjaEstiba } from './LonjaEstiba';
import { LonjaTablon } from './LonjaTablon';
import { tallerDe } from '../talleres';
import { useCountUp } from './useCountUp';

// El cartel de algo de la escena, arriba y en medio de su recuadro. El resto del objeto se toca por píxeles (`Toque`)
const zona = (z) => (z ? { left: `${(z.left + z.width / 2) * 100}%`, top: `${z.top * 100}%` } : { display: 'none' });

/** Toca la escena: `hit` dice qué hay debajo por píxeles. Es para el dedo; con teclado y lector están los carteles. */
function Toque({ hit, onToque }) {
  const tocar = (e) => {
    const c = e.currentTarget.getBoundingClientRect();
    const que = hit((e.clientX - c.left) / c.width, (e.clientY - c.top) / c.height);
    if (que) onToque(que);
  };
  return <div className="gh-lonja__toque" aria-hidden="true" onClick={tocar} />;
}

// Una copia con acabado se escribe «mueble@acabado» (1.86)
const partes = (clave) => String(clave).split('@');
const daDe = (o) => (o.acabado ? `${o.da}@${o.acabado}` : o.da);
const nombre = (clave) => {
  const [id, acabado] = partes(clave);
  return `${catalogItem(id)?.nombre ?? 'Mueble'}${acabado ? ` ${acabadoOf(acabado)?.nombre ?? ''}` : ''}`;
};
const PASO = 5;
const RAREZAS = ['comun', 'poco-comun', 'raro'];
const RAREZA_NOMBRE = { comun: 'común', 'poco-comun': 'poco común', raro: 'raro' };
const COMISION = 0.1;
const DICHOS = ['Aquí no se regatea: se cambia.', 'Lo que ves en el mostrador es lo que hay.', 'Las sagas, los místicos y las mascotas no pasan por esta lonja.', 'El gato no se cambia. Ya lo han intentado.'];
const nivel = (r) => RAREZAS.indexOf(r);
const rarezaDe = (clave) => rarezaOf(catalogItem(partes(clave)[0]));
const vecinas = (r) => RAREZAS.filter((x) => Math.abs(nivel(x) - nivel(r)) <= 1);
const pedibles = (r) =>
  CATALOG.filter((c) => !c.set && !c.mascota && !isMistico(c) && !isEspecial(c) && vecinas(r).includes(rarezaOf(c))).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
const busca = (o) => (o.busca_mueble ? nombre(o.busca_mueble) : o.busca_rareza ? `cualquier mueble ${RAREZA_NOMBRE[o.busca_rareza]}` : `${o.busca_tickets} tickets`);
let cara = null;
const retrato = () => (cara ??= renderActorThumb(REMEDIOS, { frame: 'head', size: 44 }).toDataURL());

/** Un puesto por persona: agrupa las ofertas por quien las pone y le da un toldo que siempre es el mismo. */
function agruparPuestos(ofertas) {
  const puestos = new Map();
  for (const o of ofertas) {
    const clave = o.dueno ?? o.id;
    if (!puestos.has(clave)) {
      const tono = [...String(clave)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 9973, 7) % TOLDOS.length;
      puestos.set(clave, { dueno: clave, alias: o.alias ?? 'alguien', personaje: o.personaje, tono, color: TOLDOS_ESPECIALES[o.toldo]?.color ?? null, ofertas: [] });
    }
    puestos.get(clave).ofertas.push(o);
  }
  return [...puestos.values()];
}

function Mueble({ id: clave }) {
  const [id, acabado] = partes(clave);
  const src = useMemo(() => renderThumb(id, 0, 44, acabado ?? null).toDataURL(), [id, acabado]);
  return <img className={`gh-lonja__thumb${acabado ? ' is-acabado' : ''}`} src={src} alt="" draggable="false" />;
}

function Elegir({ ids, valor, onElegir }) {
  return (
    <div className="gh-lonja__elige">
      {ids.map((id) => (
        <button key={id} type="button" className="gh-lonja__pick" aria-pressed={id === valor} aria-label={nombre(id)} onClick={() => onElegir(id)}>
          <Mueble id={id} />
        </button>
      ))}
    </div>
  );
}

function Formulario({ lonja, busy, inicial = null, onPoner, onCancelar }) {
  const ids = [...lonja.libresAcabado.map((x) => `${x.mueble}@${x.acabado}`), ...Object.keys(lonja.libres).sort((a, b) => nombre(a).localeCompare(nombre(b), 'es'))];
  const topeCobro = lonja.cobro.hecho >= lonja.cobro.tope;
  const [doy, setDoy] = useState(ids.includes(inicial) ? inicial : (ids[0] ?? null));
  const [modo, setModo] = useState(topeCobro ? 'mueble' : 'tickets');
  const [pido, setPido] = useState('');
  const [clase, setClase] = useState(null);
  const [precio, setPrecio] = useState(null);
  if (!ids.length) {
    return (
      <div className="lj-albaran">
        <p className="gh-lonja__txt">No tienes copias libres que se puedan cambiar. Guarda en tu piso lo que quieras ofrecer.</p>
        <button type="button" className="lj-link" onClick={onCancelar}>
          Volver
        </button>
      </div>
    );
  }
  const suya = rarezaDe(doy);
  const [minimo, maximo] = (partes(doy)[1] ? lonja.horquillaAcabado : lonja.horquilla)[suya] ?? [5, 20];
  const valor = Math.min(maximo, Math.max(minimo, precio ?? minimo));
  const claseVale = clase && vecinas(suya).includes(clase) ? clase : suya;
  const pidoVale = pido && pido !== partes(doy)[0] && vecinas(suya).includes(rarezaDe(pido)) ? pido : '';
  const recibes = lonja.sinComision > 0 ? valor : valor - Math.ceil(valor * COMISION);
  const listo = modo !== 'mueble' || pidoVale;
  return (
    <div className="lj-albaran">
      <fieldset className="gh-lonja__set">
        <legend>Doy</legend>
        <Elegir ids={ids} valor={doy} onElegir={setDoy} />
        <p className="gh-lonja__txt">
          {nombre(doy)} · {RAREZA_NOMBRE[suya]}
        </p>
      </fieldset>
      <fieldset className="gh-lonja__set">
        <legend>Busco</legend>
        <div className="gh-lonja__modo">
          <button type="button" aria-pressed={modo === 'tickets'} disabled={topeCobro} onClick={() => setModo('tickets')}>
            Tickets
          </button>
          <button type="button" aria-pressed={modo === 'mueble'} onClick={() => setModo('mueble')}>
            Un mueble
          </button>
          <button type="button" aria-pressed={modo === 'clase'} onClick={() => setModo('clase')}>
            Lo que sea
          </button>
        </div>
        {modo === 'tickets' && (
          <>
            <div className="gh-lonja__precio">
              <button type="button" aria-label="Menos tickets" disabled={valor <= minimo} onClick={() => setPrecio(Math.max(minimo, valor - PASO))}>
                −
              </button>
              <output aria-live="polite">{valor} tickets</output>
              <button type="button" aria-label="Más tickets" disabled={valor >= maximo} onClick={() => setPrecio(Math.min(maximo, valor + PASO))}>
                +
              </button>
            </div>
            <p className="gh-lonja__txt gh-lonja__cuenta">{lonja.sinComision > 0 ? `Recibirás ${recibes}: esta venta va sin comisión.` : `Recibirás ${recibes}: el 10 % se queda en la Lonja.`}</p>
          </>
        )}
        {modo === 'mueble' && (
          <label className="gh-lonja__lista">
            <span className="px-sr">Qué mueble buscas</span>
            <select value={pidoVale} onChange={(e) => setPido(e.target.value)}>
              <option value="">Elige un mueble</option>
              {pedibles(suya)
                .filter((c) => c.id !== doy)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({RAREZA_NOMBRE[rarezaOf(c)]})
                  </option>
                ))}
            </select>
          </label>
        )}
        {modo === 'clase' && (
          <div className="gh-lonja__modo">
            {vecinas(suya).map((r) => (
              <button key={r} type="button" aria-pressed={r === claseVale} onClick={() => setClase(r)}>
                {RAREZA_NOMBRE[r]}
              </button>
            ))}
          </div>
        )}
      </fieldset>
      <div className="lj-acciones">
        <button
          type="button"
          className="lj-btn is-sello"
          disabled={busy || !listo}
          onClick={() => onPoner(partes(doy)[0], modo === 'mueble' ? pidoVale : null, modo === 'tickets' ? valor : null, modo === 'clase' ? claseVale : null, partes(doy)[1] ?? null)}
        >
          Poner en el puesto
        </button>
      </div>
      <button type="button" className="lj-link" onClick={onCancelar}>
        Ahora no
      </button>
    </div>
  );
}

const diasQuedan = (o) => (o.creada ? Math.max(1, 7 - Math.floor((Date.now() - new Date(o.creada).getTime()) / 86400000)) : 7);

function Reglas({ lonja }) {
  return (
    <details className="lj-plegable">
      <summary>Cómo funciona la Lonja</summary>
      <ul className="gh-lonja__reglas">
        <li>El precio lo pones tú, dentro de lo que vale su rareza: común 5-20, poco común 10-40 y raro 20-60 tickets.</li>
        <li>El 10 % de cada venta se queda en la Lonja. Puedes cobrar hasta {lonja.cobro.tope} tickets a la semana.</li>
        <li>Un mueble se cambia por otro de su rareza o de la de al lado.</li>
        <li>Lo que te llega aquí no se puede volver a ofrecer en 3 días: en tu piso, úsalo cuando quieras.</li>
        <li>Con la misma persona, un cambio por semana. Tú, hasta 3 cambios al día.</li>
        <li>Las ofertas duran 7 días y luego el mueble vuelve a ti.</li>
        <li>No entran sagas, místicos, premios ni mascotas.</li>
      </ul>
    </details>
  );
}

export function Lonja({ onStreet, onInventory = () => {}, soundOn = false }) {
  const [lonja, setLonja] = useState(null);
  const [fallo, setFallo] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [modo, setModo] = useState('puestos');
  const [pasillo, setPasillo] = useState(0);
  const [elegido, setElegido] = useState(null);
  const [soloPuedo, setSoloPuedo] = useState(false);
  const [poniendo, setPoniendo] = useState(false);
  const [libro, setLibro] = useState(false);
  const [ofrecer, setOfrecer] = useState(null);
  const [seguro, setSeguro] = useState(null);
  const [pago, setPago] = useState(null);
  const [dicho, setDicho] = useState(-1);
  const [sfx] = useState(() => createShopSfx({ muted: !soundOn }));
  const root = useRef(null);
  const aviso = useRef(null);
  const trato = useRef(null);
  const ticketsVistos = useCountUp(lonja?.tickets ?? 0);
  const sellosVistos = useCountUp(lonja?.sellos ?? 0);

  useEffect(() => sfx.setMuted(!soundOn), [sfx, soundOn]);
  useEffect(() => () => sfx.destroy(), [sfx]);
  useEffect(() => {
    root.current?.scrollIntoView({ block: 'start' });
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onStreet();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onStreet]);
  useEffect(() => {
    let alive = true;
    cargarLonja().then(
      (l) => alive && setLonja(l),
      (e) => alive && setFallo(e.message),
    );
    return () => {
      alive = false;
    };
  }, []);
  // El aviso va arriba del panel y la lista puede ser larga: que no se quede fuera de la vista
  useEffect(() => {
    if (msg) aviso.current?.scrollIntoView({ block: 'center' });
  }, [msg]);

  // El trato se abre debajo de la oferta: que «Confirmar» no se quede bajo el borde de la pantalla
  useEffect(() => {
    if (seguro) trato.current?.scrollIntoView({ block: 'nearest' });
  }, [seguro]);

  // Cada jugada devuelve la Lonja nueva; el inventario del edificio se pide después, para que el piso no se quede atrás
  const jugar = async (accion, hecho, sonido = 'tap') => {
    setBusy(true);
    setMsg('');
    try {
      const nueva = await accion();
      setLonja(nueva);
      setMsg(hecho);
      setPoniendo(false);
      setSeguro(null);
      setPago(null);
      sfx.play(typeof sonido === 'function' ? sonido(nueva) : sonido);
      loadInventario().then(onInventory, () => {});
      setBusy(false);
      return true;
    } catch (e) {
      setMsg(e.message);
      setSeguro(null);
      cargarLonja().then(setLonja, () => {});
    }
    setBusy(false);
    return false;
  };

  const pagables = (o) => Object.keys(lonja.libres).filter((id) => rarezaDe(id) === o.busca_rareza);
  const pega = (o) => {
    if (lonja.nueva) return 'Aún solo miras';
    if (o.pareja) return 'Ya cambiasteis esta semana';
    if (lonja.cambios.hechos >= lonja.cambios.tope) return 'Hoy ya no';
    if (o.busca_tickets) return lonja.tickets >= o.busca_tickets ? null : 'Te faltan tickets';
    if (o.busca_rareza) return pagables(o).length ? null : 'No tienes con qué';
    return lonja.libres[o.busca_mueble] > 0 ? null : 'No lo tienes libre';
  };

  const todos = useMemo(() => agruparPuestos(lonja?.puestos ?? []), [lonja]);
  const pasillos = Math.max(1, Math.ceil(todos.length / PUESTOS_POR_PASILLO));
  const enPasillo = Math.min(pasillo, pasillos - 1);
  const aqui = useMemo(() => todos.slice(enPasillo * PUESTOS_POR_PASILLO, (enPasillo + 1) * PUESTOS_POR_PASILLO), [todos, enPasillo]);
  const room = useMemo(
    () =>
      renderLonja({
        puestos: aqui.map((p) => ({ personaje: p.personaje, tono: p.tono, color: p.color, muebles: p.ofertas.map((o) => o.da) })),
        personaje: lonja?.personaje ?? DEFAULT_AVATAR,
        toldo: TOLDOS_ESPECIALES[lonja?.toldo]?.color ?? null,
        ofertas: (lonja?.mias ?? []).map((o) => o.da),
        hechos: lonja?.cambios.hechos ?? 0,
        tope: lonja?.cambios.tope ?? 3,
        libres: lonja?.libres ?? {},
      }),
    [aqui, lonja],
  );
  const indiceElegido = aqui.findIndex((p) => p.dueno === elegido);
  const visibles = (indiceElegido >= 0 ? [aqui[indiceElegido]] : aqui).flatMap((p) => p.ofertas.map((o) => ({ ...o, alias: p.alias })));
  const lista = soloPuedo && lonja ? visibles.filter((o) => !pega(o)) : visibles;

  const cambiar = (m) => {
    sfx.play('tap');
    setModo(m);
    setMsg('');
    setSeguro(null);
    setPago(null);
    if (m !== 'mio') setPoniendo(false);
  };
  const tocar = (que) => {
    if (que === 'remedios') {
      if (modo === 'estiba') setDicho((d) => d + 1);
      cambiar('estiba');
    } else if (que === 'puesto') cambiar('mio');
    else if (que === 'libro') {
      cambiar('mio');
      setLibro(true);
    } else {
      const dueno = aqui[Number(que.slice(1))]?.dueno ?? null;
      cambiar('puestos');
      setElegido(dueno === elegido ? null : dueno);
    }
  };
  const encendido = modo === 'estiba' ? 'remedios' : modo === 'mio' ? 'puesto' : indiceElegido >= 0 ? `p${indiceElegido}` : null;
  const frase = () => {
    if (dicho >= 0) return DICHOS[dicho % DICHOS.length];
    if (lonja.nueva) return 'Bienvenida la gente nueva: los tres primeros días, a mirar.';
    if (lonja.cambios.hechos >= lonja.cambios.tope) return 'Por hoy ya has hecho tus cambios. Mañana más.';
    if (!todos.length) return 'Hoy está esto tranquilo. Mirar es gratis.';
    return todos.length === 1 ? 'Hoy hay un puesto abierto. Mirar es gratis.' : `Hoy hay ${todos.length} puestos abiertos. Mirar es gratis.`;
  };
  const huecos = lonja ? Array.from({ length: lonja.topeOfertas }, (_, k) => lonja.mias[k] ?? null) : [];
  const estibaPendiente = lonja && !lonja.estiba.hecha;
  const placaPendiente = lonja?.talleres.some((t) => !t.recogido && !t.faltan.length);
  /** Por qué te interesa esa oferta: lo marcaste en el tablón o te falta para un taller. */
  const teInteresa = (id) => {
    if (lonja.buscas.includes(id)) return 'Lo buscas';
    const taller = tallerDe(id);
    return taller && lonja.talleres.find((t) => t.id === taller.id)?.faltan.includes(id) ? `Te falta · ${taller.nombre}` : null;
  };

  return (
    <section className="gh-casino gh-lonja" ref={root} aria-labelledby="gh-lonja-title" data-escape-local="open">
      <h3 className="px-sr" id="gh-lonja-title">
        La Lonja
      </h3>
      <div className="gh-casino__scene gh-lonja__escena" style={{ aspectRatio: `${LONJA_W} / ${LONJA_H}`, '--lonja-ratio': LONJA_W / LONJA_H }}>
        <img
          className="gh-casino__art"
          src={room.scene}
          alt="La Lonja de noche, vista entera en corte. Abajo, la nave de ladrillo con baldosas a cuadros: cada puesto con su toldo a rayas, quien lo atiende y sus muebles en el mostrador, la mesa de Remedios con su balanza y su campana, y un gato sobre unas cajas. Una escalera sube al altillo de tablas: tu puesto, tu almacén de cajas, una pizarra con los cambios del día y un atril con el libro de cuentas."
          draggable="false"
        />
        {encendido && room.outlines[encendido] && <img className="gh-casino__outline" src={room.outlines[encendido]} alt="" aria-hidden="true" draggable="false" />}
        <Toque hit={room.hit} onToque={tocar} />
        {aqui.map((p, i) => (
          <button key={p.dueno} type="button" className="gh-lonja__zona is-nave" style={zona(room.spots[`p${i}`])} aria-pressed={p.dueno === elegido} aria-label={`Puesto de ${p.alias}`} onClick={() => tocar(`p${i}`)}>
            <span className="gh-lonja__cartel">{p.alias}</span>
          </button>
        ))}
        <button type="button" className="gh-lonja__zona" style={zona(room.spots.remedios)} aria-label="Ir a la estiba" onClick={() => tocar('remedios')}>
          <span className="gh-lonja__cartel">Remedios</span>
        </button>
      </div>

      <div className="lj-panel">
        {fallo ? (
          <p className="lj-nota">La Lonja está cerrada ahora mismo. {fallo}</p>
        ) : !lonja ? (
          <p className="lj-nota">Abriendo los puestos…</p>
        ) : (
          <>
            <div className="lj-toldo" role="group" aria-label="Qué hacer en la Lonja">
              <button type="button" aria-pressed={modo === 'puestos'} onClick={() => cambiar('puestos')}>
                <span>Los puestos</span>
              </button>
              <button type="button" aria-pressed={modo === 'mio'} onClick={() => cambiar('mio')}>
                <span>Tu puesto</span>
              </button>
              <button type="button" aria-pressed={modo === 'estiba'} onClick={() => cambiar('estiba')}>
                <span>La estiba</span>
                {estibaPendiente && modo !== 'estiba' && <i className="lj-toldo__aviso" role="img" aria-label="Hoy tienes un barco por cargar" />}
              </button>
              <button type="button" aria-pressed={modo === 'tablon'} onClick={() => cambiar('tablon')}>
                <span>El tablón</span>
                {placaPendiente && modo !== 'tablon' && <i className="lj-toldo__aviso" role="img" aria-label="Tienes una placa por recoger" />}
              </button>
            </div>

            <div className="lj-pizarra">
              <p>
                <PixelNum value={ticketsVistos} label={`${lonja.tickets} tickets`} />
                <span aria-hidden="true">tickets</span>
              </p>
              <p>
                <PixelNum value={sellosVistos} label={`${lonja.sellos} sellos`} />
                <span aria-hidden="true">sellos</span>
              </p>
              <div className="lj-pizarra__cuentas">
                <p>
                  Esta semana {Math.min(lonja.cobro.hecho, lonja.cobro.tope)} de {lonja.cobro.tope}
                </p>
                <span className="lj-pizarra__raya" role="progressbar" aria-label="Tickets cobrados esta semana" aria-valuemin={0} aria-valuemax={lonja.cobro.tope} aria-valuenow={Math.min(lonja.cobro.hecho, lonja.cobro.tope)}>
                  <span style={{ width: `${Math.min(100, (lonja.cobro.hecho / lonja.cobro.tope) * 100)}%` }} />
                </span>
                <ol className="lj-pizarra__palotes" aria-label={`Cambios de hoy: ${lonja.cambios.hechos} de ${lonja.cambios.tope}`}>
                  {Array.from({ length: lonja.cambios.tope }, (_, k) => (
                    <li key={k} className={k < lonja.cambios.hechos ? 'is-hecho' : ''} />
                  ))}
                  <li className="is-texto" aria-hidden="true">
                    cambios hoy
                  </li>
                </ol>
              </div>
            </div>

            {msg && (
              <p className="lj-aviso" role="status" ref={aviso}>
                {msg}
              </p>
            )}

            {modo === 'puestos' && (
              <>
                <p className="lj-dice" key={frase()}>
                  <img src={retrato()} alt="" draggable="false" />
                  <span>{frase()}</span>
                </p>
                {todos.length > 0 && (
                  <div className="gh-lonja__filtros">
                    <button type="button" aria-pressed={!elegido && !soloPuedo} onClick={() => (setElegido(null), setSoloPuedo(false))}>
                      Todo
                    </button>
                    <button type="button" aria-pressed={soloPuedo} onClick={() => setSoloPuedo((v) => !v)}>
                      Lo que puedo pagar
                    </button>
                    {pasillos > 1 && (
                      <button type="button" onClick={() => (setPasillo((enPasillo + 1) % pasillos), setElegido(null))}>
                        Pasillo {enPasillo + 1}/{pasillos}
                      </button>
                    )}
                  </div>
                )}
                {lista.length === 0 ? (
                  <p className="lj-nota">{todos.length ? 'Nada que puedas pagar en este pasillo.' : 'Cuando alguien abra su puesto, lo verás aquí.'}</p>
                ) : (
                  <ul className="gh-lonja__list" aria-label="Ofertas">
                    {lista.map((o) => {
                      const motivo = pega(o);
                      const abierta = seguro === o.id;
                      const pagos = o.busca_rareza ? pagables(o) : [];
                      return (
                        <li key={o.id} className={abierta ? 'is-abierta' : ''}>
                          <div className="gh-lonja__fila">
                            <Mueble id={daDe(o)} />
                            <p className="gh-lonja__oferta">
                              <b>{nombre(daDe(o))}</b>
                              <span>Por {busca(o)}</span>
                              <i>{o.alias}</i>
                              {teInteresa(o.da) && <em className="gh-lonja__interes">{teInteresa(o.da)}</em>}
                            </p>
                            {motivo ? (
                              <span className="gh-lonja__pega">{motivo}</span>
                            ) : (
                              !abierta && (
                                <button type="button" className="lj-btn is-chico" aria-label={`Cambiar: ${nombre(daDe(o))} de ${o.alias}`} onClick={() => setSeguro(o.id)}>
                                  Cambiar
                                </button>
                              )
                            )}
                          </div>
                          {abierta && (
                            <div className="gh-lonja__trato" ref={trato}>
                              {o.busca_rareza && (
                                <>
                                  <p className="gh-lonja__txt">¿Con cuál pagas?</p>
                                  <Elegir ids={pagos} valor={pago} onElegir={setPago} />
                                </>
                              )}
                              <p className="gh-lonja__txt">
                                Das {o.busca_rareza ? (pago ? nombre(pago) : 'un mueble') : busca(o)} y te llevas {nombre(daDe(o))}. No se puede deshacer, y no podrás ofrecerlo en 3 días.
                              </p>
                              <div className="lj-acciones">
                                <button
                                  type="button"
                                  className="lj-btn is-sello is-chico"
                                  disabled={busy || (o.busca_rareza && !pago)}
                                  onClick={() => jugar(() => aceptarLonja(o.id, pago), `Trato hecho: ${nombre(daDe(o))} ya es tuyo.`, 'chips')}
                                >
                                  Confirmar
                                </button>
                                <button type="button" className="lj-link" onClick={() => setSeguro(null)}>
                                  No
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}

            {modo === 'mio' && (
              <>
                {lonja.nueva && <p className="lj-nota">Las cuentas recién llegadas solo miran: podrás poner puesto a los tres días.</p>}
                <ol className="gh-lonja__huecos" aria-label="Tu puesto">
                  {huecos.map((o, k) =>
                    o ? (
                      <li key={o.id}>
                        <Mueble id={daDe(o)} />
                        <p className="gh-lonja__oferta">
                          <b>{nombre(daDe(o))}</b>
                          <span>Por {busca(o)}</span>
                          <i>Le quedan {diasQuedan(o)} días</i>
                        </p>
                        <button type="button" className="lj-link" disabled={busy} aria-label={`Retirar ${nombre(daDe(o))}`} onClick={() => jugar(() => retirarLonja(o.id), `${nombre(daDe(o))} vuelve a tu inventario.`)}>
                          Retirar
                        </button>
                      </li>
                    ) : (
                      <li key={`h${k}`} className="is-hueco">
                        <button type="button" disabled={lonja.nueva} aria-label="Ofrecer un mueble" onClick={() => setPoniendo(true)}>
                          + Ofrecer
                        </button>
                      </li>
                    ),
                  )}
                </ol>
                {poniendo && <Formulario key={ofrecer ?? 'nuevo'} lonja={lonja} busy={busy} inicial={ofrecer} onCancelar={() => setPoniendo(false)} onPoner={(doy, pido, precio, clase, acabado) => jugar(() => ponerLonja(doy, pido, precio, clase, acabado), 'Ya está en tu puesto.')} />}
                {lonja.retenidas > 0 && <p className="lj-nota">{lonja.retenidas === 1 ? 'Una copia recién llegada' : `${lonja.retenidas} copias recién llegadas`}: podrás ofrecerlas pasados tres días.</p>}
                <details className="lj-plegable" open={libro} onToggle={(e) => setLibro(e.currentTarget.open)}>
                  <summary>
                    El libro de cuentas <span>{lonja.cerradas.length}</span>
                  </summary>
                  {lonja.cerradas.length ? (
                    <ul className="gh-lonja__reglas" aria-label="Cambios recientes de tu puesto">
                      {lonja.cerradas.map((o) => (
                        <li key={o.id}>
                          {nombre(daDe(o))} por {o.pagado ? nombre(o.pagado) : `${o.neto ?? o.busca_tickets} tickets`}.
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="lj-nota">Sin apuntes de los últimos tres días.</p>
                  )}
                </details>
                <Reglas lonja={lonja} />
              </>
            )}

            {modo === 'tablon' && (
              <LonjaTablon
                lonja={lonja}
                busy={busy}
                cara={retrato()}
                onBuscar={(id, quiere) => jugar(() => buscarLonja(id, quiere), '', 'tap')}
                onRecoger={(id) => jugar(() => recogerTaller(id), 'Placa recogida: la tienes en tu inventario para colgarla en tu piso.', 'stamp')}
                onOfrecer={(id) => {
                  setOfrecer(id);
                  cambiar('mio');
                  setPoniendo(true);
                }}
              />
            )}

            {modo === 'estiba' && (
              <LonjaEstiba
                lonja={lonja}
                busy={busy}
                cara={retrato()}
                sfx={sfx}
                onZarpar={(carga) => jugar(() => zarparEstiba(carga), '', null)}
                onCanjear={(que) => jugar(() => canjearLonja(que), '', 'chips')}
                onToldo={(cual) => jugar(() => toldoLonja(cual), 'Toldo cambiado.')}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
