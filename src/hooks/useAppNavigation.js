// Navegación de la app sobre la History API (SPEC §13.3): un único navegador y un único listener de
// `popstate` para toda la sesión. La ubicación vive en el estado de React solo para pintar.
import { useEffect, useMemo, useState } from 'react';
import { createNavigator } from '../domain/navigation';

export function useAppNavigation() {
  // El navegador se crea una sola vez; avisa a React mediante un oyente que se engancha al montar
  const [core] = useState(() => {
    let listener = () => {};
    const navigator = createNavigator(window.history, (loc) => listener(loc));
    return { navigator, listen: (fn) => (listener = fn) };
  });
  const [location, setLocation] = useState(() => core.navigator.current());

  useEffect(() => {
    core.listen(setLocation);
    const onPop = (event) => core.navigator.pop(event.state);
    window.addEventListener('popstate', onPop);
    return () => {
      core.listen(() => {});
      window.removeEventListener('popstate', onPop);
    };
  }, [core]);

  const nav = useMemo(
    () => ({
      go: (to, options) => core.navigator.go(to, options),
      back: () => core.navigator.back(),
      replace: (to) => core.navigator.go(to, { replace: true }),
    }),
    [core],
  );
  return { location, nav };
}
