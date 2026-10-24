// Guía diegética (SPEC §16, Anexo B): una carta de bienvenida apoyada en el libro abierto y una sola luciérnaga
// que vuela de objeto en objeto con una tarjeta por parada. Se ancla con la misma transformación del escenario
// (`toScreen`) y se mantiene dentro del viewport seguro; si el objeto queda recortado, la luciérnaga espera en
// el borde más cercano. Sin overlay oscuro, sin temporizadores que avancen solos.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CURRENT_PHASE, isLast } from '../../domain/onboarding';
import { anchorPoint, placeCard, safeAreas } from '../../scene/guidePlacement';

export function OnboardingGuide({ guide, fit, reducedMotion }) {
  const cardRef = useRef(null);
  const primaryRef = useRef(null);
  const [size, setSize] = useState({ w: 320, h: 200 });
  const { state, stop } = guide;
  const welcome = state === 'welcome';
  const last = isLast(state, CURRENT_PHASE);

  useLayoutEffect(() => {
    const node = cardRef.current;
    if (!node) return undefined;
    const measure = () => setSize((s) => (s.w === node.offsetWidth && s.h === node.offsetHeight ? s : { w: node.offsetWidth, h: node.offsetHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [state]);

  // Cada parada lleva el foco a su acción principal (el lector de pantalla lee el título y la explicación)
  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });
  }, [state]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        guide.skip();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [guide]);

  const point = anchorPoint(fit, stop.anchor);
  const place = placeCard(fit, point, size, safeAreas());
  const titleId = `onboarding-title-${state}`;
  const textId = `onboarding-text-${state}`;

  return (
    <div className="onboarding" data-state={state} data-reduced={reducedMotion || undefined} data-no-room-swipe>
      {place.firefly && <span className="firefly" style={{ left: place.firefly.x, top: place.firefly.y }} aria-hidden="true" />}
      <section
        ref={cardRef}
        className={`onboarding-card ${welcome ? 'onboarding-card--letter' : ''}`}
        style={{ left: place.x, top: place.y }}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={textId}
      >
        {welcome && <span className="onboarding-card__seal" aria-hidden="true">B</span>}
        <h2 id={titleId}>{stop.title}</h2>
        <p id={textId}>{stop.text}</p>
        {welcome && <p className="onboarding-card__hand">con cariño, desde la habitación junto al mar</p>}
        <div className="onboarding-card__actions">
          <button ref={primaryRef} type="button" className="onboarding-card__primary" onClick={guide.advance}>
            {welcome ? 'Descubrir mi habitación' : last ? 'Terminar' : 'Continuar'}
          </button>
          {!welcome && (
            <button type="button" className="onboarding-card__secondary" onClick={guide.previous}>
              Atrás
            </button>
          )}
          <button type="button" className="onboarding-card__secondary" onClick={guide.skip}>
            Saltar guía
          </button>
        </div>
      </section>
    </div>
  );
}
