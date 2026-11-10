// La caja del Almacén del Puerto (1.99, §99): los artículos del carrito, el descuento del día («Sella el albarán», opcional)
// y el total antes de confirmar. Lo que se cobra lo calcula el servidor; aquí solo se enseña y se pide.
import { useEffect, useRef, useState } from 'react';
import { ticketsText } from '../economy';
import { DESCUENTOS, MARCAS, PASOS, TOLERANCIA, acierta, duracion, marcaDe, planoEn, posicion, pctDe } from './albaran';
import { sonar } from './albaranSfx';

/** «Mañana a las 0:00» (o la fecha, si fuera otra): cuándo vuelve el albarán, según el servidor. */
export function vuelveTexto(vuelve) {
  if (!vuelve) return '';
  const d = new Date(vuelve);
  const hoy = new Date();
  const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  const hora = d.toLocaleTimeString('es-ES', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const mismoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (mismoDia(d, manana)) return `mañana a las ${hora}`;
  if (mismoDia(d, hoy)) return `hoy a las ${hora}`;
  return `el ${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} a las ${hora}`;
}

/**
 * El minijuego: tres planos pasan por la cinta del mostrador y se sellan cuando su casilla está bajo el sello. `sello`:
 * { modo, empezado, marcas } del servidor; `offset`: hora del servidor menos la de aquí. Con `soloMirar`, se ve la partida
 * de quien te acompaña sin poder tocarla. `piezas`: los muebles del carrito, que salen dibujados en los planos;
 * `dibujo(id)`: su miniatura. Se sella con el botón, tocando la cinta o con la barra espaciadora.
 * Lo que se enseña es lo que ha pasado: la tinta cae donde estaba el plano al bajar el sello (sin falsos «casi»).
 * Con `escena` (la API del almacén en 3D), la cinta, el sello y los planos están en el mostrador de verdad y aquí solo
 * quedan el botón y la marcha del albarán; `onFin` avisa un momento después de cerrarse, para volver a la caja.
 */
export function SellaAlbaran({ sello, offset = 0, onSellar = () => {}, soloMirar = false, quien = '', piezas = [], dibujo = null, soundOn = false, escena = null, onFin = null }) {
  const ahora = () => Date.now() + offset - sello.empezado;
  const [t, setT] = useState(ahora);
  const [locales, setLocales] = useState([null, null, null]);
  // Dónde cayó la tinta en cada plano: la posición del plano al bajar el sello (fracción del recorrido)
  const [golpes, setGolpes] = useState([null, null, null]);
  const [baja, setBaja] = useState(0);
  const [pop, setPop] = useState(null);
  const enviados = useRef(new Set());
  const boton = useRef(null);
  const raiz = useRef(null);
  const visto = useRef(-1);
  const fin = duracion(sello.modo);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = Date.now() + offset - sello.empezado;
      setT(now);
      if (now < fin + 300) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [sello.empezado, sello.modo, offset, fin]);
  useEffect(() => {
    if (soloMirar) return;
    raiz.current?.scrollIntoView({ block: 'nearest' });
    boton.current?.focus({ preventScroll: true });
  }, [soloMirar]);
  const marcas = [0, 1, 2].map((j) => (sello.marcas?.[j] === true || sello.marcas?.[j] === false ? sello.marcas[j] : locales[j]));
  const k = planoEn(sello.modo, t);
  const pos = k >= 0 && k < 3 ? posicion(sello.modo, k, t) : null;
  // Un plano que pasa sin sellar cuenta como fallado (se avisa al servidor una vez)
  useEffect(() => {
    if (soloMirar) return;
    for (let j = 0; j < Math.min(k, 3); j += 1) {
      if (marcas[j] == null && !enviados.current.has(j)) {
        enviados.current.add(j);
        setLocales((l) => l.map((v, i) => (i === j ? false : v)));
        setPop({ n: j, texto: 'Se fue sin sellar', tipo: 'fuera' });
        onSellar(j, false);
      }
    }
  });
  // Cada plano nuevo entra con un roce de papel
  useEffect(() => {
    if (k >= 0 && k < 3 && visto.current !== k) {
      visto.current = k;
      sonar('entra', soundOn && !soloMirar);
    }
  }, [k, soundOn, soloMirar]);
  const acabado = t >= fin || marcas.every((m) => m != null);
  const marca = k >= 0 && k < 3 ? marcaDe(sello.modo, k) : MARCAS[0];
  const lista = marcas.filter((m) => m === true).length;
  // Al cerrarse, el albarán suena según los sellos
  const cerrado = useRef(false);
  useEffect(() => {
    if (acabado && !cerrado.current) {
      cerrado.current = true;
      sonar('final', soundOn && !soloMirar, lista);
    }
  }, [acabado, soundOn, soloMirar, lista]);

  const sellar = () => {
    const tNow = ahora();
    const kNow = planoEn(sello.modo, tNow);
    if (soloMirar || kNow < 0 || kNow > 2 || marcas[kNow] != null || enviados.current.has(kNow)) return;
    const pNow = posicion(sello.modo, kNow, tNow);
    const hit = acierta(sello.modo, kNow, pNow);
    const clavado = hit && (sello.modo === 'sinprisa' || Math.abs(pNow - MARCAS[kNow]) <= TOLERANCIA / 3);
    enviados.current.add(kNow);
    setBaja((n) => n + 1);
    setGolpes((g) => g.map((v, i) => (i === kNow ? pNow : v)));
    setLocales((l) => l.map((v, i) => (i === kNow ? hit : v)));
    setPop({
      n: kNow,
      texto: clavado ? '¡Clavado!' : hit ? '¡Sellado!' : 'Fuera de la casilla',
      tipo: clavado ? 'clavado' : hit ? 'sellado' : 'fuera',
    });
    sonar('golpe', soundOn);
    sonar(clavado ? 'clavado' : hit ? 'sellado' : 'fuera', soundOn);
    onSellar(kNow, hit);
  };
  // En la escena: cada fotograma mueve los planos y el sello del mostrador; tocar la escena sella
  const sellarRef = useRef(sellar);
  useEffect(() => {
    sellarRef.current = sellar;
  });
  useEffect(() => {
    if (!escena || soloMirar) return undefined;
    escena.juego(() => sellarRef.current());
    return () => escena.juego(null);
  }, [escena, soloMirar]);
  useEffect(() => {
    if (!escena) return;
    escena.albaran({ k: acabado ? -1 : k, pos: acabado ? null : pos, marca, tinta: k >= 0 && k < 3 ? golpes[k] : null, sellado: k >= 0 && k < 3 ? marcas[k] : null, baja });
  });
  // Al cerrarse, un momento para ver el descuento estampado y se vuelve a la caja
  useEffect(() => {
    if (!acabado || !onFin) return undefined;
    const id = setTimeout(onFin, 2200);
    return () => clearTimeout(id);
  }, [acabado, onFin]);

  const pieza = (j) => (piezas.length ? piezas[j % piezas.length] : null);
  const dice = soloMirar
    ? acabado
      ? `${quien} ha sellado ${lista} de 3.`
      : `${quien} está sellando su albarán…`
    : acabado
      ? `Albarán cerrado: ${lista} de 3 sellados, ${pctDe(marcas)} % de descuento para una compra de hoy.`
      : k < 0
        ? 'Prepárate: llega el primer plano…'
        : sello.modo === 'sinprisa'
          ? 'El plano avanza a saltos. Sella cuando su casilla quede bajo el sello.'
          : lista === 2 && k === 2
            ? 'Dos de dos. El último, con calma.'
            : 'Sella cuando la casilla del plano pase bajo el sello.';
  // Dónde está la tinta: se mueve con el plano desde donde cayó
  const tinta = k >= 0 && k < 3 && pos != null && golpes[k] != null ? marca + (pos - golpes[k]) : null;
  const cinta = sello.modo === 'sinprisa' ? Math.floor(Math.max(0, t) / 1000) * 12 : Math.max(0, t) * 0.07;

  return (
    <div
      ref={raiz}
      className={escena ? 'alb alb--escena' : 'alb'}
      data-modo={sello.modo}
      data-acabado={acabado || undefined}
      data-mirando={soloMirar || undefined}
      data-k={k}
      data-pos={pos == null || acabado ? undefined : pos.toFixed(4)}
      data-marca={marca.toFixed(4)}
      data-sellado={k >= 0 && k < 3 && marcas[k] != null ? String(marcas[k]) : undefined}
    >
      <p className="alb__dice" aria-live="polite">
        {dice}
      </p>
      {escena && pop && pop.n === k && !acabado && (
        <p key={`${pop.n}:${pop.texto}`} className="alb__pop alb__pop--escena" data-tipo={pop.tipo}>
          {pop.texto}
        </p>
      )}
      {escena && acabado && (
        <p className="alb__cierre alb__cierre--escena" data-n={lista}>
          −{pctDe(marcas)} %
        </p>
      )}
      {!escena && (
        <div
          className="alb__mesa"
          aria-hidden="true"
          style={{ '--cinta': `${-cinta % 24}px` }}
          onPointerDown={(e) => {
            if (e.button === 0) sellar();
          }}
        >
          <div className="alb__cinta" />
          <div className="alb__pista">
            {sello.modo === 'sinprisa' && (
              <div className="alb__pasos">
                {Array.from({ length: PASOS }, (_, i) => (
                  <span key={i} style={{ left: `${(i / (PASOS - 1)) * 100}%` }} />
                ))}
              </div>
            )}
            <span className="alb__marca" style={{ left: `${marca * 100}%` }} />
            {pos != null && !acabado && (
              <span className="alb__plano" data-sellado={marcas[k] == null ? undefined : String(marcas[k])} style={{ left: `${pos * 100}%` }}>
                <span className="alb__plano-dibujo">{pieza(k) && dibujo ? <img src={dibujo(pieza(k))} alt="" width="30" height="30" /> : <i />}</span>
                <span className="alb__casilla" />
              </span>
            )}
            {tinta != null && !acabado && <span className="alb__tinta" data-ok={String(marcas[k] === true)} style={{ left: `${tinta * 100}%` }} />}
            {soloMirar && pos != null && !acabado && marcas[k] === true && <span className="alb__tinta" data-ok="true" style={{ left: `${pos * 100}%` }} />}
            <span className="alb__sello" style={{ left: `${marca * 100}%` }}>
              <span key={baja} className="alb__sello-cuerpo" data-baja={baja > 0 || undefined} />
            </span>
            {pop && pop.n === k && !acabado && (
              <span key={`${pop.n}:${pop.texto}`} className="alb__pop" data-tipo={pop.tipo} style={{ left: `${marca * 100}%` }}>
                {pop.texto}
              </span>
            )}
          </div>
          {acabado && (
            <span className="alb__cierre" data-n={lista}>
              −{pctDe(marcas)} %
            </span>
          )}
        </div>
      )}
      <ol className="alb__marcas" aria-label="Planos sellados">
        {marcas.map((m, j) => (
          <li key={j} data-m={m == null ? 'nada' : String(m)} data-ahora={j === k && !acabado ? '' : undefined}>
            <span className="alb__mini" aria-hidden="true">
              {pieza(j) && dibujo ? <img src={dibujo(pieza(j))} alt="" width="18" height="18" /> : null}
              {m === true && <b>OK</b>}
            </span>
            <span className="alb__mini-texto">{m == null ? `Plano ${j + 1}: por sellar` : m ? `Plano ${j + 1}: sellado` : `Plano ${j + 1}: fallado`}</span>
          </li>
        ))}
      </ol>
      {!soloMirar && !acabado && (
        <button type="button" ref={boton} className="alb__sellar" onClick={sellar} disabled={pos == null || marcas[k] != null}>
          ¡Sellar!
        </button>
      )}
    </div>
  );
}

/** El albarán ya sellado (en la caja, mientras dura el día): los tres planos con su sello y el descuento estampado. */
export function AlbaranSellado({ marcas = [], pct = 0, recien = false }) {
  return (
    <div className="alb-hoja" data-recien={recien || undefined} aria-hidden="true">
      {[0, 1, 2].map((j) => (
        <span key={j} className="alb-hoja__plano" data-m={String(marcas[j] === true)} style={{ '--i': j }}>
          {marcas[j] === true ? 'OK' : '—'}
        </span>
      ))}
      <b className="alb-hoja__pct" data-pct={pct}>
        {pct ? `−${pct} %` : '0 %'}
      </b>
    </div>
  );
}

/**
 * El papel de la caja. `lineas`: [{ id, nombre, n, precio }]; `estado`: lo del servidor (o null mientras carga);
 * `usar`/`onUsar`: gastar el descuento en esta compra. `fase`: 'lista' | 'pagando' | 'hecha'.
 */
export function Caja({
  lineas,
  estado,
  offset,
  cerrada,
  usar,
  onUsar,
  onEmpezar,
  onSellar,
  onComprar,
  fase,
  error,
  recibo,
  onSeguir,
  onCarrito,
  empezando,
  dibujo = null,
  soundOn = false,
  enEscena = false,
}) {
  // Si el albarán se ha jugado con la caja abierta, su resultado se estampa con animación al cerrarse
  const [jugado, setJugado] = useState(false);
  const [sinPrisa, setSinPrisa] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const subtotal = lineas.reduce((s, l) => s + l.precio * l.n, 0);
  const d = estado?.descuento ?? null;
  const pct = d?.estado === 'hecho' ? (d.pct ?? pctDe(d.marcas)) : 0;
  const aplica = usar && d?.estado === 'hecho';
  const rebaja = aplica ? Math.floor((subtotal * pct) / 100) : 0;
  const total = subtotal - rebaja;
  const tickets = estado?.tickets ?? null;
  const falta = tickets != null && total > tickets ? total - tickets : 0;
  const jugando = d?.estado === 'jugando';
  if (jugando && !jugado) setJugado(true);

  if (fase === 'hecha' && recibo) {
    return (
      <div className="alm-caja">
        <p className="alm-caja__cajero">—¡Hecho! Ya lo tienes todo en tu inventario. Lo colocas desde «Decorar», en tu piso.</p>
        <p className="alm-caja__pagado" aria-hidden="true">
          Pagado
        </p>
        <ul className="alm-ticket">
          {recibo.lineas.map((l) => (
            <li key={l.id}>
              <span>
                {l.nombre} × {l.n}
              </span>
              <span>{ticketsText(l.precio * l.n)}</span>
            </li>
          ))}
          {recibo.ahorro > 0 && (
            <li className="alm-ticket__rebaja">
              <span>Ofertas</span>
              <span>ahorras {ticketsText(recibo.ahorro)}</span>
            </li>
          )}
          {recibo.descuento > 0 && (
            <li className="alm-ticket__rebaja">
              <span>Albarán sellado ({recibo.pct} %)</span>
              <span>−{ticketsText(recibo.descuento)}</span>
            </li>
          )}
          <li className="alm-ticket__total">
            <span>Pagado</span>
            <span>{ticketsText(recibo.total)}</span>
          </li>
        </ul>
        {recibo.tickets != null && <p className="alm-nota">Te quedan {ticketsText(recibo.tickets)}.</p>}
        <button type="button" className="alm-btn alm-btn--primario" onClick={onSeguir}>
          Seguir mirando
        </button>
      </div>
    );
  }

  return (
    <div className="alm-caja" data-jugando={jugando || undefined}>
      <p className="alm-caja__cajero">{lineas.length ? '—Buenas. ¿Lo llevas todo? Te lo cobro aquí.' : '—Buenas. Cuando tengas algo en el carrito, te lo cobro aquí.'}</p>
      {cerrada && <p className="alm-aviso">La caja aún no está abierta en este servidor: falta preparar el almacén. El carrito se queda guardado.</p>}
      {lineas.length > 0 && (
        <ul className="alm-ticket" aria-label="Lo que compras">
          {lineas.map((l) => (
            <li key={l.id} data-oferta={l.oferta?.tipo}>
              <span>
                {l.nombre} × {l.n}
                {l.oferta && <small className="alm-ticket__oferta">oferta −{l.oferta.pct} %</small>}
              </span>
              <span>
                {l.oferta && <s>{l.base * l.n}</s>} {ticketsText(l.precio * l.n)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {lineas.length > 0 && (
        <button type="button" className="alm-enlace" onClick={onCarrito}>
          Cambiar cantidades o quitar algo
        </button>
      )}

      {/* El albarán del día: opcional, un intento al día */}
      {!cerrada && estado && (
        <section className="alm-albaran" aria-label="Sella el albarán">
          {d?.estado === 'libre' ? (
            <>
              {/* El resguardo grapado al ticket: una línea, el botón y lo demás plegado */}
              <div className="alm-albaran__fila">
                <div className="alm-albaran__texto">
                  <h5 data-n={(estado.dia ?? '').replaceAll('-', '').slice(2)}>Sella el albarán</h5>
                  <p className="alm-albaran__lema">
                    Hasta <b>−{DESCUENTOS[3]} %</b> en una compra de hoy
                  </p>
                </div>
                <button type="button" className="alm-btn alm-btn--sello" aria-label="Jugar el albarán" disabled={empezando} onClick={() => onEmpezar(sinPrisa ? 'sinprisa' : 'rapido')}>
                  {empezando ? '…' : 'Jugar'}
                </button>
              </div>
              <div className="alm-albaran__pie">
                <label className="alm-albaran__prisa">
                  <input type="checkbox" checked={sinPrisa} onChange={(e) => setSinPrisa(e.target.checked)} />
                  <span>Sin prisa</span>
                </label>
                <details className="alm-albaran__como">
                  <summary>¿Cómo va?</summary>
                  <p>
                    Opcional y una vez al día: sella tres planos en su marca. 1 sello, {DESCUENTOS[1]} %; 2, {DESCUENTOS[2]} %; 3, {DESCUENTOS[3]} %. Fallar no encarece nada. «Sin prisa»: el plano
                    avanza a saltos de un segundo, sin reflejos rápidos.
                  </p>
                </details>
              </div>
            </>
          ) : (
            <h5 data-n={(estado.dia ?? '').replaceAll('-', '').slice(2)}>Sella el albarán</h5>
          )}
          {jugando && !enEscena && <SellaAlbaran sello={d} offset={offset} onSellar={onSellar} piezas={lineas.map((l) => l.id)} dibujo={dibujo} soundOn={soundOn} />}
          {jugando && enEscena && <p className="alm-nota">Sellando en el mostrador…</p>}
          {d?.estado === 'hecho' && (
            <>
              <AlbaranSellado marcas={d.marcas} pct={pct} recien={jugado} />
              <p>
                Hoy: {d.aciertos ?? 0} de 3 sellados, <strong>{pct} %</strong>.
              </p>
              {pct > 0 && (
                <label className="alm-check">
                  <input type="checkbox" checked={usar} onChange={(e) => onUsar(e.target.checked)} />
                  <span>Usar el descuento en esta compra (vale para una sola)</span>
                </label>
              )}
            </>
          )}
          {d?.estado === 'usado' && <p>Ya usaste el descuento de hoy.</p>}
          {d?.estado !== 'libre' && estado.vuelve && <p className="alm-nota">El albarán vuelve {vuelveTexto(estado.vuelve)}.</p>}
        </section>
      )}

      {lineas.length > 0 && (
        <ul className="alm-ticket alm-ticket--cuenta" aria-label="La cuenta">
          <li>
            <span>Subtotal</span>
            <span>{ticketsText(subtotal)}</span>
          </li>
          {aplica && pct > 0 && (
            <li className="alm-ticket__rebaja">
              <span>Albarán sellado ({pct} %)</span>
              <span>−{ticketsText(rebaja)}</span>
            </li>
          )}
          <li className="alm-ticket__total">
            <span>Total</span>
            <span>{ticketsText(total)}</span>
          </li>
        </ul>
      )}
      {tickets != null && lineas.length > 0 && (
        <p className="alm-nota">{falta ? `Tienes ${ticketsText(tickets)}: te faltan ${ticketsText(falta)}.` : `Tienes ${ticketsText(tickets)}; te quedarán ${ticketsText(tickets - total)}.`}</p>
      )}
      {error && (
        <p className="alm-aviso" role="alert">
          {error}
        </p>
      )}
      {lineas.length > 0 && (
        <button type="button" className="alm-btn alm-btn--primario" disabled={cerrada || !estado || jugando || fase === 'pagando' || falta > 0} onClick={() => onComprar({ total, usar: aplica })}>
          {fase === 'pagando' ? 'Pagando…' : jugando ? 'Termina el albarán para pagar' : `Confirmar compra · ${ticketsText(total)}`}
        </button>
      )}
    </div>
  );
}
