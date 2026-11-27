// 1.153 · Lo que tus amigos ven de tu lectura, al día: desde que abres Amigos por primera vez en este aparato, cuando cambia tu
// biblioteca (empiezas, avanzas o terminas un libro) la app lo manda unos segundos después, solo si ha cambiado. Sin comunidad,
// sin sesión o sin la migración, no hace nada.
import { useEffect } from 'react';
import { useLibrary } from '../../../state/useLibrary';
import { useCommunity } from '../hooks/useCommunity';
import { amigosActivo } from '../amigosLectura';
import { publicarLectura } from '../services/amigos';

const ESPERA = 4000;

export function AmigosSync() {
  const { state } = useLibrary();
  const community = useCommunity();
  const uid = community.userId;
  const activo = Boolean(uid && amigosActivo(uid));
  useEffect(() => {
    if (activo && community.status === 'idle') community.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, community.status]);
  useEffect(() => {
    if (!activo || community.status !== 'ready' || !community.member) return undefined;
    const t = setTimeout(() => publicarLectura(uid, state.books).catch(() => {}), ESPERA);
    return () => clearTimeout(t);
  }, [activo, community.status, community.member, uid, state.books]);
  return null;
}
