// Panel de papel de la radio del rincón (1.62, SPEC §62.3), abierto al tocar la radio de la mesa del salón. Cerrarlo
// (X, Escape, tocar fuera o Atrás) no para la música: el reproductor es de toda la app.
import { X } from 'lucide-react';
import { useId } from 'react';
import { PanelShell } from '../../components/panels/PanelShell';
import { RadioControls } from './RadioControls';

export function RadioPanel({ onClose, soundOn, onToggleSound }) {
  const titleId = useId();
  return (
    <PanelShell onClose={onClose} label="La radio del rincón" variant="radio">
      <button type="button" className="radio-panel__close" onClick={onClose} aria-label="Cerrar la radio">
        <X aria-hidden="true" />
      </button>
      <RadioControls titleId={titleId} soundOn={soundOn} onToggleSound={onToggleSound} />
    </PanelShell>
  );
}
