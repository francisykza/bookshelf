// El café-librería del bajo, bloque 6b (1.127, cifras aprobadas por Francisco el 13-11-2026; plan en docs/qa/cafe-libreria.md
// §14): el tostador del sótano. Con el tueste de la casa en la carta (2.º hito del nivel 7), cada día hay un saco en el tambor.
// Se recoge cuando quieras: tirando del asa de la trampilla hacia ti y manteniéndola mientras caen los granos al enfriador
// (el gesto «tambor» de `cafeGestos.js`); luego el brazo los remueve solo y Pilar lo embolsa. Cada saco da 5 tazas
// (`cafe_recoger_saco`). Con movimiento reducido o con el teclado, un toque. La «!» de ayuda, como en la barra.
import { useEffect, useRef, useState } from 'react';
import { GESTOS, AYUDA_NIVELES, AYUDA_PARADO_MS, crearGesto, ladoNota, verAyuda } from './cafeGestos';
import { TAZAS_MAX, TAZAS_SACO, sacoListo, tuesteAbierto, umbralHito } from './cafeNiveles';
import { crearSfxBarra } from './cafeSfx';
import { errorCafe, recogerSaco } from './cafeService';
import { PILAR } from './cafeIconos';
import { PixelArt } from './PixelArt';
import { Pista } from './Atender';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const reloj = () => performance.now();
/** Lo que tarda el brazo del enfriador en remover los granos (directo con movimiento reducido). */
const ENFRIAR_MS = 1700;

/**
 * `local`: tu café ({ reputacion, nivel, tostadero: { tazas, sacoDia } }); `dia`, el día que juegas (AAAA-MM-DD);
 * `onRecogido(cafe)`, con el café que devuelve el servidor.
 */
export function Tostadero({ escena, local, dia, soundOn = false, ayudas = 'auto', nivel = 7, onRecogido, onCerrar }) {
  const reputacion = local?.reputacion ?? 0;
  const tazas = local?.tostadero?.tazas ?? 0;
  const abierto = tuesteAbierto(reputacion);
  const listo = sacoListo(reputacion, local?.tostadero?.sacoDia ?? null, dia);
  const caben = tazas + TAZAS_SACO <= TAZAS_MAX;
  // 'frio' (sin tueste en la carta), 'nada' (ya recogido), 'lleno' (no caben más tazas), 'tirar' (el gesto), 'enfriar',
  // 'hecho' (el saco recogido)
  const [fase, setFase] = useState(() => (!abierto ? 'frio' : !listo ? 'nada' : !caben ? 'lleno' : 'tirar'));
  const [g, setG] = useState(null);
  const [brazo, setBrazo] = useState(0);
  const [pista, setPista] = useState(null);
  const [parado, setParado] = useState(false);
  const [error, setError] = useState('');
  const [sfx] = useState(() => crearSfxBarra());
  const zona = useRef(null);
  const rec = useRef(null);
  const raf = useRef(0);
  // El brazo del enfriador va aparte: soltar el dedo no debe cortar su animación
  const rafBrazo = useRef(0);
  const fin = useRef(false);

  useEffect(() => sfx.setActivo(soundOn), [sfx, soundOn]);
  // Entrar y salir de la vista del tostador
  useEffect(() => {
    escena?.tostador(true);
    sfx.play('tostador');
    return () => {
      cancelAnimationFrame(raf.current);
      cancelAnimationFrame(rafBrazo.current);
      sfx.apagar();
      escena?.tostador(false);
    };
    // Solo al abrir y cerrar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escena]);
  // Lo que se ve del tostador
  const pose = g?.pose ?? { abierta: 0, caido: 0 };
  const cae = fase === 'tirar' && g?.pulsado && pose.abierta >= 0.85 ? 1 : 0;
  useEffect(() => {
    escena?.setTostador({
      encendido: abierto,
      listo: fase === 'tirar',
      abierta: fase === 'tirar' ? pose.abierta : 0,
      cae,
      caido: fase === 'enfriar' || fase === 'hecho' ? 1 : pose.caido,
      brazo,
      fase: (reloj() / 700) % 1,
    });
  }, [escena, abierto, fase, pose.abierta, pose.caido, cae, brazo, g?.progreso]);
  // Dónde cae el asa en la pantalla, cuando la cámara ya ha llegado (para la pista, la nota y la «!»)
  useEffect(() => {
    if (fase !== 'tirar') return undefined;
    let vivo = true;
    let id = 0;
    const mira = () => {
      if (!vivo) return;
      if (escena && !escena.settled()) {
        id = requestAnimationFrame(mira);
        return;
      }
      const m = escena?.tostadorMarca('asa');
      const r = zona.current?.getBoundingClientRect();
      if (m && r) setPista({ x: m.x - r.left, y: m.y - r.top });
      else if (r) setPista({ x: r.width / 2, y: r.height * 0.4 });
    };
    id = requestAnimationFrame(mira);
    return () => {
      vivo = false;
      cancelAnimationFrame(id);
    };
  }, [fase, escena]);
  // Pasado un rato sin tirar (en los niveles altos), la «!» aparece igualmente
  useEffect(() => {
    if (fase !== 'tirar' || ayudas !== 'auto' || (nivel ?? 1) <= AYUDA_NIVELES) return undefined;
    const id = setTimeout(() => setParado(true), AYUDA_PARADO_MS);
    return () => clearTimeout(id);
  }, [fase, ayudas, nivel]);
  const ayuda = fase === 'tirar' && verAyuda(ayudas, nivel, parado);

  /** Con los granos en el enfriador: el brazo los remueve y, a la vez, el servidor apunta el saco. */
  const enfriar = () => {
    setFase('enfriar');
    sfx.bucle('granosCaen', false);
    sfx.play('enfriador');
    const t0 = reloj();
    const pide = recogerSaco(dia);
    const animar = () =>
      new Promise((ok) => {
        if (reduced()) return ok();
        const paso = () => {
          const t = Math.min(1, (reloj() - t0) / ENFRIAR_MS);
          setBrazo(t * Math.PI * 3);
          if (t < 1) rafBrazo.current = requestAnimationFrame(paso);
          else ok();
        };
        rafBrazo.current = requestAnimationFrame(paso);
      });
    Promise.all([pide, animar()]).then(
      ([r]) => {
        sfx.play('saco');
        if (r.cafe) onRecogido?.(r.cafe);
        setFase('hecho');
      },
      (e) => {
        setError(errorCafe(e));
        setFase('nada');
      },
    );
  };
  const aplicar = (s) => {
    setG(s);
    if (fin.current) return;
    for (const ev of s.eventos) if (ev === 'abre') sfx.play('trampillaTambor');
    sfx.bucle('granosCaen', s.pulsado && !s.hecho && s.pose.abierta >= 0.85);
    if (s.hecho) {
      fin.current = true;
      cancelAnimationFrame(raf.current);
      enfriar();
    }
  };
  const reconocedor = () => {
    if (!rec.current) {
      const ancho = zona.current?.getBoundingClientRect().width || 390;
      rec.current = crearGesto('tambor', { escala: Math.min(ancho, 600) / 390 });
    }
    return rec.current;
  };
  const latido = () => {
    const r = rec.current;
    if (!r) return;
    const s = r.paso(reloj());
    aplicar(s);
    if (s.pulsado && !s.hecho) raf.current = requestAnimationFrame(latido);
  };
  const completar = () => {
    if (fase !== 'tirar' || fin.current) return;
    sfx.play('trampillaTambor');
    aplicar(reconocedor().completar());
  };
  const onDown = (e) => {
    if (fase !== 'tirar' || fin.current) return;
    e.preventDefault();
    if (reduced()) return completar();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    aplicar(reconocedor().abajo(e.clientX, e.clientY, reloj()));
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(latido);
  };
  const onMove = (e) => {
    const r = rec.current;
    if (!r || !r.estado.pulsado) return;
    aplicar(r.mover(e.clientX, e.clientY, reloj()));
  };
  const onUp = () => {
    const r = rec.current;
    cancelAnimationFrame(raf.current);
    if (!r || !r.estado.pulsado) return;
    aplicar(r.arriba());
  };

  const def = GESTOS.tambor;
  const progreso = Math.round((g?.progreso ?? 0) * 100);
  const tazasAhora = local?.tostadero?.tazas ?? 0;
  const texto =
    fase === 'frio'
      ? `«El tostador aún está frío. El primer saco llega con el tueste de la casa en la carta, a ${umbralHito(7, 2).toLocaleString('es-ES')} de reputación.»`
      : fase === 'nada'
        ? `«Hoy ya sacaste el tueste. Mañana habrá otro saco en el tambor.»${tazasAhora ? ` Te quedan ${tazasAhora} ${tazasAhora === 1 ? 'taza' : 'tazas'}.` : ''}`
        : fase === 'lleno'
          ? `«Tienes ${tazasAhora} tazas guardadas: no cabe otro saco. Sirve unas cuantas y vuelve; el de hoy te espera en el tambor.»`
          : fase === 'tirar'
            ? reduced()
              ? `${def.orden}. Un toque basta.`
              : def.orden + '.'
            : fase === 'enfriar'
              ? '«¡Qué olor! Deja que el brazo los remueva un momento…»'
              : `«¡${TAZAS_SACO} tazas de tueste de la casa! Te dejo el saco junto a los tarros de la barra.» Tienes ${tazasAhora}.`;

  return (
    <>
      <div
        ref={zona}
        className="cf3-gesto"
        data-activo={fase === 'tirar' ? 'true' : undefined}
        data-gesto={fase === 'tirar' ? 'tambor' : undefined}
        role={fase === 'tirar' ? 'button' : undefined}
        tabIndex={fase === 'tirar' ? 0 : -1}
        aria-hidden={fase === 'tirar' ? undefined : 'true'}
        aria-label={fase === 'tirar' ? `${def.orden}. Con el teclado, Intro lo hace de una vez.` : undefined}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onLostPointerCapture={onUp}
        onKeyDown={(e) => {
          if (fase === 'tirar' && (e.key === 'Enter' || e.key === ' ') && !e.repeat) {
            e.preventDefault();
            completar();
          }
        }}
      >
        {ayuda && pista && !(g?.progreso > 0) && <span className="cf3-ayuda cf3-ayuda--gesto" data-para="asa" style={{ left: `${pista.x}px`, top: `${pista.y}px` }} aria-hidden="true" />}
        {fase === 'tirar' && pista && !(g?.progreso > 0) && (
          <span className="cf3-gesto__pista" style={{ left: `${pista.x}px`, top: `${pista.y}px` }}>
            <Pista tipo="tambor" />
          </span>
        )}
        {fase === 'tirar' && pista && !(g?.progreso > 0) && !reduced() && (
          <span className="cf3-gesto__nota" data-lado={ladoNota(pista.x, zona.current?.clientWidth ?? 390)} style={{ left: `${pista.x}px`, top: `${pista.y}px` }} aria-hidden="true">
            {def.ayuda}
          </span>
        )}
        {fase === 'hecho' && (
          <span className="cf3-gesto__hecho" aria-hidden="true">
            +{TAZAS_SACO} tazas
          </span>
        )}
      </div>
      <div
        className="cf3-franja cf3-franja--atender cf3-franja--barra cf3-franja--tostador"
        role="region"
        aria-label="El tostador"
        data-fase={fase}
        data-progreso={fase === 'tirar' ? progreso : undefined}
        data-ayuda={ayuda ? 'true' : undefined}
      >
        <span className="cf3-quien" aria-hidden="true">
          {fase === 'tirar' ? 'El tostador' : 'Pilar'}
        </span>
        <div className="cf3-caja">
          <span className="cf3-retrato">
            <PixelArt icono={PILAR} />
          </span>
          <p className="cf3-dice" aria-live="polite">
            {fase === 'tirar' ? (
              <>
                {texto}
                <span className="px-sr"> {def.ayuda}</span>
              </>
            ) : (
              <>
                <span className="px-sr">Pilar: </span>
                {texto}
              </>
            )}
          </p>
          {fase === 'tirar' && (
            <div className="cf3-extra">
              <div className="cf3-medidor" role="progressbar" aria-label={def.orden} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progreso}>
                <span className="cf3-medidor__lleno" style={{ width: `${progreso}%` }} />
              </div>
            </div>
          )}
          {error && (
            <p className="cf3-error" role="alert">
              {error}
            </p>
          )}
          <div className="cf3-botones">
            {fase !== 'enfriar' && (
              <button type="button" className="cf3-btn cf3-btn--suave" onClick={onCerrar}>
                {fase === 'tirar' ? 'Luego' : 'Volver'}
              </button>
            )}
            {fase === 'tirar' && reduced() && (
              <button type="button" className="cf3-btn cf3-btn--verde" onClick={completar}>
                {def.atajo}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
