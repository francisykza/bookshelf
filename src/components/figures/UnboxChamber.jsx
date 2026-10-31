// Cámara de Unboxing (SPEC §13.5–§13.6, 1.19.0): una pequeña ceremonia de coleccionista separada de la
// entrega del premio. Primero se confirma la recompensa en el estado con un intento identificado (consumo de
// caja + premio en una sola operación, guardada al momento); después se representa:
// charging → unlocking → opening → revealing → result. Saltar, cerrar, volver o recargar no repiten el sorteo:
// el resultado confirmado se recupera al volver a entrar.
import { useEffect, useRef, useState } from 'react';
import { chime, lampClick } from '../../audio/ambientAudio';
import { dayKey } from '../../domain/dates';
import { FIGURE_PITY, RARITY, RELIC_PITY, SEALS_PER_BOX, boxHasPrize } from '../../domain/figures';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useLibrary } from '../../state/useLibrary';
import { FigureArt, PartArt, RANK_STARS } from './FigureArt';
import { forRules } from './figureCatalog';

const CEREMONY = [
  ['charging', 450],
  ['unlocking', 500],
  ['opening', 650],
  ['revealing', 700],
];
const IN_CEREMONY = new Set(CEREMONY.map(([p]) => p));
const PARTICLES = { rare: [8, 4], epic: [14, 7], legendary: [20, 10] };

const newAttemptId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Tubo de cristal y latón con un segmento por caja que se enciende al llenarse. */
function PityTube({ icon, label, value, max }) {
  const v = Math.min(value, max);
  return (
    <div className="pity-tube" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={v} aria-label={`${label}: ${v} de ${max}`}>
      <span className="pity-tube__label">
        <span aria-hidden="true">{icon}</span> {label} <b>{v}/{max}</b>
      </span>
      <span className="pity-tube__glass">
        <span className="pity-tube__cap pity-tube__cap--l" aria-hidden="true" />
        {Array.from({ length: max }, (_, i) => (
          <i key={i} data-on={i < v} data-last={i === v - 1 || undefined} />
        ))}
        <span className="pity-tube__cap pity-tube__cap--r" aria-hidden="true" />
      </span>
    </div>
  );
}

/** Los cinco sellos del Guardián en una franja de latón. El reflejo de la carga es decorativo. */
function SealStrip({ guardian, lit, charging }) {
  if (!guardian) return null;
  return (
    <ol className="seal-strip" data-charging={charging || undefined} aria-label={`Sellos de ${guardian.name}: ${lit} de ${SEALS_PER_BOX}`}>
      {guardian.loreSeals.map((name, i) => (
        <li key={name + i} data-on={i < lit} style={{ '--i': i }}>
          <svg viewBox="0 0 60 60" aria-hidden="true">
            <circle cx="30" cy="30" r="26" className="vault-seal__ring" />
            <circle cx="30" cy="30" r="19" className="vault-seal__core" />
            <path d="M30 14 L33 26 L46 30 L33 34 L30 46 L27 34 L14 30 L27 26 Z" className="vault-seal__star" />
          </svg>
          <span>{name}</span>
        </li>
      ))}
    </ol>
  );
}

/** El premio tal como es: una figura nueva, una pieza de su blíster o un fragmento de sello. */
function Prize({ reward, fig }) {
  if (reward.type === 'figure' && fig) return <FigureArt fig={fig} display="box" className="unbox-prize__figure" />;
  if (reward.type === 'part' && fig) return <PartArt fig={fig} part={fig.parts[reward.part]} />;
  return (
    <svg className="unbox-prize__seal" viewBox="0 0 60 60" aria-hidden="true">
      <circle cx="30" cy="30" r="26" className="vault-seal__ring" />
      <circle cx="30" cy="30" r="19" className="vault-seal__core" />
      <path d="M30 14 L33 26 L46 30 L33 34 L30 46 L27 34 L14 30 L27 26 Z" className="vault-seal__star" />
    </svg>
  );
}

function describe(reward, fig) {
  if (reward.type === 'figure' && fig) return { title: fig.name, detail: `Nueva figura de ${fig.sagaTitle}${reward.pity ? ' · ¡pity garantizado!' : ''}` };
  if (reward.type === 'part' && fig) {
    const part = fig.parts[reward.part];
    const rank = reward.rank ? ` · rango ${RANK_STARS(reward.rank.before)} → ${RANK_STARS(reward.rank.after)}` : '';
    return { title: part?.name ?? 'Pieza del blíster', detail: `Pieza del blíster de ${fig.name}${reward.pity ? ' · ¡reliquia garantizada!' : ''}${rank}` };
  }
  return { title: 'Fragmento de sello', detail: '+1 sello dorado para tu Guardián de Lectura (sin pieza ni figura nueva en esta caja)' };
}

export function UnboxChamber({ catalog, onShowFigure }) {
  const { state, actions } = useLibrary();
  const fs = state.progress.figures;
  const reducedMotion = useReducedMotion();
  // Un resultado confirmado que aún no viste (cerraste, volviste o recargaste a mitad) se recupera tal cual
  const [show, setShow] = useState(() => (fs.unbox && !fs.unbox.seen ? { phase: 'result', id: fs.unbox.id } : { phase: 'idle', id: null }));
  const lock = useRef(false);
  const confirmed = show.id && fs.unbox?.id === show.id ? fs.unbox : null;
  // Sin premio posible (todo completo y sin Guardián) la caja no se abre ni se gasta
  const hasPrize = boxHasPrize(fs, forRules(catalog));
  const reward = confirmed?.reward ?? null;
  const rFig = reward?.id ? catalog.find((f) => f.id === reward.id) : null;
  const rarity = reward?.type === 'figure' && rFig ? rFig.rarity : reward?.type === 'part' && rFig ? rFig.rarity : 'rare';

  // Solicitud: en cuanto el estado confirma el intento empieza la ceremonia (o el resultado directo)
  useEffect(() => {
    if (show.phase !== 'requesting') return undefined;
    if (confirmed) {
      const next = reducedMotion || document.hidden ? 'result' : 'charging';
      const id = setTimeout(() => setShow((s) => (s.phase === 'requesting' ? { ...s, phase: next } : s)), 0);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setShow((s) => (s.phase === 'requesting' ? { ...s, phase: 'error' } : s)), 1500);
    return () => clearTimeout(id);
  }, [show.phase, confirmed, reducedMotion]);

  // Ceremonia: un solo temporizador por fase, cancelado al cambiar de fase o desmontar
  useEffect(() => {
    const i = CEREMONY.findIndex(([p]) => p === show.phase);
    if (i < 0) return undefined;
    if (show.phase === 'unlocking') lampClick();
    if (show.phase === 'revealing') chime();
    const id = setTimeout(() => setShow((s) => (s.phase === CEREMONY[i][0] ? { ...s, phase: CEREMONY[i + 1]?.[0] ?? 'result' } : s)), CEREMONY[i][1]);
    return () => clearTimeout(id);
  }, [show.phase]);

  // Si la pestaña se oculta a mitad, al volver está el resultado (nada queda colgado)
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setShow((s) => (IN_CEREMONY.has(s.phase) ? { ...s, phase: 'result' } : s));
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (show.phase === 'result' || show.phase === 'error' || show.phase === 'idle') lock.current = false;
  }, [show.phase]);

  const start = () => {
    // Bloqueo síncrono además del estado visual: un doble toque no abre dos cajas
    if (lock.current || fs.boxes <= 0 || !hasPrize) return;
    lock.current = true;
    if (fs.unbox && !fs.unbox.seen) actions.markUnboxSeen(fs.unbox.id);
    const id = newAttemptId();
    setShow({ phase: 'requesting', id });
    actions.openBoxAttempt(forRules(catalog), id);
  };
  const retry = () => {
    // El mismo intento: si ya se confirmó, se recupera; nunca se sortea otro premio
    lock.current = true;
    setShow((s) => ({ ...s, phase: 'requesting' }));
    actions.openBoxAttempt(forRules(catalog), show.id);
  };
  const skip = () => setShow((s) => (IN_CEREMONY.has(s.phase) ? { ...s, phase: 'result' } : s));
  const finish = (then) => {
    if (confirmed) actions.markUnboxSeen(confirmed.id);
    setShow({ phase: 'idle', id: null });
    then?.();
  };

  const guardian = catalog.find((f) => f.id === fs.guardian) ?? null;
  const today = dayKey();
  const readToday = state.progress.readingLog.some((e) => e.date === today && e.pages > 0) || state.progress.pomodoros.some((p) => dayKey(new Date(p.at)) === today);
  const sealedToday = fs.lastSealDay === today;
  const canClaim = Boolean(guardian) && readToday && !sealedToday;
  const light = document.documentElement.dataset.motion === 'light';
  const particleCount = (PARTICLES[rarity] ?? PARTICLES.rare)[light ? 1 : 0];
  const phase = show.phase;
  const ceremony = IN_CEREMONY.has(phase);
  const revealed = phase === 'revealing' || phase === 'result';
  const text = reward ? describe(reward, rFig) : null;

  return (
    <div className="unbox" data-phase={phase} data-rarity={revealed ? rarity : undefined} data-reduced={reducedMotion || undefined}>
      <div className="unbox__stage-col">
        <div className="unbox-stage">
          <span className="unbox-stage__light" aria-hidden="true" />
          <span className="unbox-stage__aura" aria-hidden="true" />
          {revealed && reward && (
            <span className="unbox-stage__particles" aria-hidden="true">
              {Array.from({ length: particleCount }, (_, i) => (
                <i key={i} style={{ '--a': `${(360 / particleCount) * i}deg`, '--d': `${70 + (i % 3) * 18}px`, '--t': `${(i % 5) * 0.12}s` }} />
              ))}
            </span>
          )}
          <div className="ubox" data-closed={fs.boxes <= 0 && phase === 'idle' ? true : undefined} aria-hidden="true">
            <span className="ubox__body">
              <span className="ubox__face ubox__face--front" />
              <span className="ubox__face ubox__face--side" />
              <span className="ubox__seam" />
              <span className="ubox__latch" />
            </span>
            <span className="ubox__lid" />
          </div>
          {revealed && reward && (
            <div className="unbox-prize">
              <Prize reward={reward} fig={rFig} />
            </div>
          )}
          <span className="unbox-stage__pedestal" aria-hidden="true" />
        </div>
        <SealStrip guardian={guardian} lit={fs.seals} charging={phase === 'charging'} />
      </div>

      <div className="unbox__info">
        <div className="vault-pity">
          <PityTube icon="🎁" label="Pity de Reliquia" value={fs.pity.relic} max={RELIC_PITY} />
          <PityTube icon="🌟" label="Pity de Nueva Figura Épica/Legendaria" value={fs.pity.figure} max={FIGURE_PITY} />
          {fs.synergy > 0 && (
            <span className="vault-synergy">
              ⚡ Sinergia: <b>{fs.synergy}</b> (la próxima caja cuenta doble)
            </span>
          )}
        </div>
        <label className="vault-path">
          Senda Deseada
          <select value={fs.path ?? ''} onChange={(e) => actions.setFigurePath(e.target.value || null)} disabled={ceremony || phase === 'requesting'}>
            <option value="">Sin preferencia</option>
            {catalog.map((f) => (
              <option key={f.id} value={f.id}>
                {f.sagaTitle} · {f.name}
                {fs.owned[f.id] ? ' (piezas)' : ' (figura)'}
              </option>
            ))}
          </select>
        </label>

        {/* El resultado se anuncia una sola vez, al quedar estable */}
        <div className="unbox-result" aria-live="polite">
          {phase === 'result' && text && (
            <>
              <span className="unbox-result__rarity" data-rarity={rarity}>
                {reward.type === 'seal' ? 'Fragmento' : RARITY[rarity]?.label}
              </span>
              <b className="unbox-result__name">{text.title}</b>
              <em className="unbox-result__detail">{text.detail}</em>
            </>
          )}
          {revealed && phase !== 'result' && text && (
            <span className="unbox-result__rarity" data-rarity={rarity} aria-hidden="true">
              {reward.type === 'seal' ? 'Fragmento' : RARITY[rarity]?.label}
            </span>
          )}
        </div>

        <div className="unbox-actions">
          {phase === 'idle' && (
            <button type="button" className="stamp-btn unbox-actions__main" disabled={fs.boxes <= 0 || !hasPrize} onClick={start}>
              {fs.boxes <= 0 ? 'Sin cajas por abrir' : hasPrize ? `Abrir una Caja Sorpresa (${fs.boxes})` : 'Caja guardada'}
            </button>
          )}
          {phase === 'requesting' && (
            <button type="button" className="stamp-btn unbox-actions__main" disabled>
              Preparando la caja…
            </button>
          )}
          {ceremony && (
            <button type="button" className="link-btn unbox-actions__skip" onClick={skip}>
              Saltar animación
            </button>
          )}
          {phase === 'error' && (
            <>
              <p className="vault-hint" role="alert">
                No se pudo confirmar la apertura. Al reintentar se recupera el mismo intento, sin sortear otro premio.
              </p>
              <button type="button" className="stamp-btn unbox-actions__main" onClick={retry}>
                Reintentar
              </button>
              <button type="button" className="link-btn" onClick={() => setShow({ phase: 'idle', id: null })}>
                Volver
              </button>
            </>
          )}
          {phase === 'result' && (
            <>
              {rFig && (
                <button type="button" className="stamp-btn unbox-actions__main" onClick={() => finish(() => onShowFigure(rFig.id))}>
                  Ver en mi colección
                </button>
              )}
              {fs.boxes > 0 && hasPrize ? (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    finish();
                    start();
                  }}
                >
                  Abrir otra ({fs.boxes})
                </button>
              ) : (
                <button type="button" className="link-btn" onClick={() => finish()}>
                  Seguir
                </button>
              )}
            </>
          )}
        </div>

        {phase === 'idle' && (
          <>
            <p className="vault-hint" role={fs.boxes > 0 && !hasPrize ? 'status' : undefined}>
              {fs.boxes > 0 && !hasPrize
                ? 'Ahora mismo no hay ningún premio que pueda salir: elige un Guardián de Lectura para recibir sellos. Tus cajas siguen guardadas.'
                : fs.boxes > 0
                ? `${fs.boxes} ${fs.boxes === 1 ? 'caja' : 'cajas'} por abrir`
                : `Sin cajas por abrir: los ${SEALS_PER_BOX} sellos de tu Guardián, las misiones del portátil y las hojas doradas del sobre del día te dan más.`}
            </p>
            <button type="button" className="stamp-btn stamp-btn--small" disabled={!canClaim} onClick={actions.claimTodaySeal}>
              {sealedToday ? '✓ Sello de hoy encendido' : readToday ? '✦ Reclamar mi sello de hoy' : '✦ Lee hoy para encender tu sello'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
