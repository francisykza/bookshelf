// Ficha informativa del Guardián expuesto en un sillón del salón (SPEC §25.9): nombre, saga y subtítulo de la
// figura del catálogo público. Solo informa: no abre el Ático de nadie ni toca colecciones, sellos o pity.
import { PanelShell } from '../../../components/panels/PanelShell';
import { PinArt } from '../../../components/figures/FigureArt';
import { useFigureCatalog } from '../../../components/figures/figureCatalog';

export function GuardianCard({ figureId, onClose }) {
  const fig = useFigureCatalog().find((f) => f.id === figureId);
  return (
    <PanelShell onClose={onClose} label="Guardián de lectura" variant="social">
      <div className="social-hub guardian-card">
        <div className="social-hub__head">
          <h2>Guardián de lectura</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="social-hub__body">
          {fig ? (
            <div className="profile-form__me">
              <span className="saga-pin" data-owned aria-hidden="true">
                <PinArt fig={fig} />
              </span>
              <div>
                <h3 className="social-title">{fig.name}</h3>
                {fig.sagaTitle && <p className="social-note">{fig.sagaTitle}</p>}
                {fig.subtitle && <p className="social-hand">{fig.subtitle}</p>}
              </div>
            </div>
          ) : (
            <p className="social-note">Cargando la figura…</p>
          )}
        </div>
      </div>
    </PanelShell>
  );
}
