// Carta de algodón y lacre (SPEC §4ter, 1.12.0): presentación de alta papelería para las citas, tanto la del
// sobre lacrado de Miel como las que subrayas en tus libros. Papel de algodón marfil con bordes rasgados a
// mano, ramita de olivo prensada sujeta con washi, comillas capitulares en pan de oro, texto que aparece
// palabra a palabra como tinta húmeda y un sello de lacre con las iniciales del autor.
import { BookmarkPlus, Check, Pin, Share2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { hash } from '../../domain/books';

/** Bordes rasgados (deckle): un polígono con el contorno ligeramente irregular, distinto en cada carta. */
function deckle(seed, n = 18) {
  let s = seed || 1;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const pts = [];
  const j = (v) => (r() - 0.5) * v;
  for (let i = 0; i <= n; i += 1) pts.push([(i / n) * 100, 0.6 + j(1.2)]);
  for (let i = 1; i <= n; i += 1) pts.push([99.4 + j(1.2), (i / n) * 100]);
  for (let i = n - 1; i >= 0; i -= 1) pts.push([(i / n) * 100, 99.4 + j(1.2)]);
  for (let i = n - 1; i > 0; i -= 1) pts.push([0.6 + j(1.2), (i / n) * 100]);
  return `polygon(${pts.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(', ')})`;
}

const initialsOf = (author = '') =>
  author
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && w[0] === w[0].toUpperCase())
    .slice(0, 2)
    .map((w) => w[0])
    .join('') || '❦';

/** Ramita de olivo prensada. */
function OliveSprig() {
  return (
    <svg className="equote__sprig" viewBox="0 0 90 60" aria-hidden="true">
      <path d="M4 54 C24 40 44 28 86 8" stroke="#6b5a3a" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {[
        [16, 46, -38, 1],
        [22, 42, 30, -1],
        [32, 36, -32, 1],
        [40, 31, 34, -1],
        [50, 26, -28, 1],
        [58, 21, 36, -1],
        [68, 16, -24, 1],
        [76, 12, 40, -1],
      ].map(([x, y, a, side]) => (
        <ellipse
          key={x}
          cx={x + side * 3}
          cy={y - 5}
          rx="9"
          ry="2.6"
          fill={side > 0 ? '#7f9466' : '#9aab84'}
          stroke="#5d6e48"
          strokeWidth="0.5"
          transform={`rotate(${a} ${x} ${y})`}
          opacity="0.92"
        />
      ))}
      <circle cx="44" cy="35" r="2.6" fill="#3d3a52" />
      <circle cx="62" cy="24" r="2.2" fill="#4a4660" />
    </svg>
  );
}

/** Sello de lacre en relieve con las iniciales en dorado. */
function WaxSeal({ initials, seed }) {
  const blob = useMemo(() => {
    const pts = [];
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      const r = 20 + ((seed >> i) & 3) * 0.9;
      pts.push(`${(24 + Math.cos(a) * r).toFixed(1)},${(24 + Math.sin(a) * r).toFixed(1)}`);
    }
    return pts.join(' ');
  }, [seed]);
  return (
    <svg className="equote__seal" viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <radialGradient id={`wax-${seed}`} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#c8332b" />
          <stop offset="0.55" stopColor="#8e1a17" />
          <stop offset="1" stopColor="#560c0b" />
        </radialGradient>
        <linearGradient id={`gold-${seed}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.5" stopColor="#c59b27" />
          <stop offset="1" stopColor="#7a5c12" />
        </linearGradient>
      </defs>
      <polygon points={blob} fill={`url(#wax-${seed})`} />
      <circle cx="24" cy="24" r="14.5" fill="none" stroke="#5a0d0b" strokeWidth="1.6" opacity="0.7" />
      <circle cx="24" cy="24" r="13" fill="none" stroke="#e2675c" strokeWidth="0.7" opacity="0.45" />
      <text x="24" y="28.5" textAnchor="middle" className="equote__seal-text" fill={`url(#gold-${seed})`}>
        {initials}
      </text>
    </svg>
  );
}

/** `short`: rótulos breves de las acciones (Guardar · Compartir · Fijar), con el nombre completo como nombre accesible. */
export function ElegantQuoteCard({ text, author, work, onSave, saved = false, saveLabel = 'Guardar en mi Diario', onPin, pinned = false, compact = false, animate = true, short = false }) {
  const seed = hash(`${text}${author}`) % 100000 || 7;
  const clip = useMemo(() => deckle(seed), [seed]);
  const words = text.split(/\s+/);
  const [shared, setShared] = useState(null);

  const share = async () => {
    const body = `“${text}” — ${author}${work ? `, ${work}` : ''}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Una cita de BookShelf', text: body });
        setShared('Compartida');
      } else {
        await navigator.clipboard.writeText(body);
        setShared('Copiada al portapapeles');
      }
    } catch {
      setShared(null);
    }
  };

  return (
    <figure className="equote" data-compact={compact || undefined} style={{ '--tilt': `${((seed % 7) - 3) * 0.35}deg` }}>
      <div className="equote__paper" style={{ clipPath: clip }}>
        <span className="equote__mark equote__mark--open" aria-hidden="true">
          “
        </span>
        <blockquote className="equote__text" data-animate={animate || undefined}>
          {words.map((w, i) => (
            <span key={`${w}-${i}`} style={{ animationDelay: `${120 + i * 70}ms` }}>
              {w}{' '}
            </span>
          ))}
        </blockquote>
        <span className="equote__mark equote__mark--close" aria-hidden="true">
          ”
        </span>
        <span className="equote__rule" aria-hidden="true" />
        <figcaption className="equote__by">
          <b>{author}</b>
          {work && <span>{work}</span>}
        </figcaption>
        <WaxSeal initials={initialsOf(author)} seed={seed} />
      </div>
      {/* Ramita prensada sujeta con un trocito de washi translúcida */}
      <OliveSprig />
      <span className="equote__washi" aria-hidden="true" />

      {!compact && (
        <div className="equote__actions">
          {onSave && (
            <button type="button" className="equote__btn" onClick={onSave} disabled={saved} aria-label={short ? (saved ? 'Guardada en tu Diario' : saveLabel) : undefined}>
              {saved ? <Check aria-hidden="true" /> : <BookmarkPlus aria-hidden="true" />}
              {saved ? (short ? 'Guardada' : 'Guardada en tu Diario') : short ? 'Guardar' : saveLabel}
            </button>
          )}
          {onPin && (
            <button type="button" className="equote__btn" onClick={onPin} aria-pressed={pinned} aria-label={short ? (pinned ? 'Clavada en tu estantería' : 'Dejar clavada en la estantería') : undefined}>
              <Pin aria-hidden="true" />
              {pinned ? (short ? 'Fijada' : 'Clavada en tu estantería') : short ? 'Fijar' : 'Dejar clavada en la estantería'}
            </button>
          )}
          <button type="button" className="equote__btn" onClick={share} aria-label={short && !shared ? 'Compartir tarjeta' : undefined}>
            <Share2 aria-hidden="true" />
            {shared ?? (short ? 'Compartir' : 'Compartir tarjeta')}
          </button>
        </div>
      )}
    </figure>
  );
}
