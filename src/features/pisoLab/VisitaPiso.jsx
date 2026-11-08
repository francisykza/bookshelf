// La visita en primera persona a otro piso (1.89, SPEC §89). Es la misma habitación 3D, con el piso real de quien vive ahí tal
// como llega del portal. Quien visita y quien vive son dos cuentas distintas: aquí no entra nada de tu biblioteca ni de tu
// piso, no hay Registrar ni Decorar y no se guarda nada. Los libros son solo los que esa persona comparte (`sharedBooks`, con
// los permisos de su rincón); sin libros compartidos, su estantería se ve vacía, nunca rellena con otros.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCommunity } from '../social/hooks/useCommunity';
import { useReaderCorner } from '../social/hooks/useReaderCorner';
import { SharedLibrary, VisitBookSheet } from '../social/components/VisitBookSheet';
import { currentTitle, sharedBooks } from '../social/visit';
import { ROOM_LIMIT } from './roomSelection';
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
  const [grupo, setGrupo] = useState(0);
  const [biblioteca, setBiblioteca] = useState(false);
  const [ficha, setFicha] = useState(null);
  const abrirBiblioteca = useRef(null);
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
  const nombre = vecino.alias ?? 'tu vecino';
  const listo = corner.status === 'ready' && corner.data;
  // Solo lo que esa persona comparte, en el orden en que lo expone; nada se guarda ni se marca por visitarla
  const compartidos = useMemo(() => (listo ? sharedBooks({ ownerId: vecino.user_id, corner: corner.data.corner, collections: corner.data.collections ?? [] }).all : []), [listo, corner.data, vecino.user_id]);
  const grupos = Math.max(1, Math.ceil(compartidos.length / ROOM_LIMIT));
  // Una balda de libros cada vez: el modelo y las portadas siguen acotados aunque la biblioteca sea enorme
  const shelf = useMemo(() => {
    const books = compartidos.slice(grupo * ROOM_LIMIT, (grupo + 1) * ROOM_LIMIT).map((it) => ({ id: it.key, title: it.ref.title, author: it.ref.author, cover: it.ref.cover, status: 'read' }));
    return shelfRows(books, {}) ?? VACIA;
  }, [compartidos, grupo]);
  // «Está leyendo» es solo el título que enseña; la portada, únicamente si ese libro también está entre los compartidos
  const titulo = listo ? currentTitle(corner.data.corner) : null;
  const lectura = useMemo(() => {
    if (!titulo) return null;
    const igual = compartidos.find((it) => it.ref.title === titulo);
    return { id: `visita-lectura:${vecino.user_id}`, title: titulo, author: igual?.ref.author ?? '', cover: igual?.ref.cover ?? '', status: 'reading' };
  }, [titulo, compartidos, vecino.user_id]);
  const fichaAbierta = compartidos.find((it) => it.key === ficha) ?? null;
  // Escape cierra de uno en uno y no llega al panel del edificio
  useEffect(() => {
    if (!biblioteca) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (ficha) setFicha(null);
      else cerrar();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biblioteca, ficha]);
  function cerrar() {
    setBiblioteca(false);
    setFicha(null);
    requestAnimationFrame(() => abrirBiblioteca.current?.focus({ preventScroll: true }));
  }

  return (
    <div className="ed-visita3d" data-visita={vecino.user_id}>
      <Interior piso={piso} room={room} hora={hora} reading={lectura} balda={null} covered={false} leaning={false} listing={false} yawMemory={yawMemory} hint={null} shelfBooks={shelf} onBook={nada} onShelf={nada} onOpenBook={nada} onLost={onIso} onApi={onApi} onDesk={nada} onDoor={onVolver} />
      <button type="button" className="ed-visita3d__hora" onClick={() => setHora(SIGUE[hora].hora)}>
        {SIGUE[hora].label}
      </button>
      <section className="ed-visita3d__datos" aria-label={`Biblioteca de ${nombre}`}>
        {corner.status === 'error' ? (
          <p role="alert">
            No se ha podido cargar lo que comparte.{' '}
            <button type="button" onClick={corner.reload}>
              Reintentar
            </button>
          </p>
        ) : !listo ? (
          <p role="status">Cargando lo que comparte…</p>
        ) : (
          <>
            <p>
              <b>Está leyendo</b> {titulo ?? 'No comparte su lectura actual.'}
            </p>
            <p>
              <b>Biblioteca de {nombre}</b> {compartidos.length ? `${compartidos.length.toLocaleString('es-ES')} ${compartidos.length === 1 ? 'libro compartido' : 'libros compartidos'}` : 'Aún no ha compartido libros.'}
            </p>
            {compartidos.length > 0 && (
              <div className="ed-visita3d__baldas">
                {grupos > 1 && (
                  <>
                    <button type="button" aria-label="Baldas anteriores" disabled={grupo === 0} onClick={() => setGrupo(grupo - 1)}>
                      ‹
                    </button>
                    <span aria-live="polite">
                      Grupo {grupo + 1} de {grupos}
                    </span>
                    <button type="button" aria-label="Baldas siguientes" disabled={grupo >= grupos - 1} onClick={() => setGrupo(grupo + 1)}>
                      ›
                    </button>
                  </>
                )}
                <button ref={abrirBiblioteca} type="button" className="is-toda" onClick={() => setBiblioteca(true)}>
                  Ver toda la biblioteca
                </button>
              </div>
            )}
          </>
        )}
      </section>
      {biblioteca && (
        <div className="reader-visit ed-visita3d__biblioteca" data-escape-local="open">
          <SharedLibrary items={compartidos} alias={nombre} profile={corner.data.profile} reviews={corner.data.reviews} openKey={ficha} onOpenBook={setFicha} onBack={cerrar} titulo={`Biblioteca de ${nombre}`} volver="Volver a su piso" />
          {ficha && <VisitBookSheet item={fichaAbierta} alias={nombre} profile={corner.data.profile} reviews={corner.data.reviews} onBack={() => setFicha(null)} />}
        </div>
      )}
    </div>
  );
}
