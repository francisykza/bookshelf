// El café-librería del bajo, 1.144 (bloque 2 del obrador; docs/qa/cafe-libreria.md §18): la venta del mostrador. Mientras no
// estás, Pilar vende de la vitrina (su cupo al día según el grado, guardando hasta 7 días, como la hucha) y lo cobra en la caja
// registradora de latón de la barra. Al volver, delante de la caja: se tira del cajón hacia ti (el mismo gesto que sacar la pala,
// con su trinquete y su campanita) y dentro están los granos; Pilar dice lo que se llevaron. Lo cuenta el servidor
// (`cafe_mostrador`). Con movimiento reducido o con el teclado, un toque. «Luego» lo deja para otro rato, sin perder nada.
import { useEffect, useRef, useState } from 'react';
import { AYUDA_NIVELES, AYUDA_PARADO_MS, ladoNota, verAyuda } from './cafeGestos';
import { CAJON, CUPO_MOSTRADOR, PILAR_MEJORAS, enVitrina, fraseMostrador } from './cafeObrador';
import { crearGestoObrador } from './cafeObradorGestos';
import { crearSfxBarra } from './cafeSfx';
import { cobrarMostrador, errorCafe } from './cafeService';
import { PILAR } from './cafeIconos';
import { PixelArt } from './PixelArt';
import { Pista } from './Pista';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * `obrador`: el del servidor (con `mostrador.dias` > 0); `dia`, el día que juegas. `onCobrado({ cobrado, cafe, obrador })`, con
 * lo que devuelve el servidor; `onCerrar()`, al volver (o «Luego», sin cobrar).
 */
export function CajaMostrador({ escena, obrador, dia, soundOn = false, ayudas = 'auto', nivel = 4, onCobrado, onCerrar }) {
  // 'tirar' (el gesto), 'cobrando' (el servidor), 'hecho' (los granos en el cajón)
  const [fase, setFase] = useState('tirar');
  const [g, setG] = useState(null);
  const [cobrado, setCobrado] = useState(null);
  const [pista, setPista] = useState(null);
  const [parado, setParado] = useState(false);
  const [error, setError] = useState('');
  const [sfx] = useState(() => crearSfxBarra());
  const zona = useRef(null);
  const rec = useRef(null);
  const centro = useRef(null);
  const fin = useRef(false);
  // Lo que se verá en el cajón antes de que conteste el servidor (lo que puede haber vendido, a unos 3 granos la pieza)
  const [estimado] = useState(() => Math.min((obrador?.mostrador?.dias ?? 0) * (CUPO_MOSTRADOR[obrador?.vitrina ?? 1] ?? 4), enVitrina(obrador)) * 3);

  useEffect(() => sfx.setActivo(soundOn), [sfx, soundOn]);
  useEffect(() => {
    escena?.caja(true);
    return () => {
      // (El cajón se cierra cuando Cafe.jsx vuelve a pintar la vitrina, sin él)
      sfx.apagar();
      escena?.caja(false);
    };
    // Solo al abrir y cerrar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escena]);
  // El cajón: lo que se ha abierto (y, una vez cobrado, abierto del todo con los granos de verdad)
  const abierto = fase === 'tirar' ? (g?.pose?.fuera ?? 0) : 1;
  useEffect(() => {
    escena?.setVitrina({
      piezas: obrador?.piezas ?? {},
      cajon: abierto,
      cajonGranos: cobrado ? cobrado.granos : abierto > 0.3 ? estimado : 0,
    });
  }, [escena, obrador, abierto, cobrado, estimado]);
  // Dónde cae el tirador en la pantalla, cuando la cámara ya ha llegado (la pista, la nota y la «!»)
  useEffect(() => {
    setPista(null);
    if (fase !== 'tirar') return undefined;
    let vivo = true;
    let id = 0;
    const mira = () => {
      if (!vivo) return;
      if (escena && !escena.settled()) {
        id = requestAnimationFrame(mira);
        return;
      }
      const r = zona.current?.getBoundingClientRect();
      const m = escena?.vitrinaMarca('cajon');
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
  }, [fase, escena]);
  useEffect(() => {
    setParado(false);
    if (fase !== 'tirar' || ayudas !== 'auto' || (nivel ?? 1) <= AYUDA_NIVELES) return undefined;
    const id = setTimeout(() => setParado(true), AYUDA_PARADO_MS);
    return () => clearTimeout(id);
  }, [fase, ayudas, nivel]);
  const conGesto = fase === 'tirar' && !g?.hecho;
  const ayuda = conGesto && verAyuda(ayudas, nivel, parado);

  const cobrar = () => {
    setFase('cobrando');
    sfx.play('cajonCaja');
    cobrarMostrador(dia).then(
      (r) => {
        if (!r) return onCerrar?.();
        onCobrado?.(r);
        setCobrado(r.cobrado ?? { dias: 0, piezas: 0, granos: 0, vendidas: {} });
        if ((r.cobrado?.granos ?? 0) > 0) sfx.play('granosCajon', r.cobrado.granos);
        setFase('hecho');
      },
      (e) => {
        setError(errorCafe(e));
        setFase('hecho');
      },
    );
  };
  const aplicar = (s) => {
    setG(s);
    if (fin.current) return;
    if (s.eventos.includes('toca')) sfx.play('pinza');
    if (s.hecho) {
      fin.current = true;
      cobrar();
    }
  };
  const reconocedor = () => {
    if (!rec.current) {
      const ancho = zona.current?.getBoundingClientRect().width || 390;
      rec.current = crearGestoObrador('sacar', {
        escala: Math.min(ancho, 600) / 390,
        centro: centro.current,
      });
    }
    return rec.current;
  };
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

  const progreso = Math.round((g?.progreso ?? 0) * 100);
  const texto = error
    ? error
    : fase === 'hecho' && cobrado
      ? fraseMostrador(cobrado.vendidas)
      : fase === 'cobrando'
        ? '«A ver qué tenemos…»'
        : reduced()
          ? `${PILAR_MEJORAS.caja} Un toque basta.`
          : PILAR_MEJORAS.caja;

  return (
    <>
      <div
        ref={zona}
        className="cf3-gesto"
        data-activo={conGesto ? 'true' : undefined}
        data-gesto={conGesto ? 'cajon' : undefined}
        role={conGesto ? 'button' : undefined}
        tabIndex={conGesto ? 0 : -1}
        aria-hidden={conGesto ? undefined : 'true'}
        aria-label={conGesto ? `${CAJON.orden}. Con el teclado, Intro lo hace de una vez.` : undefined}
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
        {ayuda && pista && !(g?.progreso > 0) && <span className="cf3-ayuda cf3-ayuda--gesto" data-para="cajon" style={{ left: `${pista.x}px`, top: `${pista.y}px` }} aria-hidden="true" />}
        {conGesto && pista && !(g?.progreso > 0) && (
          <span className="cf3-gesto__pista" style={{ left: `${pista.x}px`, top: `${pista.y}px` }}>
            <Pista trazo="abajo" />
          </span>
        )}
        {conGesto && pista && !(g?.progreso > 0) && !reduced() && (
          <span className="cf3-gesto__nota" data-lado={ladoNota(pista.x, pista.ancho ?? 390)} style={{ left: `${pista.x}px`, top: `${pista.y}px` }} aria-hidden="true">
            {CAJON.ayuda}
          </span>
        )}
        {fase === 'hecho' && cobrado?.granos > 0 && (
          <span className="cf3-gesto__hecho cf3-caja-mostrador__granos" aria-hidden="true">
            +{cobrado.granos} granos
          </span>
        )}
      </div>
      <div
        className="cf3-franja cf3-franja--atender cf3-franja--barra cf3-franja--caja"
        role="region"
        aria-label="La caja del mostrador"
        data-fase={fase}
        data-progreso={conGesto ? progreso : undefined}
      >
        <span className="cf3-quien" aria-hidden="true">
          La caja
        </span>
        <div className="cf3-caja">
          <span className="cf3-retrato">
            <PixelArt icono={PILAR} />
          </span>
          <p className="cf3-dice" aria-live="polite">
            <span className="px-sr">Pilar: </span>
            {texto}
            {conGesto && <span className="px-sr"> {CAJON.ayuda}</span>}
          </p>
          {fase === 'hecho' && cobrado && cobrado.piezas > 0 && (
            <p className="cf3-caja-mostrador__cuenta">
              {cobrado.piezas === 1 ? 'Una pieza' : `${cobrado.piezas} piezas`} en {cobrado.dias === 1 ? 'un día' : `${cobrado.dias} días`}: <b>+{cobrado.granos} granos</b>
            </p>
          )}
          {conGesto && (
            <div className="cf3-extra">
              <div className="cf3-medidor" role="progressbar" aria-label={CAJON.orden} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progreso}>
                <span className="cf3-medidor__lleno" style={{ width: `${progreso}%` }} />
              </div>
            </div>
          )}
          <div className="cf3-botones">
            {conGesto && (
              <button type="button" className="cf3-btn cf3-btn--suave" onClick={onCerrar} data-atras>
                Luego
              </button>
            )}
            {conGesto && reduced() && (
              <button type="button" className="cf3-btn cf3-btn--verde" onClick={completar}>
                {CAJON.atajo}
              </button>
            )}
            {fase === 'hecho' && (
              <button type="button" className="cf3-btn cf3-btn--verde" onClick={onCerrar} data-atras>
                Volver
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
