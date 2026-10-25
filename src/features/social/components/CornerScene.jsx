// Rincón ilustrado del perfil (SPEC §28.10): la escena 3:2 completa (sin recortar) en su variante de día, lluvia
// o noche; tres libros en la balda superior, una figura en el nicho y hasta tres recuerdos en la mesa, en
// coordenadas relativas calibradas sobre el recurso (CORNER_LAYOUT). Nombre, avatar y botones van fuera.
import { Cover } from '../../../components/shelf/BookItem';
import { FigureArt } from '../../../components/figures/FigureArt';
import { CORNER_LAYOUT, MEMORY_OBJECTS, SCENES, sceneOf } from '../huellas';

const pct = (v) => `${(v * 100).toFixed(3)}%`;

/** Pictogramas provisionales (honestos) para los recuerdos sin ilustración propia todavía. */
function MemoryGlyph({ object }) {
  const stroke = { fill: 'none', stroke: '#5c4521', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="memory-glyph">
      {object === 'barquito' && (
        <g>
          <path d="M8 46h48l-7 9H15z" fill="#8a5a36" {...stroke} />
          <path d="M31 10v34M31 12l16 28H31zM29 18L15 40h14z" fill="#f3ead6" {...stroke} />
        </g>
      )}
      {object === 'planta' && (
        <g>
          <path d="M18 40h28l-4 18H22z" fill="#c98f63" {...stroke} />
          <path d="M32 40c0-10-2-18-10-24M32 40c0-12 4-20 12-26M32 40c-2-8-10-10-16-8" fill="none" {...stroke} stroke="#4f5a43" />
          <ellipse cx="21" cy="17" rx="6" ry="3" fill="#78866b" transform="rotate(-35 21 17)" />
          <ellipse cx="44" cy="15" rx="6" ry="3" fill="#78866b" transform="rotate(30 44 15)" />
          <ellipse cx="17" cy="32" rx="5" ry="2.6" fill="#78866b" transform="rotate(10 17 32)" />
        </g>
      )}
      {object === 'tintero' && (
        <g>
          <path d="M20 34h24v20H20z" fill="#2f3a4a" {...stroke} />
          <path d="M25 28h14v6H25z" fill="#6f8793" {...stroke} />
          <path d="M40 30L54 6c2 4 0 10-6 14z" fill="#f3ead6" {...stroke} />
        </g>
      )}
      {object === 'mapa' && (
        <g>
          <path d="M8 18l14-5 18 5 16-5v34l-16 5-18-5-14 5z" fill="#e8d8b9" {...stroke} />
          <path d="M22 13v34M40 18v34" {...stroke} />
          <path d="M14 30c6-4 10 4 16 0s10 4 18-2" {...stroke} stroke="#a84f34" strokeDasharray="2 3" />
        </g>
      )}
    </svg>
  );
}

export function MemoryObject({ object }) {
  const m = MEMORY_OBJECTS[object];
  if (!m) return null;
  return m.art ? <img src={m.art} alt="" className="memory-object__art" loading="lazy" decoding="async" /> : <MemoryGlyph object={object} />;
}

export function CornerScene({ corner, figure, onOpenMemory, ownerAlias }) {
  const scene = SCENES[sceneOf(corner?.scene)];
  const books = (corner?.featured_books ?? []).slice(0, 3);
  const memories = (corner?.memories ?? []).slice(0, 3);
  const { shelf, niche, table } = CORNER_LAYOUT;
  const span = shelf.right - shelf.left;
  return (
    <figure className="corner-scene" aria-label={`El rincón de ${ownerAlias}`}>
      <img
        className="corner-scene__base"
        src={`${scene.src}-768.webp`}
        srcSet={`${scene.src}-768.webp 768w, ${scene.src}-1536.webp 1536w`}
        sizes="(min-width: 900px) 760px, 100vw"
        width="1536"
        height="1024"
        alt=""
        decoding="async"
      />
      {/* Balda superior: hasta tres libros apoyados en su línea */}
      <ul className="corner-scene__shelf" aria-label="Libros en su balda">
        {books.map((b, i) => (
          <li key={b.id} style={{ left: pct(shelf.left + span * (0.08 + i * 0.3)), bottom: pct(1 - shelf.base), height: pct(shelf.maxH * 0.92) }}>
            <span className="corner-scene__book" title={`${b.title} · ${b.author}`}>
              <Cover book={b} />
            </span>
            <span className="sr-only-focus">
              {b.title}, de {b.author}
            </span>
          </li>
        ))}
      </ul>
      {figure && (
        <div className="corner-scene__niche" style={{ left: pct((niche.left + niche.right) / 2), bottom: pct(1 - niche.base), height: pct(niche.maxH) }}>
          <FigureArt fig={figure} display="box" />
          <span className="sr-only-focus">Figura expuesta: {figure.name}</span>
        </div>
      )}
      {/* Mesa: hasta tres recuerdos elegidos; se abren para ver su historia */}
      <ul className="corner-scene__table" aria-label="Recuerdos expuestos">
        {memories.map((m, i) => (
          <li key={m.id} style={{ left: pct(table.slots[i]), bottom: pct(1 - table.base), height: pct(table.maxH * (m.object === 'mapa' ? 0.55 : 1)) }}>
            <button type="button" className="corner-scene__memory" onClick={() => onOpenMemory(m)} aria-label={`${MEMORY_OBJECTS[m.object]?.name ?? 'Recuerdo'} de «${m.book?.title ?? ''}»`}>
              <MemoryObject object={m.object} />
            </button>
          </li>
        ))}
      </ul>
      {/* Placa de latón en el canto de la mesa, como en la maqueta (solo si hay recuerdos expuestos) */}
      {memories.length > 0 && (
        <span className="corner-scene__plaque" aria-hidden="true">
          Recuerdos de lectura
        </span>
      )}
    </figure>
  );
}
