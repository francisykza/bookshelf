// «Visitar» desde la Comunidad: abre directamente el piso actual del lector elegido, sin escenas intermedias. Es la misma visita
// en primera persona que la del edificio (`VisitaPiso`), con una barra para volver al origen y llegar a su perfil. Qué piso se
// puede ver lo decide el servidor (`piso_visita`): si no se puede, se dice sin inventar nada.
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { ReaderAvatar } from '../../components/avatars/ReaderAvatar';
import { PanelShell } from '../../components/panels/PanelShell';
import { doorLabel, loadPisoVisita } from '../edificio/service';
import { installPixelVars } from '../edificio/pixelUi';
import '../edificio/edificio.css';
import { useCommunity } from '../social/hooks/useCommunity';
import { PantallaCarga } from '../../ui/PantallaCarga';

// Trae Three.js: solo se descarga si de verdad hay un piso que enseñar
const VisitaPiso = lazy(() => import('./VisitaPiso'));

const TEXTO_VOLVER = { salon: 'Volver al salón', lectores: 'Volver a lectores', amigos: 'Volver a Amigos' };

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
  // El papel de píxel de la ficha (--px-paper), como en el edificio
  useEffect(() => installPixelVars(), []);
  const { estado, vecino } = carga;
  const alias = vecino?.alias ?? '';
  const cargando = alias ? `Entrando en el piso de ${alias}…` : 'Abriendo su piso…';

  return (
    <PanelShell onClose={onBack} label={alias ? `Piso de ${alias}` : 'Visita a un piso'} variant="visit">
      <div className="visita-lector" data-estado={estado}>
        {/* 1.165.1: la misma franja fina que en el edificio (1.164): volver y una ficha de papel con su retrato, su nombre y su
            puerta; aquí la ficha lleva a su perfil */}
        <header className="visita-lector__bar">
          <button type="button" className="ed-bar__back" onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
            {TEXTO_VOLVER[from] ?? 'Volver'}
          </button>
          {vecino && (
            <button type="button" className="ed-bar__quien visita-lector__quien" onClick={onProfile} aria-label={`Ver el perfil de ${alias}`}>
              <ReaderAvatar userId={vecino.user_id} avatarId={vecino.avatar_id} alias={alias} size="list" decorative />
              <b>{alias}</b>
              {vecino.puerta ? <span>{doorLabel(vecino.puerta)}</span> : null}
              <ChevronRight aria-hidden="true" />
            </button>
          )}
        </header>
        {estado === 'listo' && !perdido && (
          <Suspense fallback={<PantallaCarga mensaje={cargando} />}>
            <VisitaPiso key={vecino.user_id} vecino={vecino} edificio={null} onVolver={onBack} onSin3d={() => setPerdido(true)} />
          </Suspense>
        )}
        {estado === 'cargando' && <PantallaCarga mensaje={cargando} />}
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
