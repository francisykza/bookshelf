// El café-librería del bajo, 1.143 (docs/qa/cafe-libreria.md §18): la vitrina de la punta de la barra, dentro de Atender.jsx.
// Máximo dos cosas por cliente (Francisco, 17-11-2026, tras ver la 1.143: «Dos máx., 1 de cada 3»): quien pide comida no pide
// libro, y la taza y la pieza van en el mismo viaje, como el libro. Con la taza lista, a la vitrina: si hay más de una receta de lo
// que pide, cuál; con las pinzas, de la vitrina al plato (un gesto corto, con su clic de metal); y con la taza y el plato en la
// bandeja, a su mesa. «Solo el café» sale de la vitrina con la taza sola. Con movimiento reducido o con el teclado, las pinzas, de
// una vez. La «!» de ayuda, como en la barra. Lo que paga (su precio en granos) lo apunta el servidor al servir (`cafe_servir_comida`).
// 1.144: la especialidad del día va la primera entre lo que hay y lleva su marca (paga un grano más).
import { useEffect, useRef, useState } from 'react';
import { AYUDA_NIVELES, AYUDA_PARADO_MS, ladoNota, verAyuda } from './cafeGestos';
import { PINZAS, paraAcompanar, recetaObrador } from './cafeObrador';
import { crearGestoObrador } from './cafeObradorGestos';
import { Pista } from './Pista';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * `activo`: en la vitrina; `tipo`, lo que pide ('dulce' o 'salado'); `obrador`, el del servidor (lo de la vitrina, al llegar el
 * cliente). `onListo(receta)`, con la pieza en el plato; `onSolo()`, solo el café. Devuelve lo que pinta Atender en su cuadro:
 * { capa, texto, extra, botones, fase, gesto, progreso, opciones }.
 */
export function useVitrina({ activo, tipo, obrador, especialidad = null, escena, sfx, ayudas = 'auto', nivel = 4, onListo, onSolo }) {
  // Lo que hay para lo que pide, al llegar el cliente (lo de la vitrina no cambia mientras tanto); la especialidad, la primera
  const [opciones] = useState(() => (tipo ? paraAcompanar(obrador, tipo).sort((x, y) => (y.receta === especialidad) - (x.receta === especialidad)) : []));
  // 'elegir' (si hay más de una receta de lo que pide), 'pinzas' y 'listo' (en el plato)
  const [fase, setFase] = useState(() => (opciones.length > 1 ? 'elegir' : 'pinzas'));
  const [elegida, setElegida] = useState(() => (opciones.length === 1 ? opciones[0].receta : null));
  const [g, setG] = useState(null);
  const [pista, setPista] = useState(null);
  const [parado, setParado] = useState(false);
  const zona = useRef(null);
  const rec = useRef(null);
  const centro = useRef(null);
  const fin = useRef(false);
  const dentro = useRef(false);
  useEffect(() => {
    dentro.current = activo;
  }, [activo]);
  // Si se cierra a medias (al salir del café, p. ej.), se sale de la vitrina con las manos vacías
  useEffect(
    () => () => {
      if (dentro.current) escena?.vitrina(false, { llevar: null });
    },
    [escena],
  );
  // La vitrina, con la pieza elegida en las pinzas
  const baja = g?.pose?.baja ?? 0;
  useEffect(() => {
    if (!activo || fase === 'listo') return;
    escena?.setVitrina({ piezas: obrador?.piezas ?? {}, elegida: fase === 'pinzas' ? elegida : null, baja, plato: true });
  }, [activo, escena, obrador, fase, elegida, baja]);
  // Dónde cae la pieza en la pantalla, cuando la cámara ya ha llegado (la pista, la nota, la «!» y el gesto)
  useEffect(() => {
    setPista(null);
    if (!activo || fase !== 'pinzas') return undefined;
    let vivo = true;
    let id = 0;
    const mira = () => {
      if (!vivo) return;
      if (escena && !escena.settled()) {
        id = requestAnimationFrame(mira);
        return;
      }
      const r = zona.current?.getBoundingClientRect();
      const m = escena?.vitrinaMarca('pieza');
      if (m && r) {
        setPista({ x: m.x - r.left, y: m.y - r.top, ancho: r.width });
        centro.current = { x: m.x, y: m.y };
      } else if (r) setPista({ x: r.width / 2, y: r.height * 0.4, ancho: r.width });
    };
    id = requestAnimationFrame(mira);
    return () => {
      vivo = false;
      cancelAnimationFrame(id);
    };
  }, [activo, fase, escena]);
  useEffect(() => {
    setParado(false);
    if (!activo || fase !== 'pinzas' || ayudas !== 'auto' || (nivel ?? 1) <= AYUDA_NIVELES) return undefined;
    const id = setTimeout(() => setParado(true), AYUDA_PARADO_MS);
    return () => clearTimeout(id);
  }, [activo, fase, ayudas, nivel]);
  const ayuda = activo && fase === 'pinzas' && verAyuda(ayudas, nivel, parado);

  const aplicar = (s) => {
    setG(s);
    if (fin.current) return;
    for (const ev of s.eventos) if (ev === 'pinza' || ev === 'plato') sfx?.play(ev);
    if (s.hecho) {
      fin.current = true;
      setFase('listo');
      setTimeout(() => onListo?.(elegida), reduced() ? 150 : 450);
    }
  };
  const reconocedor = () => {
    if (!rec.current) {
      const ancho = zona.current?.getBoundingClientRect().width || 390;
      rec.current = crearGestoObrador('pinzas', { escala: Math.min(ancho, 600) / 390, centro: centro.current });
    }
    return rec.current;
  };
  const conGesto = activo && fase === 'pinzas' && !g?.hecho;
  const completar = () => {
    if (!conGesto || fin.current) return;
    aplicar(reconocedor().completar());
  };
  const onDown = (e) => {
    if (!conGesto || fin.current) return;
    e.preventDefault();
    if (reduced()) return completar();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    aplicar(reconocedor().abajo(e.clientX, e.clientY));
  };
  const onMove = (e) => {
    const r = rec.current;
    if (!r || !r.estado.pulsado) return;
    aplicar(r.mover(e.clientX, e.clientY));
  };
  const onUp = () => {
    const r = rec.current;
    if (!r || !r.estado.pulsado) return;
    aplicar(r.arriba());
  };
  const solo = () => {
    if (fin.current) return;
    fin.current = true;
    onSolo?.();
  };

  const progreso = Math.round((g?.progreso ?? 0) * 100);
  const capa = activo ? (
    <div
      ref={zona}
      className="cf3-gesto"
      data-activo={conGesto ? 'true' : undefined}
      data-gesto={conGesto ? 'pinzas' : undefined}
      role={conGesto ? 'button' : undefined}
      tabIndex={conGesto ? 0 : -1}
      aria-hidden={conGesto ? undefined : 'true'}
      aria-label={conGesto ? `${PINZAS.orden}. Con el teclado, Intro lo hace de una vez.` : undefined}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onLostPointerCapture={onUp}
      onKeyDown={(e) => {
        if (conGesto && (e.key === 'Enter' || e.key === ' ') && !e.repeat) {
          e.preventDefault();
          completar();
        }
      }}
    >
      {ayuda && pista && !(g?.progreso > 0) && <span className="cf3-ayuda cf3-ayuda--gesto" data-para="pieza" style={{ left: `${pista.x}px`, top: `${pista.y}px` }} aria-hidden="true" />}
      {conGesto && pista && !(g?.progreso > 0) && (
        <span className="cf3-gesto__pista" style={{ left: `${pista.x}px`, top: `${pista.y}px` }}>
          <Pista trazo="abajo" />
        </span>
      )}
      {conGesto && pista && !(g?.progreso > 0) && !reduced() && (
        <span className="cf3-gesto__nota" data-lado={ladoNota(pista.x, pista.ancho ?? 390)} style={{ left: `${pista.x}px`, top: `${pista.y}px` }} aria-hidden="true">
          {PINZAS.ayuda}
        </span>
      )}
      {fase === 'listo' && (
        <span className="cf3-gesto__hecho" aria-hidden="true">
          ¡En el plato!
        </span>
      )}
    </div>
  ) : null;

  const nombre = recetaObrador(elegida)?.nombre.toLowerCase();
  const texto =
    fase === 'elegir' ? (
      `«${tipo === 'salado' ? 'Algo salado' : 'Algo dulce'}…» ¿Cuál le pones?`
    ) : fase === 'pinzas' ? (
      reduced() ? (
        `${PINZAS.orden}. Un toque basta.`
      ) : (
        <>
          {PINZAS.orden}.<span className="px-sr"> {PINZAS.ayuda}</span>
        </>
      )
    ) : (
      `¡En el plato! ${nombre ? `La taza y ${nombre}, ` : ''}a su mesa.`
    );
  const extra = conGesto ? (
    <div className="cf3-medidor" role="progressbar" aria-label={PINZAS.orden} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progreso}>
      <span className="cf3-medidor__lleno" style={{ width: `${progreso}%` }} />
    </div>
  ) : null;
  const botones =
    fase === 'listo' ? null : (
      <>
        <button key="solo" type="button" className="cf3-btn cf3-btn--suave" onClick={solo}>
          Solo el café
        </button>
        {fase === 'elegir' &&
          opciones.map((o) => (
            <button
              key={o.receta}
              type="button"
              className="cf3-btn cf3-btn--verde"
              onClick={() => {
                setElegida(o.receta);
                setFase('pinzas');
              }}
            >
              {recetaObrador(o.receta)?.nombre} ({o.piezas})
              {o.receta === especialidad && <span className="cf3-btn__especial"> · de hoy</span>}
            </button>
          ))}
        {conGesto && reduced() && (
          <button key="atajo" type="button" className="cf3-btn cf3-btn--verde" onClick={completar}>
            {PINZAS.atajo}
          </button>
        )}
      </>
    );
  return { capa, texto, extra, botones, fase, gesto: conGesto ? 'pinzas' : null, progreso: conGesto ? progreso : undefined, opciones, elegida };
}
