// Primitivas del sistema visual mediterráneo (SPEC §28.3). Solo presentación: el texto, las cifras, las
// estrellas y las iniciales son siempre HTML/SVG; la textura y la ornamentación van en capas `aria-hidden`.
// Estilos en `styles/primitives.css`, construidos sobre los tokens de `library-refresh.css`.

/** Papel crema limpio (con o sin la textura del cuaderno). */
export function PaperSurface({ as: Tag = 'div', tone = 'paper', className = '', children, ...rest }) {
  return (
    <Tag className={`paper-surface ${className}`} data-tone={tone} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * Cuaderno de una página: encuadernación a la izquierda, cantos de hojas a la derecha y el papel en el centro.
 * El contenido nunca se estira con la ilustración: el centro crece con el texto y los márgenes son capas.
 */
export function NotebookShell({ className = '', children, ...rest }) {
  return (
    <div className={`notebook-shell ${className}`} {...rest}>
      <span className="notebook-shell__binding" aria-hidden="true" />
      <div className="notebook-shell__page">{children}</div>
      <span className="notebook-shell__edges" aria-hidden="true" />
    </div>
  );
}

/**
 * Cinta de tela con extremo en V. El recorte en V se aplica a la capa visual (`::before`), nunca al botón:
 * el foco y el área táctil quedan enteros.
 */
export function FabricTab({ selected, tone = 'linen', className = '', children, ...rest }) {
  return (
    <button type="button" role="radio" aria-checked={selected} className={`fabric-tab ${className}`} data-tone={tone} {...rest}>
      <span className="fabric-tab__label">{children}</span>
    </button>
  );
}

/** Dos anillas de latón de las que cuelga una placa. */
function Rings() {
  return (
    <svg className="hanging-plaque__rings" viewBox="0 0 120 16" preserveAspectRatio="none" aria-hidden="true">
      <circle cx="16" cy="6" r="4.2" />
      <circle cx="104" cy="6" r="4.2" />
    </svg>
  );
}

/**
 * Placa de latón mate colgada de dos anillas. `as="button"` para que sea un control (balancea al pulsar);
 * `as="span"` para las señales decorativas de la habitación.
 */
export function HangingPlaque({ as: Tag = 'span', className = '', children, ...rest }) {
  return (
    <Tag className={`hanging-plaque ${className}`} {...(Tag === 'button' ? { type: 'button' } : null)} {...rest}>
      <Rings />
      <span className="hanging-plaque__plate">{children}</span>
    </Tag>
  );
}

/** Sello de lacre con una inicial (o un brote) en SVG. `stamped` lanza el estampado una vez. */
export function WaxSeal({ initial, size = 44, stamped = false, className = '', label }) {
  return (
    <svg className={`wax-seal ${className}`} data-stamped={stamped || undefined} width={size} height={size} viewBox="0 0 48 48" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
      <path className="wax-seal__drip" d="M24 2c5 0 7 3 11 4s7 4 7 9 3 6 3 10-3 6-4 10-5 6-9 7-6 4-8 4-5-3-9-4-7-4-8-8-4-6-4-10 3-5 3-9 3-8 7-9 6-4 11-4z" />
      <circle className="wax-seal__ring" cx="24" cy="24" r="14" />
      {initial ? (
        <text x="24" y="30" textAnchor="middle" className="wax-seal__initial">
          {initial}
        </text>
      ) : (
        <path className="wax-seal__sprig" d="M24 33V17m0 6c-3-1-5-3-6-6m6 10c3-1 5-3 6-6m-6 0c-2-1-3-3-3-5" />
      )}
    </svg>
  );
}

/** Recorte de papel con una marca de color y su etiqueta (nunca solo color). */
export function AnnotationCard({ hex, ink, as: Tag = 'article', className = '', children, ...rest }) {
  return (
    <Tag className={`annotation-card ${className}`} style={{ '--marker': hex, '--marker-ink': ink }} {...rest}>
      <span className="annotation-card__mark" aria-hidden="true" />
      {children}
    </Tag>
  );
}

/** Hoja de correspondencia con clip pequeño (la carta de `letter.webp` en nueve cortes). */
export function ReviewLetter({ clip = true, className = '', children, ...rest }) {
  return (
    <div className={`review-letter ${className}`} {...rest}>
      {clip && (
        <svg className="review-letter__clip" viewBox="0 0 28 44" aria-hidden="true">
          <path d="M9 40V9a5 5 0 0 1 10 0v26a3 3 0 0 1-6 0V12" />
        </svg>
      )}
      {children}
    </div>
  );
}

/**
 * Adorno estético elegido bajo el avatar (SPEC §28.10). Es una preferencia visual: no concede permisos ni
 * significa un premio. SVG propio hasta tener las piezas ilustradas (docs/design/pending).
 */
export const ADORNMENTS = {
  cerezo: { name: 'Cerezo en flor', leaf: '#8E9B6B', accent: '#E3A7A9' },
  'dark-academia': { name: 'Dark Academia', leaf: '#5E4A35', accent: '#8C2F39' },
  constelaciones: { name: 'Entre constelaciones', leaf: '#4D5E7A', accent: '#C9A65A' },
  'jardin-cartas': { name: 'Jardín de cartas', leaf: '#7C8B62', accent: '#D99A8F' },
  'bosque-tinta': { name: 'Bosque de tinta', leaf: '#56684A', accent: '#A9824F' },
};
export const ADORNMENT_IDS = Object.keys(ADORNMENTS);

export function ReaderAdornment({ id, className = '' }) {
  const a = ADORNMENTS[id];
  if (!a) return null;
  const leaves = [-62, -44, -26, 26, 44, 62];
  return (
    <svg className={`reader-adornment ${className}`} data-adornment={id} viewBox="0 0 120 44" aria-hidden="true">
      <path d="M10 6 Q60 52 110 6" fill="none" stroke={a.leaf} strokeWidth="2" strokeLinecap="round" />
      {leaves.map((deg) => {
        const x = 60 + deg * 0.78;
        const y = 6 + (1 - Math.abs(deg) / 70) * 24 + 4;
        // Hoja apuntada (dos curvas), girada siguiendo la rama
        return <path key={deg} d={`M${x - 7} ${y}q7 -5.5 14 0q-7 5.5 -14 0z`} fill={a.leaf} opacity="0.9" transform={`rotate(${deg > 0 ? -28 : 28} ${x} ${y})`} />;
      })}
      {id === 'constelaciones' ? (
        <path d="M60 30a7 7 0 1 0 6 10 6 6 0 1 1-6-10z" fill={a.accent} />
      ) : id === 'dark-academia' ? (
        <path d="M54 30h12v10H54z M54 30l6 4 6-4" fill="none" stroke={a.accent} strokeWidth="1.8" />
      ) : id === 'bosque-tinta' ? (
        <path d="M60 30c-6-6-12 0-6 4-6 2-2 8 6 4 8 4 12-2 6-4 6-4 0-10-6-4z" fill={a.accent} />
      ) : (
        <g fill={a.accent}>
          {[0, 72, 144, 216, 288].map((r) => (
            <ellipse key={r} cx="60" cy="31" rx="3" ry="5" transform={`rotate(${r} 60 36)`} />
          ))}
        </g>
      )}
    </svg>
  );
}
