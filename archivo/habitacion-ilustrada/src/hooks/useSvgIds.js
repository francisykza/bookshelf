// Identificadores SVG únicos por instancia (SPEC §11.2, 1.17.0): máscaras, filtros, gradientes y recortes no
// chocan aunque un componente se monte dos veces. `sid('f-sea')` da el id y `sid.url('f-sea')` la referencia.
import { useId, useMemo } from 'react';

export function useSvgIds() {
  const raw = useId();
  return useMemo(() => {
    const prefix = `s${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    return Object.assign((name) => `${prefix}-${name}`, {
      url: (name) => `url(#${prefix}-${name})`,
      href: (name) => `#${prefix}-${name}`,
    });
  }, [raw]);
}
