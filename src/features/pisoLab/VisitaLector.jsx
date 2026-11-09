// «Visitar» desde la Comunidad: abre directamente el piso actual del lector elegido, sin escenas intermedias. Es la misma visita
// en primera persona que la del edificio (`VisitaPiso`), con una barra para volver al origen y llegar a su perfil. Qué piso se
// puede ver lo decide el servidor (`piso_visita`): si no se puede, se dice sin inventar nada.
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { ReaderAvatar } from '../../components/avatars/ReaderAvatar';
import { PanelShell } from '../../components/panels/PanelShell';
import { loadPisoVisita } from '../edificio/service';
import '../edificio/edificio.css';
import { useCommunity } from '../social/hooks/useCommunity';

// Trae Three.js: solo se descarga si de verdad hay un piso que enseñar
const VisitaPiso = lazy(() => import('./VisitaPiso'));

const TEXTO_VOLVER = { salon: 'Volver al salón', lectores: 'Volver a lectores' };

export default function VisitaLector({ userId, from = null, onBack, onProfile }) {
  useCommunity({ autoload: true });
  const [carga, setCarga] = useState({ estado: 'cargando', vecino: null });
  const [perdido, setPerdido] = useState(false);
  const cargar = useCallback(() => {
    let vivo = true;
    setCarga({ estado: 'cargando', vecino: null });
    loadPisoVisita(userId).then(
      (vecino) => vivo && setCarga({ estado: vecino ? 'listo' : 'nodisponible', vecino }),
      () => vivo && setCarga({ estado: 'error', vecino: null }),
    );
    return () => {
      vivo = false;
    };
  }, [userId]);
  useEffect(() => cargar(), [cargar]);
  const { estado, vecino } = carga;
  const alias = vecino?.alias ?? '';

  return (
    <PanelShell onClose={onBack} label={alias ? `Piso de ${alias}` : 'Visita a un piso'} variant="visit">
      <div className="visita-lector" data-estado={estado}>
        <header className="visita-lector__bar">
          <button type="button" onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
            {TEXTO_VOLVER[from] ?? 'Volver'}
          </button>
          {vecino && (
            <button type="button" className="visita-lector__quien" onClick={onProfile} aria-label={`Ver el perfil de ${alias}`}>
              <ReaderAvatar avatarId={vecino.avatar_id} alias={alias} size="list" decorative />
              <b>Piso de {alias}</b>
              <ChevronRight aria-hidden="true" />
            </button>
          )}
        </header>
        {estado === 'listo' && !perdido && (
          <Suspense fallback={<p className="visita-lector__aviso" role="status">Abriendo su piso…</p>}>
            <VisitaPiso key={vecino.user_id} vecino={vecino} edificio={null} onVolver={onBack} onIso={() => setPerdido(true)} />
          </Suspense>
        )}
        {estado === 'cargando' && <p className="visita-lector__aviso" role="status">Abriendo su piso…</p>}
        {estado === 'error' && (
          <div className="visita-lector__aviso" role="alert">
            <p>No se ha podido abrir este piso ahora mismo.</p>
            <button type="button" onClick={cargar}>
              Reintentar
            </button>
          </div>
        )}
        {(estado === 'nodisponible' || perdido) && (
          <div className="visita-lector__aviso" role="status">
            <p>{perdido ? 'Este dispositivo no ha podido dibujar el piso.' : 'Este piso no se puede visitar ahora mismo.'}</p>
            <button type="button" onClick={onProfile}>
              Ver su perfil
            </button>
          </div>
        )}
      </div>
    </PanelShell>
  );
}
