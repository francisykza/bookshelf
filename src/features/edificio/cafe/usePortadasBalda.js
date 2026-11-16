// 1.140: las portadas de los libros de cara de la estantería (uno por sección, `destacadosDe`), en píxeles, por clave. Las que
// no cargan se quedan con su tapa de color. Si la portada no está, la de su misma edición por el ISBN (como el escaparate).
import { useEffect, useMemo, useState } from 'react';
import { destacadosDe } from './cafeLibreria';
import { portadaPixel } from './cafePortadas';
import { portadaPorIsbn } from './cafePortadaIsbn';

export function usePortadasBalda(balda) {
  const [portadas, setPortadas] = useState({});
  const clave = useMemo(
    () =>
      destacadosDe(balda ?? [])
        .map((d) => `${d.clave}~${d.cover || ''}~${(balda ?? []).find((b) => b.clave === d.clave)?.isbn || ''}`)
        .join('|'),
    [balda],
  );
  useEffect(() => {
    let vivo = true;
    const pares = clave ? clave.split('|').map((p) => p.split('~')) : [];
    Promise.all(
      pares.map(([k, u, isbn]) =>
        portadaPixel(u || null)
          .then((p) => p ?? (isbn ? portadaPorIsbn(isbn).then((otra) => portadaPixel(otra || null)) : null))
          .then((lienzo) => [k, lienzo]),
      ),
    ).then((r) => vivo && setPortadas(Object.fromEntries(r.filter(([, l]) => l))));
    return () => {
      vivo = false;
    };
  }, [clave]);
  return portadas;
}
