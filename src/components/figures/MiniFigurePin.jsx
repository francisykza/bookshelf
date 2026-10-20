// Mini-figura de saga (SPEC §7.4, 1.15.0): un pin coleccionable de 34 × 34 px engarzado en el listón de la
// balda, bajo cada libro de la saga de una figura. Con halo dorado si ya la tienes; en silueta apagada con
// candado si aún no. Clic → esa figura en El Ático del Coleccionista.
import { PinArt } from './FigureArt';

export function MiniFigurePin({ fig, owned, onOpen }) {
  const tip = `Guardián de esta saga: ${fig.name} (Sinergia x2 Pity)`;
  return (
    <button
      type="button"
      className="saga-pin"
      data-owned={owned}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(fig.id);
      }}
      aria-label={`${tip}${owned ? '' : ' · aún por descubrir'}. Abrir en el Ático`}
    >
      <PinArt fig={fig} />
      {!owned && (
        <svg className="saga-pin__lock" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4.5 7V5.2a3.5 3.5 0 0 1 7 0V7" fill="none" stroke="#d4a94a" strokeWidth="1.4" />
          <rect x="3" y="7" width="10" height="7" rx="1.6" fill="#2a1d10" stroke="#d4a94a" strokeWidth="1.1" />
          <circle cx="8" cy="10.4" r="1.2" fill="#d4a94a" />
        </svg>
      )}
      <span className="saga-pin__tip" role="tooltip">
        {tip}
      </span>
    </button>
  );
}
