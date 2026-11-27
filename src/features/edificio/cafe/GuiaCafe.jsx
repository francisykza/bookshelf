// La guía del café en sus menús y botones (1.150, bloque 2; los pasos y sus textos en cafeGuia.js). Como la de Libo: un velo
// suave con un hueco sobre el botón del paso y una tarjeta al lado, aquí con el cuadro de diálogo del café y el retrato de quien
// atiende (Olmo, con su pose de cada paso, o Pilar). Se dibuja dentro del café (`raiz`).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { anclaVisible, cajaDe, colocar, rectEn } from '../../libo/LiboRincon';
import { PixelArt } from './PixelArt';
import { textoDe } from './cafeGuia';
import { poseOlmoDelPaso } from './olmoPoses';

/**
 * `pasos`: los que tocan (ya filtrados a los que se ven). `quien`: el anfitrión (`anfitrion()`). `onPaso(paso)`: cada paso que se
 * enseña (para marcarlo como visto). `onFin()`: al acabar, saltar o pulsar Escape. `repaso`: abierta a petición (el retrato).
 */
export function GuiaCafe({ raiz, pasos, quien, onPaso, onFin, repaso = false }) {
  const [i, setI] = useState(0);
  const [geo, setGeo] = useState(null);
  const tarjeta = useRef(null);
  const principal = useRef(null);
  const paso = pasos[Math.min(i, pasos.length - 1)];
  const ultimo = i >= pasos.length - 1;
  const cont = raiz?.current ?? null;

  useEffect(() => {
    if (paso) onPaso?.(paso);
  }, [paso, onPaso]);

  const medir = useCallback(() => {
    if (!cont || !tarjeta.current || !paso) return;
    const caja = cajaDe(cont);
    const el = paso.ancla ? anclaVisible(cont, paso.ancla) : null;
    const objetivo = el ? rectEn(caja, el) : null;
    const t = { w: Math.min(360, tarjeta.current.offsetWidth || 360), h: tarjeta.current.offsetHeight || 170 };
    const sitio = colocar(caja, objetivo, t);
    setGeo((g) => {
      const n = { objetivo, sitio };
      return JSON.stringify(g) === JSON.stringify(n) ? g : n;
    });
  }, [paso, cont]);

  useLayoutEffect(() => {
    medir();
    const ro = new ResizeObserver(medir);
    if (cont) ro.observe(cont);
    if (tarjeta.current) ro.observe(tarjeta.current);
    window.addEventListener('resize', medir);
    // Los letreros de los sitios se mueven con la cámara: se vuelve a medir un rato
    const t = setInterval(medir, 400);
    return () => {
      ro.disconnect();
      clearInterval(t);
      window.removeEventListener('resize', medir);
    };
  }, [medir, cont]);

  const colocada = Boolean(geo);
  useEffect(() => {
    if (colocada) principal.current?.focus({ preventScroll: true });
  }, [i, colocada]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // Escape cierra la guía, no el café
      e.stopPropagation();
      onFin();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onFin]);

  if (!paso) return null;
  const o = geo?.objetivo;
  const s = geo?.sitio;
  const id = `cf3-guia-${paso.id}`;
  const varios = pasos.length > 1;
  const conHola = pasos[0]?.id === 'hola';
  const cuenta = pasos.filter((p) => p.id !== 'hola' && p.id !== 'fin').length;
  const n = pasos.slice(0, i + 1).filter((p) => p.id !== 'hola' && p.id !== 'fin').length;
  const gracias = quien.id === 'olmo' ? 'Gracias, Olmo' : 'Gracias, Pilar';
  return (
    <div className="cf3-guia" data-escape-local="open" data-no-room-swipe data-quien={quien.id}>
      {o ? <span className="cf3-guia__hueco" style={{ left: o.x - 6, top: o.y - 6, width: o.w + 12, height: o.h + 12 }} aria-hidden="true" /> : <span className="cf3-guia__velo" aria-hidden="true" />}
      <section
        ref={tarjeta}
        className="cf3-guia__tarjeta"
        data-paso={paso.id}
        data-lado={s && !s.arriba ? 'abajo' : 'arriba'}
        style={s ? { left: s.x, top: s.y, width: s.ancho, '--flecha': `${s.flecha ?? -100}px` } : { visibility: 'hidden' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-d`}
      >
        <span className="cf3-quien cf3-guia__quien" aria-hidden="true">
          {quien.nombre}
        </span>
        <span className="cf3-retrato cf3-guia__retrato" aria-hidden="true">
          <PixelArt icono={quien.retrato(poseOlmoDelPaso(i, pasos.length, paso.pose))} />
        </span>
        <h2 id={`${id}-t`} className="cf3-guia__titulo">
          {paso.titulo}
        </h2>
        <p id={`${id}-d`} className="cf3-guia__texto">
          <span className="px-sr">{quien.nombre}: </span>«{textoDe(paso, quien.id)}»
        </p>
        <div className="cf3-guia__acciones">
          <button ref={principal} type="button" className="cf3-btn cf3-btn--verde" onClick={() => (ultimo ? onFin() : setI(i + 1))}>
            {i === 0 && varios && conHola ? 'Enséñame' : ultimo ? (varios || repaso ? gracias : 'Entendido') : 'Siguiente'}
          </button>
          {i === 0 && varios && conHola ? (
            <button type="button" className="cf3-btn cf3-btn--suave" onClick={onFin}>
              Ahora no
            </button>
          ) : (
            !ultimo && (
              <>
                {i > 0 && (
                  <button type="button" className="cf3-btn cf3-btn--suave" onClick={() => setI(i - 1)}>
                    Atrás
                  </button>
                )}
                <button type="button" className="cf3-btn cf3-btn--suave" onClick={onFin}>
                  Saltar
                </button>
              </>
            )
          )}
        </div>
        {cuenta > 1 && n > 0 && paso.id !== 'fin' && (
          <p className="cf3-guia__cuenta" aria-hidden="true">
            {n} de {cuenta}
          </p>
        )}
      </section>
    </div>
  );
}
