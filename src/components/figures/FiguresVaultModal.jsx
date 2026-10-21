// FIGURES_VAULT_VIEW · El Ático del Coleccionista (SPEC §7.3 y §7.5, 1.15.0). Cuatro mecánicas:
// 1) inspección 3D de la caja blíster o de la figura en peana, con reflejo especular y brillo dorado;
// 2) el Guardián de Lectura y sus 5 sellos dorados (uno por día leído; el 5.º da una Caja Sorpresa);
// 3) el blíster de reliquias y expresiones que sube el rango de ★ a ★★★★★;
// 4) la Cámara de Unboxing (`UnboxChamber`, 1.19.0): ceremonia separada de la entrega idempotente del premio.
import { Package, Shield, Sparkles, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { pageRustle } from '../../audio/ambientAudio';
import { RARITY, SEALS_PER_BOX, rankOf } from '../../domain/figures';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useLibrary } from '../../state/useLibrary';
import { PanelShell } from '../panels/PanelShell';
import { bbox, FigureArt, FigureParticles, PartArt, RANK_STARS } from './FigureArt';
import { canUnbox, shownDisplay } from './figureDisplay';
import { UnboxChamber } from './UnboxChamber';
import { useFigureCatalog } from './figureCatalog';

/** Posición de la ventana de plástico dentro de la caja recortada, en %. */
function windowStyle(fig) {
  if (!fig.boxWindow || !fig.boxOutline) return { inset: '20% 4% 18% 21%' };
  const c = bbox(fig.boxOutline);
  const w = fig.boxWindow;
  return { left: `${((w.x - c.x) / c.w) * 100}%`, top: `${((w.y - c.y) / c.h) * 100}%`, width: `${(w.w / c.w) * 100}%`, height: `${(w.h / c.h) * 100}%` };
}

/** Escenario de inspección: la caja (o la figura) se inclina con el cursor o el dedo. */
function InspectStage({ fig, entry, rank }) {
  const ref = useRef(null);
  const reducedMotion = useReducedMotion();
  const tilt = (event) => {
    if (reducedMotion) return;
    const r = ref.current.getBoundingClientRect();
    const x = (event.clientX - r.left) / r.width - 0.5;
    const y = (event.clientY - r.top) / r.height - 0.5;
    ref.current.style.setProperty('--ry', `${(x * 26).toFixed(2)}deg`);
    ref.current.style.setProperty('--rx', `${(-y * 20).toFixed(2)}deg`);
    ref.current.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
    ref.current.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`);
  };
  const rest = () => {
    ['--ry', '--rx', '--mx', '--my'].forEach((k) => ref.current?.style.removeProperty(k));
  };
  const shown = shownDisplay(fig, entry.display);
  const box = shown === 'box';
  return (
    <div ref={ref} className="vault-stage" data-display={shown} onPointerMove={tilt} onPointerLeave={rest} onPointerUp={rest} style={{ touchAction: 'none' }}>
      <div className="vault-tilt">
        <FigureArt
          fig={fig}
          display={shown}
          mist={!box}
          // Reflejo diagonal que solo cruza el plástico de la ventana, y brillo en los grabados dorados
          window={
            box ? (
              <>
                <span className="vault-glare" style={windowStyle(fig)} aria-hidden="true" />
                <span className="vault-gilt" aria-hidden="true" />
              </>
            ) : null
          }
        />
        {rank >= 3 && <FigureParticles kind={fig.particles} strong={rank >= 5} />}
      </div>
      <span className="vault-stage__floor" aria-hidden="true" />
    </div>
  );
}

/** Los 5 sellos dorados de lore de la caja. */
function Seals({ fig, lit, active }) {
  return (
    <ol className="vault-seals" data-active={active || undefined} aria-label={active ? `${lit} de ${SEALS_PER_BOX} sellos encendidos` : 'Sellos de lore (solo se cargan en tu Guardián)'}>
      {fig.loreSeals.map((name, i) => (
        <li key={name + i} data-on={active && i < lit}>
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

function Inspect({ fig, catalogLen }) {
  const { state, actions } = useLibrary();
  const fs = state.progress.figures;
  const entry = fs.owned[fig.id];
  const rank = rankOf(fig.parts.length, entry);
  const isGuardian = fs.guardian === fig.id;
  const sagaIds = [].concat(fs.placements[fig.id] ?? []);
  const sagaBooks = state.books.filter((b) => sagaIds.includes(b.id));
  return (
    <div className="vault-inspect">
      <section className="vault-main" aria-label={`Inspeccionar ${fig.name}`}>
        <div className="vault-title">
          <h3>{fig.name}</h3>
          <p>
            <span className="vault-rarity" data-rarity={fig.rarity}>
              {RARITY[fig.rarity].label}
            </span>{' '}
            · {fig.sagaTitle} · <span className="vault-rank" aria-label={`Rango ${rank} de 5`}>{RANK_STARS(rank)}</span>
          </p>
        </div>
        <InspectStage fig={fig} entry={entry} rank={rank} />
        <div className="vault-switch" role="radiogroup" aria-label="Cómo exponerla">
          <button type="button" role="radio" aria-checked={shownDisplay(fig, entry.display) === 'box'} onClick={() => actions.figureDisplay(fig.id, 'box')}>
            📦 Exponer en Caja de Coleccionista
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={shownDisplay(fig, entry.display) === 'unboxed'}
            disabled={!canUnbox(fig)}
            aria-describedby={canUnbox(fig) ? undefined : `unbox-${fig.id}`}
            onClick={() => {
              actions.figureDisplay(fig.id, 'unboxed');
              pageRustle(0.4);
            }}
          >
            ✨ Exponer Fuera de Caja (En Peana)
          </button>
        </div>
        {/* Sin foto de la figura con fondo transparente no se inventa un recorte: se expone en su caja */}
        {!canUnbox(fig) && (
          <p className="vault-hint" id={`unbox-${fig.id}`}>
            Desprecintada aún no disponible: falta la foto de esta figura sin fondo.
          </p>
        )}

        <div className="vault-guardian">
          <button type="button" className="stamp-btn stamp-btn--small" aria-pressed={isGuardian} disabled={isGuardian} onClick={() => actions.setGuardian(fig.id)}>
            <Shield aria-hidden="true" /> {isGuardian ? 'Es tu Guardián de Lectura Activo' : 'Hacerla mi Guardián de Lectura'}
          </button>
          {sagaBooks.length ? (
            <span className="vault-synergy">⚡ Sinergia ×2 de pity al leer {sagaBooks.map((b) => `«${b.title}»`).join(', ')}</span>
          ) : (
            <span className="vault-hint">Añade un libro de {fig.sagaTitle} para activar su sinergia.</span>
          )}
        </div>

        <Seals fig={fig} lit={fs.seals} active={isGuardian} />
        <p className="vault-hint">
          {isGuardian
            ? `Cada día que registras páginas o completas una sesión se enciende un sello. Al ${SEALS_PER_BOX}.º, Caja Sorpresa.`
            : 'Los sellos solo se cargan en tu Guardián de Lectura.'}
        </p>
        <button type="button" className="link-btn vault-simulate" onClick={actions.simulateSeal} disabled={!fs.guardian}>
          Simular lectura diaria (+1 Sello)
        </button>
      </section>

      {/* El blíster: expresiones, armas y reliquias de esta figura */}
      <aside className="vault-blister" aria-label="Piezas del blíster">
        <h4>Blíster de Reliquias</h4>
        <p className="vault-hint">
          {entry.parts.length}/{fig.parts.length} piezas · rango {RANK_STARS(rank)}
        </p>
        <ul>
          {fig.parts.map((part, i) => {
            const have = entry.parts.includes(i);
            return (
              <li key={part.name + i} className="vault-part" data-have={have} data-kind={part.kind}>
                <span className="vault-part__slot">{have ? <PartArt fig={fig} part={part} /> : <span aria-hidden="true">?</span>}</span>
                <span className="vault-part__name">{have ? part.name : `${part.name} · por conseguir`}</span>
              </li>
            );
          })}
        </ul>
        {catalogLen > 0 && rank < 3 && <p className="vault-hint">Con ★★★ cobra vida en la estantería.</p>}
      </aside>
    </div>
  );
}

/** Silueta chibi en penumbra, con un contorno tenue y un candado de filigrana dorada. */
function MysterySilhouette() {
  return (
    <svg className="vault-rail__mystery" viewBox="0 0 60 90" aria-hidden="true">
      <defs>
        <radialGradient id="mys-glow" cx="0.5" cy="0.35" r="0.6">
          <stop offset="0" stopColor="#3a2a1c" />
          <stop offset="1" stopColor="#120a06" />
        </radialGradient>
      </defs>
      <ellipse cx="30" cy="84" rx="20" ry="4" fill="#0a0604" />
      <path d="M18 80 Q16 60 20 52 Q30 47 40 52 Q44 60 42 80 Z" fill="url(#mys-glow)" stroke="rgb(212 169 74 / 0.35)" strokeWidth="0.7" />
      <circle cx="30" cy="33" r="16" fill="url(#mys-glow)" stroke="rgb(212 169 74 / 0.4)" strokeWidth="0.7" />
      <path d="M14 30 Q14 14 30 14 Q46 14 46 30 Q40 22 30 22 Q20 22 14 30 Z" fill="#0e0805" stroke="rgb(212 169 74 / 0.3)" strokeWidth="0.6" />
      <ellipse cx="24" cy="35" rx="2" ry="2.6" fill="rgb(232 196 106 / 0.55)" />
      <ellipse cx="36" cy="35" rx="2" ry="2.6" fill="rgb(232 196 106 / 0.55)" />
      <g className="vault-rail__lock" transform="translate(22 56)">
        <path d="M4 7 V5 a4 4 0 0 1 8 0 V7" fill="none" stroke="#d4a94a" strokeWidth="1.3" />
        <rect x="1.5" y="7" width="13" height="10" rx="2" fill="#2a1d10" stroke="#d4a94a" strokeWidth="1" />
        <path d="M8 9.5 v3.5 M5 12 q3 3 6 0" stroke="#d4a94a" strokeWidth="0.8" fill="none" />
        <circle cx="8" cy="9.4" r="1" fill="#d4a94a" />
      </g>
    </svg>
  );
}

export function FiguresVaultModal({ onClose, initialId, section = 'inspect', onSection = () => {} }) {
  const { state, actions } = useLibrary();
  const catalog = useFigureCatalog();
  const fs = state.progress.figures;
  const [selected, setSelected] = useState(initialId ?? fs.guardian ?? null);
  // Vitrina o Cámara de Unboxing: viene de la ubicación (historial), así Atrás vuelve de la cámara a la vitrina
  const tab = section;
  const setTab = (next, id = selected) => {
    if (next !== tab) onSection(next, id);
  };
  const fig = catalog.find((f) => f.id === selected && fs.owned[f.id]) ?? catalog.find((f) => fs.owned[f.id]);
  const ownedCount = catalog.filter((f) => fs.owned[f.id]).length;

  return (
    <PanelShell onClose={onClose} label="El Ático del Coleccionista" variant="vault">
      <div className="vault" data-section={tab}>
        <button type="button" className="icon-btn vault__close" onClick={onClose} aria-label="Cerrar el Ático">
          <X aria-hidden="true" />
        </button>
        <header className="vault__head">
          <h2>{tab === 'unbox' ? 'Cámara de Unboxing' : 'El Ático del Coleccionista'}</h2>
          <p>
            Figuras de coleccionista · Edición Blíster de Lujo · {ownedCount}/{catalog.length} en tu vitrina
          </p>
        </header>

        <div className="vault__tabs" role="tablist" aria-label="Ático">
          <button type="button" role="tab" aria-selected={tab === 'inspect'} onClick={() => setTab('inspect')}>
            <Sparkles aria-hidden="true" /> Vitrina
          </button>
          <button type="button" role="tab" aria-selected={tab === 'unbox'} onClick={() => setTab('unbox')}>
            <Package aria-hidden="true" /> Cámara de Unboxing {fs.boxes > 0 && <b className="vault__count">{fs.boxes}</b>}
          </button>
        </div>

        {fs.sealBox && (
          <p className="vault-notice" role="status">
            ✨ ¡El 5.º sello de tu Guardián te ha otorgado una Caja Sorpresa!{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                actions.ackFigureReward();
                setTab('unbox');
              }}
            >
              Abrirla
            </button>
          </p>
        )}

        {/* Colección: las tuyas y las que faltan por descubrir */}
        {tab === 'inspect' && (
        <ul className="vault-rail" aria-label="Tu colección">
          {catalog.map((f) => {
            const owned = fs.owned[f.id];
            return (
              <li key={f.id}>
                <button
                  type="button"
                  className="vault-rail__item"
                  data-owned={Boolean(owned)}
                  data-rarity={f.rarity}
                  aria-pressed={fig?.id === f.id && tab === 'inspect'}
                  disabled={!owned}
                  onClick={() => {
                    setSelected(f.id);
                    setTab('inspect', f.id);
                  }}
                  title={owned ? f.name : `${RARITY[f.rarity].label} · ${f.sagaTitle} · por descubrir`}
                >
                  <span className="vault-rail__niche">
                    <span className="vault-rail__light" aria-hidden="true" />
                    <span className="vault-rail__thumb">{owned ? <FigureArt fig={f} display={shownDisplay(f, owned.display)} /> : <MysterySilhouette />}</span>
                    <span className="vault-rail__pedestal" aria-hidden="true" />
                  </span>
                  <span className="vault-rail__name">{owned ? f.name : 'Por descubrir'}</span>
                  {fs.guardian === f.id && <span className="vault-rail__guardian" title="Guardián de Lectura">🛡️</span>}
                </button>
              </li>
            );
          })}
        </ul>
        )}

        {tab === 'inspect' && fig && <Inspect key={fig.id} fig={fig} catalogLen={catalog.length} />}
        {tab === 'inspect' && !fig && <p className="vault-empty">Cargando tu vitrina…</p>}
        {tab === 'unbox' && (
          <UnboxChamber
            catalog={catalog}
            onShowFigure={(id) => {
              setSelected(id);
              setTab('inspect', id);
            }}
          />
        )}
      </div>
    </PanelShell>
  );
}
