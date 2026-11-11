// 1.117 (§117) · La cita de lectura de la sala: lo que dice el servidor (amigos, invitaciones, tu cita y su hora) y lo
// que se le pide. Se mira cada poco mientras la sala está a la vista; sin la migración, `disponible` es false y la sala
// sigue como antes.
import { useCallback, useEffect, useRef, useState } from 'react';
import { salaCitaDejar, salaCitaInvitar, salaCitaLatido, salaCitaResponder, salaCitas } from '../service';

const CITA_MS = 15000;

export function useCitaSala(enabled) {
  // undefined: aún no se sabe; null: sin la migración
  const [datos, setDatos] = useState(undefined);
  const desfase = useRef(0);
  const vivo = useRef(true);
  useEffect(() => {
    // En modo estricto el efecto se monta dos veces: al volver a montarse, vuelve a estar vivo
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);
  const poner = useCallback((r) => {
    if (!vivo.current) return r;
    if (r && Number.isFinite(r.ahora)) desfase.current = r.ahora - Date.now();
    setDatos(r);
    return r;
  }, []);
  const refrescar = useCallback(() => salaCitas().then(poner, () => undefined), [poner]);

  useEffect(() => {
    if (!enabled) return undefined;
    let parado = false;
    const mirar = () => {
      if (document.hidden || parado) return;
      refrescar().then((r) => {
        if (r === null) parado = true;
      });
    };
    mirar();
    const t = setInterval(mirar, CITA_MS);
    document.addEventListener('visibilitychange', mirar);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', mirar);
    };
  }, [enabled, refrescar]);

  const tras = (p) => p.then(refrescar);
  const invitar = (amigo, en, minutos) => tras(salaCitaInvitar(amigo, en, minutos));
  const responder = (cita, acepta) => tras(salaCitaResponder(cita, acepta));
  const dejar = (cita) => tras(salaCitaDejar(cita));
  // El latido devuelve la cita al día (con «juntos» y si el otro está en el sofá)
  const latido = (cita) =>
    salaCitaLatido(cita).then(
      (c) => vivo.current && c && setDatos((d) => (d && d.mia?.cita === c.cita ? { ...d, mia: { ...d.mia, ...c } } : d)),
      () => {},
    );

  return {
    disponible: Boolean(enabled && datos),
    amigos: datos?.amigos ?? [],
    invitaciones: datos?.invitaciones ?? [],
    mia: datos?.mia ?? null,
    /** La hora del servidor, según este reloj. */
    ahora: () => Date.now() + desfase.current,
    invitar,
    responder,
    dejar,
    latido,
    refrescar,
  };
}
