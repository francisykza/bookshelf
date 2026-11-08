// El marco único del ordenador del piso: carcasa fina de monitor y, dentro, una barra de título y una sola pantalla. En el escritorio,
// «Mi escritorio» y cerrar; dentro de una función, flecha al escritorio, su nombre y cerrar. Sin ventanitas.
import { PixelControl } from '../../ui/PixelIcon';

export function ComputerShell({ title, onBack, backLabel = 'Volver al escritorio', onClose, children }) {
  return (
    <div className="port-computer">
      <div className="pp-glass">
        <header className="port-computer__head">
          {onBack && (
            <button type="button" className="pp-os-btn" onClick={onBack} aria-label={backLabel}>
              <PixelControl name="back" />
            </button>
          )}
          <h2 data-centered={onBack ? '' : undefined}>{title}</h2>
          <button type="button" className="pp-os-btn" onClick={onClose} aria-label="Salir del ordenador">
            <PixelControl name="close" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
