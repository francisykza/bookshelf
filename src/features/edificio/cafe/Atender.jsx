// El café-librería del bajo, bloque 3 (1.121), revisado el 12-11-2026 (Francisco: «el café pesa más, el libro es un extra»):
// atender a un cliente, en el cuadro de diálogo de abajo y en la escena.
// 1. Te pide la bebida en una comanda (clara; la del excéntrico, en acertijos), que se queda a la vista arriba.
// 2. «A la barra»: la cámara baja a la barra 3D; tocas la cafetera o la tetera, un tarro (suave o intenso) y, si lleva, la
//    leche y el toque (o los eliges abajo, uno a uno), y mantienes pulsado para llenar la taza (lo llenado no se pierde al
//    soltar; con movimiento reducido, un toque).
// 3. Se la llevas: la taza en la mano y vas andando hasta su mesa (tocándole o con «Llevársela»).
// 4. El libro, de extra: tres fichas de tu estantería con sus pistas (páginas, año, género), o «Solo el café».
// 5. Estrellas (de 1 a 3, según lo acertado; las pone el servidor con `cafe_servir`) y el repaso de qué acertaste.
import { useEffect, useMemo, useRef, useState } from 'react';
import { colorDe } from './cafeMuebles';
import { PARTES, PEDIDO_ACERTIJO, RESENAS, comandaAcertijo, comandaClara, librosParaRecomendar, nombreOpcion } from './cafeClientes';
import { retratoDe } from './cafeIconos';
import { errorCafe } from './cafeService';
import { PixelArt } from './PixelArt';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const rgb = (c) => `rgb(${c[0]} ${c[1]} ${c[2]})`;
const LLENAR_MS = 1000;
const VACIA = { bebida: null, grano: null, leche: 'sin', toque: 'nada' };
const CATEGORIAS = [
  [/science fiction|ciencia ficci/, 'Ciencia ficción'],
  [/fantas/, 'Fantasía'],
  [/myster|misterio|crime|crimen|thriller|polic|suspense|detective/, 'Misterio'],
  [/romanc|amor|love/, 'Amor'],
  [/classic|clásic/, 'Clásico'],
  [/poetry|poesía/, 'Poesía'],
  [/histor/, 'Historia'],
  [/biograph|biograf/, 'Biografía'],
  [/juvenile|young adult|juvenil/, 'Juvenil'],
  [/fiction|ficci|novel/, 'Novela'],
];
/** Las pistas de una ficha: género, páginas, año y si es de tus favoritos o el último que terminaste. */
function pistas(b, ctx) {
  const out = [];
  const cat = (b.categories ?? []).join(' ').toLowerCase();
  const genero = CATEGORIAS.find(([re]) => re.test(cat))?.[1];
  if (genero) out.push(genero);
  if (b.pageCount > 0) out.push(`${b.pageCount} págs.`);
  const anio = String(b.publishedDate ?? '').slice(0, 4);
  if (/^\d{4}$/.test(anio)) out.push(anio);
  if (b.favorite || b.rating >= 5) out.push('Favorito');
  if (ctx?.ultimo === b.id) out.push('Lo último que leíste');
  return out;
}

function Estrellas({ n }) {
  return (
    <span className="cf3-estrellas" role="img" aria-label={`${n} de 3 estrellas`}>
      {[1, 2, 3].map((k) => (
        <span key={k} className="cf3-estrella" data-llena={k <= n ? 'true' : undefined} aria-hidden="true" />
      ))}
    </span>
  );
}

export function Atender({ cliente, ctx, libros, escena, registrarToque, onServir, onCerrar }) {
  const [paso, setPaso] = useState('pide');
  const [receta, setReceta] = useState(VACIA);
  const [llenado, setLlenado] = useState(0);
  const [vertiendo, setVertiendo] = useState(false);
  const [libro, setLibro] = useState(null);
  const [dado, setDado] = useState(null);
  const [error, setError] = useState('');
  const raf = useRef(0);
  const llenadoRef = useRef(0);
  const raro = cliente.raro;
  const quien = cliente.habitual || raro ? cliente.nombre : 'Cliente';
  const fichas = useMemo(() => librosParaRecomendar(cliente.pedido, libros, ctx, cliente.semilla), [cliente.pedido, cliente.semilla, libros, ctx]);
  const lista = [receta.bebida, receta.grano, receta.leche, receta.toque];
  const lista_ = lista.join();
  const encaja = libro ? cliente.pedido.encaja(libro, ctx) : false;
  const enBarra = paso === 'barra';
  const lleva = paso === 'llevar' || paso === 'yendo' || paso === 'libro' || paso === 'sirviendo';

  // La escena sigue a la barra: entrar, lo elegido y la taza; al salir, la taza en la mano
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  useEffect(() => () => escena?.barra(false), [escena]);
  useEffect(() => {
    if (enBarra) escena?.barra(true);
  }, [enBarra, escena]);
  useEffect(() => {
    if (enBarra) escena?.setReceta(receta, { lleno: llenado, vertiendo });
  }, [enBarra, escena, receta, llenado, vertiendo]);

  const elegir = (parte, valor) => {
    // La leche y el toque se quitan al volver a tocarlos
    const v = (parte === 'leche' || parte === 'toque') && receta[parte] === valor ? (parte === 'leche' ? 'sin' : 'nada') : valor;
    if (receta[parte] === v) return;
    // Cambiar la receta con la taza empezada: taza nueva
    llenadoRef.current = 0;
    setLlenado(0);
    setReceta({ ...receta, [parte]: v });
  };
  const cambiar = (parte) => {
    const opciones = PARTES.find((p) => p.id === parte).opciones;
    const k = opciones.findIndex((o) => o.id === receta[parte]);
    elegir(parte, opciones[(k + 1) % opciones.length].id);
  };
  const llevar = async () => {
    if (!escena) return setPaso('libro');
    setPaso('yendo');
    await escena.irACliente(cliente.n);
    setPaso('libro');
  };
  const lista3d = useRef(null);
  useEffect(() => {
    lista3d.current = { paso, elegir, llevar };
  });
  // Los toques en la escena mientras atiendes: lo de la barra y el propio cliente cuando llevas su taza
  useEffect(() => {
    registrarToque?.((id) => {
      if (!lista3d.current) return false;
      const { paso: ahora, elegir: el, llevar: ll } = lista3d.current;
      if (ahora === 'barra' && id.startsWith('barra:')) {
        const [, parte, valor] = id.split(':');
        el(parte, valor);
        return true;
      }
      if (ahora === 'llevar' && id === `cliente:${cliente.n}`) {
        ll();
        return true;
      }
      return ahora !== 'pide' && ahora !== 'gracias';
    });
    return () => registrarToque?.(null);
  }, [registrarToque, cliente.n]);

  const listo = () => {
    cancelAnimationFrame(raf.current);
    setVertiendo(false);
    llenadoRef.current = 1;
    setLlenado(1);
    escena?.barra(false, { llevar: receta });
    setPaso('llevar');
  };
  // Verter: mientras se mantiene pulsado, la taza se llena; al soltar se queda como esté (y se sigue luego)
  const empezar = () => {
    if (paso !== 'barra' || !receta.bebida || !receta.grano) return;
    if (reduced()) return listo();
    cancelAnimationFrame(raf.current);
    setVertiendo(true);
    let antes = performance.now();
    const paso_ = (now) => {
      const v = Math.min(1, llenadoRef.current + (now - antes) / LLENAR_MS);
      antes = now;
      llenadoRef.current = v;
      setLlenado(v);
      if (v >= 1) listo();
      else raf.current = requestAnimationFrame(paso_);
    };
    raf.current = requestAnimationFrame(paso_);
  };
  const soltar = () => {
    cancelAnimationFrame(raf.current);
    setVertiendo(false);
  };
  const servir = async (b) => {
    setLibro(b);
    setPaso('sirviendo');
    setError('');
    try {
      const r = await onServir({ receta: lista, encaja: b ? cliente.pedido.encaja(b, ctx) : null, libro: b });
      escena?.llevar(null);
      setDado(r);
      setPaso('gracias');
    } catch (e) {
      setError(errorCafe(e));
      setPaso('libro');
    }
  };

  const retrato = <PixelArt icono={retratoDe(cliente.aspecto)} />;
  const pide = dado?.pide ?? cliente.pide;
  const comanda = !(paso === 'pide' || enBarra || paso === 'llevar' || paso === 'yendo') ? null : (
    <section
      className={`cf3-comanda${raro ? ' cf3-comanda--raro' : ''}`}
      aria-label={raro ? `La comanda de ${quien}, en acertijos` : `La comanda de ${quien}`}
      style={raro ? { '--cf3-tema': rgb(raro.tema) } : undefined}
    >
      <h3 className="cf3-comanda__titulo">{raro ? `★ ${quien}` : cliente.habitual ? `${quien}: lo de siempre` : 'Comanda'}</h3>
      {raro ? (
        <ul className="cf3-comanda__acertijos">
          {comandaAcertijo(cliente.pide).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ) : (
        <p className="cf3-comanda__linea">{comandaClara(cliente.pide)}</p>
      )}
    </section>
  );

  let texto;
  let botones;
  let extra = null;
  if (paso === 'pide') {
    texto = raro ? raro.saludo : cliente.habitual ? '«¡Hola otra vez! Lo de siempre, por favor.»' : '«¡Buenas! ¿Me pones esto? Lo tienes apuntado.»';
    botones = (
      <>
        <button type="button" className="cf3-btn cf3-btn--suave" onClick={onCerrar}>
          Luego
        </button>
        <button type="button" className="cf3-btn cf3-btn--verde" onClick={() => setPaso('barra')}>
          A la barra
        </button>
      </>
    );
  } else if (enBarra) {
    texto = 'Toca en la barra lo que lleva y mantén pulsada la cafetera para servir.';
    extra = (
      <div className="cf3-receta" role="group" aria-label="Lo que lleva la taza">
        {PARTES.map((p) => {
          const v = receta[p.id];
          return (
            <button
              key={p.id}
              type="button"
              className="cf3-receta__hueco"
              data-vacio={v ? undefined : 'true'}
              aria-label={`${p.nombre}: ${v ? nombreOpcion(p.id, v) : 'sin elegir'}. Cambiar`}
              onClick={() => cambiar(p.id)}
            >
              <span className="cf3-receta__parte">{p.nombre}</span>
              <span className="cf3-receta__valor">{v ? nombreOpcion(p.id, v) : '¿…?'}</span>
            </button>
          );
        })}
      </div>
    );
    botones = (
      <>
        <button
          type="button"
          className="cf3-btn cf3-btn--suave"
          onClick={() => {
            soltar();
            onCerrar();
          }}
        >
          Luego
        </button>
        <button
          key="verter"
          type="button"
          className="cf3-btn cf3-btn--verde cf3-cafetera"
          disabled={!receta.bebida || !receta.grano}
          onPointerDown={empezar}
          onPointerUp={soltar}
          onPointerLeave={soltar}
          onPointerCancel={soltar}
          onKeyDown={(e) => {
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
              e.preventDefault();
              empezar();
            }
          }}
          onKeyUp={soltar}
          aria-label={reduced() ? 'Servir' : 'Mantén pulsado para servir'}
        >
          {reduced() ? 'Servir' : llenado > 0 ? `Sigue pulsando · ${Math.round(llenado * 100)} %` : 'Mantén pulsado para servir'}
        </button>
      </>
    );
  } else if (paso === 'llevar' || paso === 'yendo') {
    texto =
      paso === 'yendo'
        ? `Con cuidado, que quema… Vas hacia ${raro || cliente.habitual ? quien : 'su mesa'}.`
        : `Lista. Llévasela${raro || cliente.habitual ? ` a ${quien}` : ''}: tócale en el local o pulsa «Llevársela».`;
    botones = (
      <button key="llevar" type="button" className="cf3-btn cf3-btn--verde" onClick={llevar} disabled={paso === 'yendo'}>
        Llevársela
      </button>
    );
  } else if (paso === 'libro' || paso === 'sirviendo') {
    texto = `«¡Qué buena pinta! ${raro ? (PEDIDO_ACERTIJO[cliente.pedido.id] ?? PEDIDO_ACERTIJO.libre) : cliente.pedido.frase}»`;
    extra = (
      <ul className="cf3-fichas" aria-label="Recomiéndale un libro (opcional)">
        {fichas.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              className="cf3-ficha"
              aria-label={`Recomendar «${b.title}»`}
              disabled={paso === 'sirviendo'}
              onClick={() => servir(b)}
              style={{ '--cf3-tapa': rgb(colorDe(b.title)) }}
            >
              <span className="cf3-ficha__tapa" aria-hidden="true">
                <span className="cf3-ficha__titulo">{b.title}</span>
              </span>
              <span className="cf3-ficha__autor">{b.author}</span>
              <span className="cf3-ficha__pistas">
                {pistas(b, ctx).map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
    botones = (
      <button key="solo" type="button" className="cf3-btn cf3-btn--suave" disabled={paso === 'sirviendo'} onClick={() => servir(null)}>
        Solo el café
      </button>
    );
  } else {
    const e = dado?.estrellas ?? 1;
    const resena = cliente.habitual && dado?.frase != null ? ` Te dejo una nota en la pizarra: “${RESENAS[dado.frase] ?? ''}”` : '';
    texto =
      raro && dado?.dorada
        ? `«${raro.dorada}» Te ha dejado una reseña dorada en la pizarra.`
        : e === 3
          ? `«¡Perfecto! Justo lo que quería.${resena}»`
          : e === 2
            ? `«Muy rico, aunque no era del todo lo que pedí.${resena}»`
            : `«No era lo que pedí… pero gracias igualmente.${resena}»`;
    extra = dado && (
      <div className="cf3-resultado">
        <Estrellas n={e} />
        <ul className="cf3-repaso" aria-label="Lo que acertaste">
          {PARTES.map((p, k) => {
            const ok = lista[k] === pide[k];
            return (
              <li key={p.id} data-ok={ok ? 'true' : 'false'}>
                {ok ? `✓ ${nombreOpcion(p.id, lista[k])}` : `✗ ${nombreOpcion(p.id, lista[k])} · pidió ${nombreOpcion(p.id, pide[k]).toLowerCase()}`}
              </li>
            );
          })}
          <li data-ok={libro ? (encaja ? 'true' : 'false') : 'nada'}>{libro ? (encaja ? '✓ El libro' : '✗ El libro no era') : '· Sin libro'}</li>
        </ul>
        <p className="cf3-dado" aria-label={`Has ganado ${dado.granos} granos y ${dado.reputacion} de reputación`}>
          <span className="cf3-dado__ficha">+{dado.granos} granos</span>
          <span className="cf3-dado__ficha cf3-dado__ficha--rep">+{dado.reputacion} reputación</span>
        </p>
      </div>
    );
    // Con su propia clave: si no, React reutilizaría otro botón y un toque a destiempo despediría al cliente
    botones = (
      <button key="hasta-luego" type="button" className="cf3-btn" onClick={onCerrar}>
        Hasta luego
      </button>
    );
  }

  return (
    <>
      {comanda}
      {lleva && <span className="px-sr">Llevas {comandaClara(lista).toLowerCase()}</span>}
      <div
        className={`cf3-franja cf3-franja--atender${raro ? ' cf3-franja--raro' : ''}`}
        role="region"
        aria-label={`Atender a ${quien}`}
        data-paso={paso}
        data-pedido={cliente.pedido.id}
        data-receta={lista_}
        style={raro ? { '--cf3-tema': rgb(raro.tema) } : undefined}
      >
        <span className="cf3-quien" aria-hidden="true">
          {raro ? `★ ${quien}` : quien}
        </span>
        <div className="cf3-caja">
          <span className={`cf3-retrato${raro ? ' cf3-retrato--raro' : ''}`}>{retrato}</span>
          <p className="cf3-dice" aria-live="polite">
            <span className="px-sr">{quien}: </span>
            {texto}
          </p>
          {extra && <div className="cf3-extra">{extra}</div>}
          {error && (
            <p className="cf3-error" role="alert">
              {error}
            </p>
          )}
          <div className="cf3-botones">{botones}</div>
        </div>
      </div>
    </>
  );
}
