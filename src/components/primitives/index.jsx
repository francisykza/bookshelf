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
 * Adorno estético elegido bajo el avatar (SPEC §28.10, §31.3). Es una preferencia visual: no concede permisos ni
 * significa un premio. Ilustración de /assets/bookshelf/profile/adornments: un arco que se dimensiona respecto al
 * avatar (lo coloca su contenedor), nunca al ancho de la ficha.
 */
export const ADORNMENTS = {
  cerezo: { name: 'Cerezo en flor', art: '/assets/bookshelf/profile/adornments/avatar-adornment-cherry.webp', ratio: 480 / 202 },
  'dark-academia': { name: 'Dark Academia', art: '/assets/bookshelf/profile/adornments/avatar-adornment-dark-academia.webp', ratio: 480 / 217 },
  constelaciones: { name: 'Entre constelaciones', art: '/assets/bookshelf/profile/adornments/avatar-adornment-constellations.webp', ratio: 480 / 183 },
  'jardin-cartas': { name: 'Jardín de cartas', art: '/assets/bookshelf/profile/adornments/avatar-adornment-letter-garden.webp', ratio: 480 / 237 },
  'bosque-tinta': { name: 'Bosque de tinta', art: '/assets/bookshelf/profile/adornments/avatar-adornment-ink-forest.webp', ratio: 480 / 208 },
};
export const ADORNMENT_IDS = Object.keys(ADORNMENTS);

export function ReaderAdornment({ id, className = '' }) {
  const a = ADORNMENTS[id];
  if (!a) return null;
  return <img className={`reader-adornment ${className}`} data-adornment={id} src={a.art} alt="" width="480" height={Math.round(480 / a.ratio)} decoding="async" draggable={false} />;
}
