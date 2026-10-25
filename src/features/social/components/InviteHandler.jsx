// Enlace de invitación a un club (SPEC §25.11): `/#club=<token>`. Se valida en el servidor
// (`accept_club_invite`) solo con la sesión iniciada y la comunidad activada; antes de aceptar no se muestra nada
// del club. El fragmento se limpia de la barra de direcciones para no dejar el token a la vista.
import { useEffect, useState } from 'react';
import { inviteTokenFromHash } from '../connections';
import { useCommunity } from '../hooks/useCommunity';
import { acceptInvite } from '../services/connections';

export function InviteHandler({ onJoined }) {
  const community = useCommunity();
  const [token, setToken] = useState(() => inviteTokenFromHash(window.location.hash));
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    history.replaceState(history.state, '', window.location.pathname + window.location.search);
  }, [token]);

  useEffect(() => {
    if (token && community.status === 'idle') community.load();
  }, [token, community]);

  useEffect(() => {
    if (!token || community.status !== 'ready') return;
    if (!community.member) {
      setMessage('Para unirte al club, activa «Participar en la comunidad» en «Mi Perfil & Avatar» y vuelve a abrir el enlace.');
      setToken(null);
      return;
    }
    const t = token;
    setToken(null);
    acceptInvite(t)
      .then((clubId) => onJoined(clubId))
      .catch((e) => setMessage(e.message));
  }, [token, community.status, community.member, onJoined]);

  useEffect(() => {
    if (token && (community.status === 'signed-out' || community.status === 'off')) {
      setMessage('Para unirte al club, inicia sesión en «Tu cuenta» y vuelve a abrir el enlace.');
      setToken(null);
    }
  }, [token, community.status]);

  if (!message) return null;
  return (
    <div className="invite-toast paper-sheet" role="status">
      <p>{message}</p>
      <button type="button" className="social-btn" onClick={() => setMessage('')}>
        Entendido
      </button>
    </div>
  );
}
