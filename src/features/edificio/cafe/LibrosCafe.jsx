// El café-librería del bajo: libros en cajas (§121.3, idea de Francisco tomada del género de Tiny Bookshop: solo la mecánica,
// nunca su arte; cifras aprobadas el 12-11-2026, «Sí, esas cifras»). Dos hojas en el cuadro de abajo:
// · «La caja»: la caja de reparto abierta, con los lomos que han llegado, y la balda del café con sus 12 huecos. Se arrastra
//   un lomo de la caja a la balda (o se toca: va al primer hueco) y de la balda a la caja para devolverlo. Solo se recomienda
//   lo que está en la balda.
// · «Distribuidora»: lo que has leído desbloquea sus títulos; con granos se compran cajas de un género (5 ejemplares al azar
//   entre tus títulos de ese género) o de un título (3 ejemplares). Antes de pagar se ve qué puede traer. El azar y el cobro,
//   en el servidor.
// Más cozy (Francisco, 12-11-2026: «quiero un toque más cozy y acogedor con los libros»): cada lomo es distinto (tela, piel o
// rústica con su etiqueta; alto y grosor propios), la balda tiene luz de lámpara y una guirnalda, la caja trae papel de seda
// y la etiqueta de la distribuidora, Pilar comenta lo que pasa y suenan cartón, papel y madera, bajitos. Las reglas no cambian.
import { useEffect, useMemo, useRef, useState } from 'react';
import { colorDe } from './cafeMuebles';
import { CAJA_GENERO, CAJA_TITULO, enBalda, enCajas, generosDisponibles } from './cafeClientes';
import { colocarLibros, comprarCaja, errorCafe } from './cafeService';
import { crearSfxBarra } from './cafeSfx';
import { GRANO } from './cafeIconos';
import { PixelArt } from './PixelArt';

const rgb = (c) => `rgb(${c[0]} ${c[1]} ${c[2]})`;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Cuánto hay que mover el dedo para que un toque pase a ser un arrastre. */
const UMBRAL = 7;

/** El aire de cada libro, siempre el mismo para un título: encuadernación, alto y grosor. */
function aireDe(titulo = '') {
  let h = 7;
  for (const ch of String(titulo)) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return { forma: ['tela', 'piel', 'rustica'][h % 3], alto: 64 + ((h >> 3) % 5) * 2, ancho: 27 + ((h >> 7) % 4) * 2 };
}
/** Lo que dice Pilar mientras colocas (frases cerradas). */
function pilarDice({ enCaja, enBalda, libres, recien }) {
  if (enCaja && recien) return '«¡Huele a libro nuevo! Arrástralos a la balda, o tócalos, y los verán los clientes.»';
  if (enCaja && libres <= 0) return '«La balda está a rebosar. Si quieres cambiar alguno, toca uno de la balda y vuelve a la caja.»';
  if (enCaja) return '«Arrástralos a la balda, o tócalos. Solo recomendamos lo que está a la vista.»';
  if (enBalda && libres <= 0) return '«¡Qué bonita ha quedado la balda! Da gusto verla.»';
  if (enBalda) return '«Todo en su sitio. Si quieres devolver alguno a la caja, tócalo.»';
  return '«La balda está esperando sus libros. En la distribuidora tienes lo que has leído.»';
}
/** El título que cabe en el lomo: palabras enteras hasta donde quepan (según el alto del libro), sin cortar a medias.
    Si no cabe, se prueba sin el artículo del principio; si ni la primera palabra cabe, se acorta con «…». */
const ARTICULOS = /^(el|la|los|las|un|una|unos|unas|the|a|an)\s+/i;
function tituloLomo(titulo = '', alto = 64) {
  const max = Math.max(5, Math.floor((alto - 24) / 4.6));
  const limpio = String(titulo).replace(/\s+/g, ' ').trim();
  if (limpio.length <= max) return limpio;
  let base = limpio;
  if (ARTICULOS.test(base)) {
    base = base.replace(ARTICULOS, '');
    base = base.charAt(0).toUpperCase() + base.slice(1);
    if (base.length <= max) return base;
  }
  let out = '';
  for (const w of base.split(' ')) {
    const prueba = out ? `${out} ${w}` : w;
    if (prueba.length + 1 > max) break;
    out = prueba;
  }
  if (!out) out = base.slice(0, max - 1);
  return `${out.replace(/[\s,.:;-]+$/, '')}…`;
}
/** Los ejemplares, uno por lomo: los de la balda y los de la caja, cada uno con su clave y su título. */
function ejemplares(estado, donde) {
  const out = [];
  for (const b of estado?.libros ?? []) for (let k = 0; k < b[donde]; k += 1) out.push({ clave: b.clave, titulo: b.titulo, genero: b.genero, k });
  return out;
}

/** Un lomo de libro, de pie (en la balda) o tumbado (en la caja). Se toca o se arrastra. */
function Lomo({ libro, donde, onSoltar, onTocar, disabled, nuevo, asienta = false, retraso = 0 }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const arrastrado = useRef(false);
  const [fantasma, setFantasma] = useState(null);
  const down = (e) => {
    if (disabled || e.button > 0) return;
    arrastrado.current = false;
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, mueve: false };
    ref.current?.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.mueve && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < UMBRAL) return;
    d.mueve = true;
    setFantasma({ x: e.clientX, y: e.clientY });
  };
  const up = (e) => {
    const d = drag.current;
    drag.current = null;
    setFantasma(null);
    if (!d || d.id !== e.pointerId) return;
    if (!d.mueve) return;
    arrastrado.current = true;
    // Donde se suelta: la balda o la caja (si es la misma de la que salió, no pasa nada)
    const zona = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-zona]')?.dataset.zona;
    if (zona && zona !== donde) onSoltar(libro);
  };
  const color = rgb(colorDe(libro.titulo));
  const aire = aireDe(libro.titulo);
  const estilo = { '--cf3-lomo': color, '--cf3-alto': `${aire.alto}px`, '--cf3-ancho': `${aire.ancho}px` };
  const corto = tituloLomo(libro.titulo, aire.alto);
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`cf3-lomo cf3-lomo--${donde}`}
        data-nuevo={nuevo ? 'true' : undefined}
        data-asienta={asienta ? 'true' : undefined}
        data-forma={aire.forma}
        data-clave={libro.clave}
        style={{ ...estilo, '--cf3-retraso': `${retraso}ms` }}
        disabled={disabled}
        aria-label={donde === 'balda' ? `«${libro.titulo}», en la balda: devolverlo a la caja` : `«${libro.titulo}», en la caja: ponerlo en la balda`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => {
          drag.current = null;
          setFantasma(null);
        }}
        onClick={() => {
          // El clic que sigue a un arrastre ya se ha resuelto al soltar
          if (arrastrado.current) {
            arrastrado.current = false;
            return;
          }
          onTocar(libro);
        }}
      >
        <span className="cf3-lomo__titulo" aria-hidden="true">
          {corto}
        </span>
      </button>
      {fantasma && (
        <span className="cf3-lomo cf3-lomo--fantasma" data-forma={aire.forma} aria-hidden="true" style={{ ...estilo, left: fantasma.x, top: fantasma.y }}>
          <span className="cf3-lomo__titulo">{corto}</span>
        </span>
      )}
    </>
  );
}

export function LibrosCafe({ estado, titulos, granos, hoja: hojaInicial = 'caja', recien = [], soundOn = false, onCambio, onCerrar }) {
  const [hoja, setHoja] = useState(hojaInicial);
  // Con libros esperando, la caja se abre delante de ti (sus lomos saltan); con movimiento reducido, ya abierta
  const [abierta, setAbierta] = useState(() => reduced() || !(recien.length || enCajas(estado)));
  const [nuevos, setNuevos] = useState(() => (recien.length ? recien : ejemplares(estado, 'caja').map((x) => x.clave)));
  // El último que se ha puesto en la balda (para que se asiente con un pequeño balanceo)
  const [asentado, setAsentado] = useState(null);
  const [sfx] = useState(() => crearSfxBarra());
  useEffect(() => sfx.setActivo(soundOn), [sfx, soundOn]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [genero, setGenero] = useState(null);
  // Lo que se toca va al servidor en orden; mientras, la balda ya se ve cambiada
  const cola = useRef(Promise.resolve());
  // Lo movido que aún no ha contestado el servidor: vale mientras el estado de partida sea el mismo
  const [provisional, setProvisional] = useState(null);
  const vista = provisional?.de === estado ? provisional.vista : estado;
  const huecos = vista?.huecos ?? 12;
  const enLaBalda = ejemplares(vista, 'balda');
  const enLaCaja = ejemplares(vista, 'caja');
  const libres = huecos - enBalda(vista);
  const generos = useMemo(() => generosDisponibles(titulos), [titulos]);
  const elegido = generos.find((g) => g.id === genero) ?? generos[0] ?? null;

  // La caja que acaba de llegar se abre sola, con un respiro para ver cómo saltan las solapas
  useEffect(() => {
    if (abierta) return undefined;
    const t = setTimeout(() => {
      setAbierta(true);
      sfx.play('cajaAbre');
    }, 450);
    return () => clearTimeout(t);
  }, [abierta, sfx]);

  const mover = (clave, a) => {
    setError('');
    setProvisional((p) => {
      const v = p?.de === estado ? p.vista : estado;
      return {
        de: estado,
        vista: {
          ...v,
          libros: v.libros.map((b) => (b.clave !== clave ? b : a === 'balda' ? { ...b, caja: b.caja - 1, balda: b.balda + 1 } : { ...b, caja: b.caja + 1, balda: b.balda - 1 })),
        },
      };
    });
    cola.current = cola.current
      .then(() => colocarLibros(a === 'balda' ? [clave] : [], a === 'caja' ? [clave] : []))
      .then((r) => onCambio(r))
      .catch((e) => {
        setError(errorCafe(e));
        setProvisional(null);
      });
  };
  const aLaBalda = (libro) => {
    if (libres <= 0) return setError('La balda está llena: devuelve uno a la caja para hacer sitio.');
    setAsentado(libro.clave);
    sfx.play(libres === 1 ? 'baldaLlena' : 'libroPon');
    mover(libro.clave, 'balda');
  };
  const aLaCaja = (libro) => {
    sfx.play('libroQuita');
    mover(libro.clave, 'caja');
  };
  const colocarTodo = () => {
    const poner = enLaCaja.slice(0, libres).map((x) => x.clave);
    if (!poner.length) return;
    setError('');
    setOcupado(true);
    setAsentado(null);
    sfx.play(poner.length >= libres ? 'baldaLlena' : 'libroPon');
    cola.current = cola.current
      .then(() => colocarLibros(poner, []))
      .then((r) => onCambio(r))
      .catch((e) => setError(errorCafe(e)))
      .finally(() => setOcupado(false));
  };
  const comprar = async (pedido) => {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    try {
      await cola.current;
      const r = await comprarCaja(pedido, titulos);
      onCambio(r);
      sfx.play('campanilla');
      setNuevos(r.caja);
      setAbierta(reduced());
      setHoja('caja');
    } catch (e) {
      setError(errorCafe(e));
    } finally {
      setOcupado(false);
    }
  };

  // Los lomos que acaban de llegar saltan de la caja, uno detrás de otro (los primeros de cada título nuevo)
  const vistos = new Set();
  const esNuevo = (x) => {
    if (!nuevos.includes(x.clave) || vistos.has(`${x.clave}`)) return false;
    vistos.add(x.clave);
    return true;
  };

  return (
    <div className="cf3-balda cf3-libros" role="region" aria-label="Tus libros del café">
      <div className="cf3-balda__cabeza">
        <div className="cf3-balda__pestanas" role="tablist" aria-label="Tus libros">
          <button type="button" role="tab" aria-selected={hoja === 'caja'} className="cf3-pestana" onClick={() => setHoja('caja')}>
            La caja{enCajas(vista) > 0 ? ` · ${enCajas(vista)}` : ''}
          </button>
          <button type="button" role="tab" aria-selected={hoja === 'distribuidora'} className="cf3-pestana" onClick={() => setHoja('distribuidora')}>
            Distribuidora
          </button>
        </div>
        <div className="cf3-balda__herr">
          <button type="button" className="cf3-btn" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>

      {hoja === 'caja' ? (
        <>
          <section className="cf3-libros__balda" data-zona="balda" aria-label={`La balda: ${enBalda(vista)} de ${huecos}`}>
            <span className="cf3-libros__guirnalda" aria-hidden="true">
              {Array.from({ length: 9 }, (_, k) => (
                <span key={k} style={{ '--cf3-k': k }} />
              ))}
            </span>
            <h3 className="cf3-libros__titulo">
              La balda <span className="cf3-libros__cuenta">{`${enBalda(vista)} / ${huecos}`}</span>
            </h3>
            <ol className="cf3-libros__huecos" style={{ '--cf3-huecos': huecos }}>
              {Array.from({ length: huecos }, (_, k) => {
                const x = enLaBalda[k];
                // El último ejemplar de ese título es el que acaba de llegar
                const ultimo = x && x.clave === asentado && enLaBalda[k + 1]?.clave !== x.clave;
                return (
                  <li key={x ? `${x.clave}-${x.k}` : `hueco-${k}`} className="cf3-libros__hueco" data-lleno={x ? 'true' : undefined}>
                    {x && <Lomo libro={x} donde="balda" onSoltar={aLaCaja} onTocar={aLaCaja} disabled={ocupado} asienta={ultimo} />}
                  </li>
                );
              })}
            </ol>
          </section>
          {/* La caja de cartón en 3D (Francisco, 12-11-2026: «La quiero más 3d»): una caja expositora con el frente recortado, de
              caras en perspectiva (fondo, suelo, laterales y la solapa trasera de pie); los libros dentro, la cara delantera con
              su cinta, el papel de seda y la etiqueta, y su sombra en el suelo. Cerrada, las solapas tapan la boca y se abren girando. */}
          <section className="cf3-libros__caja" data-zona="caja" data-abierta={abierta ? 'true' : undefined} aria-label={`La caja de reparto: ${enLaCaja.length} ejemplares`}>
            <span className="cf3-carton__solido" aria-hidden="true">
              <span className="cf3-carton__cuerpo">
                <span className="cf3-carton__cara cf3-carton__cara--fondo" />
                <span className="cf3-carton__cara cf3-carton__cara--suelo" />
                <span className="cf3-carton__cara cf3-carton__cara--izq" />
                <span className="cf3-carton__cara cf3-carton__cara--der" />
                <span className="cf3-carton__solapa cf3-carton__solapa--fondo" />
                <span className="cf3-carton__solapa cf3-carton__solapa--frente" />
              </span>
            </span>
            <div className="cf3-carton__dentro">
              {enLaCaja.length ? (
                <ul className="cf3-libros__lomos">
                  {enLaCaja.map((x, i) => (
                    <li key={`${x.clave}-${x.k}`}>
                      <Lomo libro={x} donde="caja" onSoltar={aLaBalda} onTocar={aLaBalda} disabled={ocupado || !abierta} nuevo={abierta && esNuevo(x)} retraso={Math.min(i, 9) * 70} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="cf3-balda__vacio">
                  {enLaBalda.length ? 'La caja está vacía. En la distribuidora hay más.' : 'Aún no tienes libros que recomendar. Compra una caja en la distribuidora.'}
                </p>
              )}
            </div>
            <span className="cf3-carton__frente" aria-hidden="true">
              <span className="cf3-libros__etiqueta">
                <span>Distribuidora del Puerto</span>
                <span>Frágil · son libros ♥</span>
              </span>
            </span>
          </section>
          <p className="cf3-balda__ayuda cf3-libros__pilar">
            <span className="cf3-libros__quien">Pilar</span>
            {pilarDice({ enCaja: enLaCaja.length, enBalda: enLaBalda.length, libres, recien: enLaCaja.some((x) => nuevos.includes(x.clave)) && !enLaBalda.length })}
          </p>
          {enLaCaja.length > 0 && libres > 0 && (
            <div className="cf3-botones cf3-botones--fila">
              <button type="button" className="cf3-btn cf3-btn--verde" onClick={colocarTodo} disabled={ocupado || !abierta}>
                {enLaCaja.length <= libres ? 'Colocarlos todos' : `Llenar la balda (${libres})`}
              </button>
            </div>
          )}
        </>
      ) : (
        <section className="cf3-distri" aria-label="La distribuidora">
          <p className="cf3-distri__granos" aria-label={`Tienes ${granos} granos`}>
            <PixelArt icono={GRANO} />
            <span aria-hidden="true">{granos}</span>
            <span className="cf3-distri__nota">Lo que lees llega aquí: {titulos.length === 1 ? '1 título' : `${titulos.length} títulos`}.</span>
          </p>
          {elegido ? (
            <>
              <div className="cf3-distri__generos" role="radiogroup" aria-label="Géneros">
                {generos.map((g) => (
                  <button key={g.id} type="button" role="radio" aria-checked={elegido.id === g.id} className="cf3-nombre" onClick={() => setGenero(g.id)}>
                    {g.nombre}
                  </button>
                ))}
              </div>
              <div className="cf3-distri__oferta">
                <p className="cf3-distri__que">
                  Caja de {elegido.nombre.toLowerCase()}: {CAJA_GENERO.ejemplares} ejemplares al azar entre {elegido.titulos === 1 ? 'tu título' : `tus ${elegido.titulos} títulos`}.
                </p>
                <button type="button" className="cf3-btn cf3-btn--verde cf3-distri__comprar" disabled={ocupado || granos < CAJA_GENERO.precio} onClick={() => comprar({ genero: elegido.id })}>
                  {`${CAJA_GENERO.ejemplares} por ${CAJA_GENERO.precio}`}
                  <PixelArt icono={GRANO} />
                </button>
              </div>
              <ul className="cf3-distri__titulos" aria-label={`Títulos de ${elegido.nombre}: o una caja de un solo título`}>
                {titulos
                  .filter((t) => t.genero === elegido.id)
                  .map((t) => (
                    <li key={t.clave}>
                      <span className="cf3-distri__lomo" style={{ '--cf3-lomo': rgb(colorDe(t.titulo)) }} aria-hidden="true" />
                      <span className="cf3-distri__titulo">{t.titulo}</span>
                      <button
                        type="button"
                        className="cf3-btn cf3-btn--suave cf3-distri__uno"
                        aria-label={`${CAJA_TITULO.ejemplares} ejemplares de «${t.titulo}» por ${CAJA_TITULO.precio} granos`}
                        disabled={ocupado || granos < CAJA_TITULO.precio}
                        onClick={() => comprar({ clave: t.clave })}
                      >
                        {`${CAJA_TITULO.ejemplares} por ${CAJA_TITULO.precio}`}
                      </button>
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <p className="cf3-balda__vacio">Cuando leas un libro, la distribuidora te lo traerá para el café.</p>
          )}
        </section>
      )}
      {error && (
        <p className="cf3-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
