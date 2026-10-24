// Día local de hoy (`YYYY-MM-DD` con `dayKey`, nunca `toISOString()`), que cambia solo a medianoche y al volver
// a la app tras tenerla oculta. Un único temporizador hasta la próxima medianoche; todo se limpia al desmontar.
import { useEffect, useState } from 'react';
import { dayKey } from '../domain/dates';

export function useToday() {
  const [today, setToday] = useState(() => dayKey());
  useEffect(() => {
    let timer = 0;
    const sync = () => setToday((prev) => (prev === dayKey() ? prev : dayKey()));
    const schedule = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      timer = window.setTimeout(() => {
        sync();
        schedule();
      }, next - now);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return today;
}
