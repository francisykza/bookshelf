// 1.153 · La tarjeta «Amigos» del escritorio del ordenador del piso: quién lee qué y lo que te espera en la agenda. Antes de abrir
// Amigos por primera vez (o sin comunidad), solo invita a abrirla: no pide nada al servidor.
import { useEffect, useState } from 'react';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { useCommunity } from '../hooks/useCommunity';
import { amigosActivo, pendientesBuzon } from '../amigosLectura';
import { loadAmigos } from '../services/amigos';
import './amigos.css';

export function AmigosTarjeta({ onOpen }) {
  const community = useCommunity();
  const uid = community.userId;
  const activo = community.status === 'ready' && community.member && amigosActivo(uid);
  const [d, setD] = useState(null);
  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    loadAmigos()
      .then((x) => vivo && setD(x))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [activo]);
  useEffect(() => {
    if (uid && community.status === 'idle' && amigosActivo(uid)) community.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, community.status]);
  if (community.status === 'off' || community.status === 'signed-out') return null;

  const nuevos = d ? pendientesBuzon(d) + d.solicitudes.length : 0;
  const lector = d?.amigos.find((a) => a.leyendo?.length);
  return (
    <section className="pp-reading pp-am-card" aria-labelledby="pp-am-card-title">
      <h3 id="pp-am-card-title">
        Amigos
        {nuevos > 0 && <span className="pp-am-card__nuevo">{nuevos === 1 ? '1 nuevo' : `${nuevos} nuevos`}</span>}
      </h3>
      <div className="pp-am-card__body">
        {d?.amigos.length ? (
          <>
            <ul className="pp-am-card__caras" aria-label={`${d.amigos.length} ${d.amigos.length === 1 ? 'amigo' : 'amigos'}`}>
              {d.amigos.slice(0, 5).map((a) => (
                <li key={a.user_id}>
                  <ReaderAvatar avatarId={a.avatar_id} alias={a.alias} size="list" />
                </li>
              ))}
            </ul>
            <p>
              {lector ? (
                <>
                  <b>{lector.alias}</b> lee <cite>{lector.leyendo[0].titulo}</cite>
                </>
              ) : (
                'Mira qué leen tus amigos y leed a la vez.'
              )}
            </p>
          </>
        ) : (
          <p>Busca a tus amigos, mira qué leen, recomiéndales libros y leed a la vez.</p>
        )}
        <button type="button" className="pp-btn pp-btn--primary" data-name="Abrir Amigos" onClick={onOpen}>
          Abrir Amigos
        </button>
      </div>
    </section>
  );
}
