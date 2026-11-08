// La visita en primera persona a otro piso (1.89, SPEC §89). Es la misma habitación 3D, con el piso real de quien vive ahí tal
// como llega del portal. Quien visita y quien vive son dos cuentas distintas: aquí no entra nada de tu biblioteca ni de tu
// piso, no hay Registrar ni Decorar y no se guarda nada. Los libros son solo los que esa persona comparte (`sharedBooks`, con
// los permisos de su rincón); sin libros compartidos, su estantería se ve vacía, nunca rellena con otros.
import { useMemo, useRef, useState } from 'react';
import { useCommunity } from '../social/hooks/useCommunity';
import { useReaderCorner } from '../social/hooks/useReaderCorner';
import { sharedBooks } from '../social/visit';
import { Interior } from './PisoLabPanel';
import { shelfRows } from './shelfLayout';
import { pisoFrom, withDoorAndComputer } from './useMyPiso';

const VACIA = { cover: null, rows: [[], [], []], hidden: [], placed: 0 };
const SIGUE = { tarde: { hora: 'noche', label: 'Ver de noche' }, noche: { hora: 'dia', label: 'Ver de día' }, dia: { hora: 'tarde', label: 'Ver al atardecer' } };

const nada = () => {};

export default function VisitaPiso({ vecino, edificio, onVolver, onIso }) {
  const community = useCommunity();
  const corner = useReaderCorner(vecino.user_id, community);
  const [hora, setHora] = useState('tarde');
  const yawMemory = useRef(0);
  const apiRef = useRef(null);
  // Solo en desarrollo: al salir, las pruebas vuelven a ver tu habitación, que sigue montada debajo
  const previo = useRef(import.meta.env.DEV ? window.__pisoLab : null);
  const onApi = (api) => {
    apiRef.current = api;
    if (import.meta.env.DEV) window.__pisoLab = api ? () => apiRef.current : previo.current;
  };
  const piso = useMemo(
    () => ({ ...pisoFrom(vecino.user_id, { edificio, puerta: vecino.puerta }), id: `visita:${vecino.user_id}`, real: false, propio: false, nombre: `Piso de ${vecino.alias ?? 'tu vecino'}` }),
    [vecino.user_id, vecino.alias, vecino.puerta, edificio],
  );
  const room = useMemo(() => withDoorAndComputer(vecino.room), [vecino.room]);
  const shelf = useMemo(() => {
    if (corner.status !== 'ready' || !corner.data) return VACIA;
    const { all } = sharedBooks({ ownerId: vecino.user_id, corner: corner.data.corner, collections: corner.data.collections ?? [] });
    const books = all.map((it) => ({ id: it.key, title: it.ref.title, author: it.ref.author, cover: it.ref.cover, status: 'read' }));
    return shelfRows(books, {}) ?? VACIA;
  }, [corner.status, corner.data, vecino.user_id]);

  return (
    <div className="ed-visita3d" data-visita={vecino.user_id}>
      <Interior piso={piso} room={room} hora={hora} reading={null} balda={null} covered={false} leaning={false} listing={false} yawMemory={yawMemory} hint={null} shelfBooks={shelf} onBook={nada} onShelf={nada} onOpenBook={nada} onLost={onIso} onApi={onApi} onDesk={nada} onDoor={onVolver} />
      <button type="button" className="ed-visita3d__hora" onClick={() => setHora(SIGUE[hora].hora)}>
        {SIGUE[hora].label}
      </button>
    </div>
  );
}
