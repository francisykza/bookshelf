// Las misiones semanales pagan en tickets de la tienda del bajo (1.67, SPEC §67). La app sigue calculando qué misión
// está cumplida (como siempre); cobrarla lo hace el servidor, una vez por misión y semana. Hace falta la comunidad
// activada y la migración de la tienda; si no, `status` lo dice y no se cobra nada (la misión no se «gasta»).
import { useEffect, useState } from 'react';
import { weekKey } from '../../domain/dates';
import { useCommunity } from '../social/hooks/useCommunity';
import { loadInventario, reclamarMision } from './service';

/** { status: 'loading' | 'signed-out' | 'no-community' | 'soon' | 'ready', tickets, cobrada(id), cobrar(id) } */
export function useMissionTickets() {
  const community = useCommunity({ autoload: true });
  const member = community.status === 'ready' && community.member;
  const [inv, setInv] = useState(undefined);
  const week = weekKey();

  useEffect(() => {
    if (!member) return undefined;
    let alive = true;
    loadInventario().then(
      (i) => alive && setInv(i),
      () => alive && setInv(null),
    );
    return () => {
      alive = false;
    };
  }, [member]);

  let status = 'loading';
  if (['signed-out', 'off'].includes(community.status)) status = 'signed-out';
  else if (['unavailable', 'error'].includes(community.status)) status = 'soon';
  else if (community.status === 'ready' && !community.member) status = 'no-community';
  else if (member && inv === null) status = 'soon';
  else if (member && inv) status = inv.tienda ? 'ready' : 'soon';

  return {
    status,
    tickets: inv?.tickets ?? 0,
    cobrada: (id) => Boolean(inv?.reclamadas.includes(`mision:${id}:${week}`)),
    async cobrar(id) {
      const next = await reclamarMision(id, week);
      setInv(next);
      return next;
    },
  };
}
