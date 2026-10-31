// 1.59 (SPEC §59): instrumentación de rendimiento, solo en desarrollo. Cada <Profiler> suma sus commits y el tiempo
// real de render en `window.__bsPerf[id]`; el script `scripts/perf-large-library.mjs` lo lee para comparar antes y
// después en las mismas condiciones. En producción no envuelve nada.
import { Profiler } from 'react';

function onRender(id, _phase, actualDuration) {
  const all = (window.__bsPerf ??= {});
  const entry = (all[id] ??= { commits: 0, ms: 0 });
  entry.commits += 1;
  entry.ms += actualDuration;
}

export function PerfProfiler({ id, children }) {
  if (!import.meta.env.DEV) return children;
  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}
