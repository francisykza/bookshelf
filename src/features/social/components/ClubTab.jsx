// Club de lectura (SPEC §25.11): crear, obra compartida (solo el título: no se añade a la biblioteca ni cambia
// su estado), punto de debate textual, invitaciones revocables, miembros, mensajes de 20 en 20 con spoilers
// plegados, editar y borrar los propios, moderación del propietario, salir y archivar. Privado: solo miembros.
import { useCallback, useEffect, useState } from 'react';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { NotebookShell } from '../../../components/primitives';
import { CLUB_MESSAGE_MAX, inviteLink } from '../connections';
import { useCommunity } from '../hooks/useCommunity';
import { PAGE_SIZE, blockUser, fetchProfiles, reportContent } from '../services/community';
import { createClub, createInvite, editMessage, fetchInvites, fetchMembers, fetchMessages, fetchMyClubs, hideMessage, postMessage, removeMember, revokeInvite, updateClub } from '../services/connections';

const fmt = (iso) => new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Message({ msg, author, mine, owner, onChanged, onRemoved }) {
  const [open, setOpen] = useState(!msg.has_spoilers);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(msg.body);
  const [spoilers, setSpoilers] = useState(msg.has_spoilers);
  const [confirm, setConfirm] = useState(null);
  const [failure, setFailure] = useState('');
  const run = async (fn) => {
    setFailure('');
    try {
      await fn();
    } catch (e) {
      setFailure(e.message);
    }
  };
  return (
    <article className="review-card">
      <div className="review-card__head">
        <ReaderAvatar avatarId={author?.avatar_id} alias={author?.alias ?? ''} size="review" />
        <div className="review-card__who">
          <b>{author?.alias ?? 'Lector'}</b>
          <small>
            {fmt(msg.created_at)}
            {msg.edited_at ? ' · editado' : ''}
          </small>
        </div>
      </div>
      {editing ? (
        <div className="profile-form">
          <textarea className="social-input club-text" value={text} maxLength={CLUB_MESSAGE_MAX} onChange={(e) => setText(e.target.value)} aria-label="Editar mensaje" />
          <label className="social-check">
            <input type="checkbox" checked={spoilers} onChange={(e) => setSpoilers(e.target.checked)} />
            <span>Contiene spoilers</span>
          </label>
          <div className="social-actions">
            <button type="button" className="social-btn social-btn--primary" disabled={!text.trim()} onClick={() => run(async () => (await editMessage(msg.id, text.trim(), spoilers), onChanged({ ...msg, body: text.trim(), has_spoilers: spoilers, edited_at: new Date().toISOString() }), setEditing(false)))}>
              Guardar
            </button>
            <button type="button" className="social-btn" onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : open ? (
        <p className="review-card__body">{msg.body}</p>
      ) : (
        <button type="button" className="spoiler-toggle" onClick={() => setOpen(true)}>
          Contiene spoilers · Mostrar el mensaje
        </button>
      )}
      {failure && <p className="social-error">{failure}</p>}
      {confirm ? (
        <div className="social-confirm" role="alertdialog" aria-label="Confirmar">
          <p>{confirm === 'delete' ? '¿Borrar tu mensaje?' : confirm === 'remove' ? '¿Retirar este mensaje del club?' : confirm === 'block' ? `¿Bloquear a ${author?.alias ?? 'esta persona'}?` : '¿Denunciar este mensaje? Solo lo verá moderación.'}</p>
          <div className="social-actions">
            <button
              type="button"
              className="social-btn social-btn--primary"
              onClick={() =>
                run(async () => {
                  const action = confirm;
                  setConfirm(null);
                  if (action === 'delete' || action === 'remove') {
                    await hideMessage(msg.id, action === 'remove');
                    onRemoved(msg.id);
                  } else if (action === 'block') {
                    await blockUser(msg.user_id);
                    onRemoved(msg.id);
                  } else await reportContent('club_message', msg.id, 'Denuncia desde el club');
                })
              }
            >
              Sí
            </button>
            <button type="button" className="social-btn" onClick={() => setConfirm(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        !editing && (
          <div className="review-card__menu">
            {mine && (
              <button type="button" onClick={() => setEditing(true)}>
                Editar
              </button>
            )}
            {mine && (
              <button type="button" onClick={() => setConfirm('delete')}>
                Borrar
              </button>
            )}
            {!mine && owner && (
              <button type="button" onClick={() => setConfirm('remove')}>
                Retirar
              </button>
            )}
            {!mine && (
              <button type="button" onClick={() => setConfirm('report')}>
                Denunciar
              </button>
            )}
            {!mine && (
              <button type="button" onClick={() => setConfirm('block')}>
                Bloquear
              </button>
            )}
          </div>
        )
      )}
    </article>
  );
}

function ClubView({ club: initial, onBack, onLeft }) {
  const community = useCommunity();
  const [club, setClub] = useState(initial);
  const [members, setMembers] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [messages, setMessages] = useState([]);
  const [more, setMore] = useState(false);
  const [invites, setInvites] = useState([]);
  const [text, setText] = useState('');
  const [spoilers, setSpoilers] = useState(false);
  const [point, setPoint] = useState(club.discussion_point);
  const [confirm, setConfirm] = useState(null);
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');
  const owner = club.owner === community.userId;
  const active = club.status === 'active';

  const withAuthors = useCallback(async (list) => {
    const p = await fetchProfiles(list.map((x) => x.user_id));
    setProfiles((s) => ({ ...s, ...p }));
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchMembers(club.id), fetchMessages(club.id), owner ? fetchInvites(club.id) : Promise.resolve([])])
      .then(async ([m, msgs, inv]) => {
        if (!alive) return;
        setMembers(m);
        setMessages(msgs);
        setMore(msgs.length === PAGE_SIZE);
        setInvites(inv);
        await withAuthors([...m, ...msgs]);
      })
      .catch((e) => alive && setFailure(e.message));
    return () => {
      alive = false;
    };
  }, [club.id, owner, withAuthors]);

  const run = async (fn) => {
    setFailure('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setFailure(e.message);
    }
  };

  return (
    <NotebookShell className="club-view club-notebook">
      <button type="button" className="spoiler-toggle" onClick={onBack}>
        ← Mis clubes
      </button>
      <h3 className="social-title">{club.name}</h3>
      {club.description && <p className="social-note">{club.description}</p>}
      {club.work_title && (
        <p className="social-note">
          Leemos: <b>{club.work_title}</b>
        </p>
      )}
      {!active && <p className="social-note">Este club está archivado: se puede leer, pero ya no admite mensajes.</p>}
      {owner && active ? (
        <div className="profile-form">
          <label htmlFor="club-point">Punto de debate</label>
          <div className="social-actions">
            <input id="club-point" className="social-input club-point" value={point} maxLength={120} placeholder="Por ejemplo: hasta el capítulo 8" onChange={(e) => setPoint(e.target.value)} />
            <button type="button" className="social-btn" onClick={() => run(async () => setClub(await updateClub(club.id, { discussion_point: point.trim() })))}>
              Guardar
            </button>
          </div>
        </div>
      ) : (
        club.discussion_point && (
          <p className="social-hand">
            Debatimos: {club.discussion_point}
          </p>
        )
      )}
      {failure && (
        <p className="social-error" role="alert">
          {failure}
        </p>
      )}
      {notice && (
        <p className="social-note" role="status">
          {notice}
        </p>
      )}
      <section aria-label="Miembros" className="readers">
        <h4>Miembros</h4>
        {members.map((m) => (
          <div key={m.user_id} className="follow-row">
            <ReaderAvatar avatarId={profiles[m.user_id]?.avatar_id} alias={profiles[m.user_id]?.alias ?? ''} size="review" />
            <span className="blocked-list__name">
              <b>{profiles[m.user_id]?.alias ?? 'Lector'}</b>
              {m.role === 'owner' ? ' · propietario' : ''}
            </span>
            {owner && m.role !== 'owner' && (
              <button type="button" className="social-btn" onClick={() => setConfirm({ kind: 'remove', id: m.user_id, alias: profiles[m.user_id]?.alias })}>
                Retirar
              </button>
            )}
          </div>
        ))}
      </section>
      {owner && active && (
        <section aria-label="Invitaciones" className="readers">
          <h4>Invitaciones</h4>
          <p className="social-note">Comparte el enlace con quien quieras invitar. Caduca en 14 días y puedes revocarlo cuando quieras.</p>
          {invites.map((inv) => (
            <div key={inv.id} className="invite-row">
              <input className="social-input" readOnly value={inviteLink(window.location.origin, inv.token)} aria-label="Enlace de invitación" onFocus={(e) => e.target.select()} />
              <button type="button" className="social-btn" onClick={() => run(async () => (await navigator.clipboard?.writeText(inviteLink(window.location.origin, inv.token)), setNotice('Enlace copiado.')))}>
                Copiar
              </button>
              <button type="button" className="social-btn" onClick={() => run(async () => (await revokeInvite(inv.id), setInvites((l) => l.filter((x) => x.id !== inv.id)), setNotice('Invitación revocada: ese enlace ya no sirve.')))}>
                Revocar
              </button>
            </div>
          ))}
          <button type="button" className="social-btn" onClick={() => run(async () => {
            const inv = await createInvite(club.id);
            setInvites((l) => [inv, ...l]);
          })}>
            Crear enlace de invitación
          </button>
        </section>
      )}
      <section aria-label="Debate" className="readers">
        <h4>Debate</h4>
        {active && (
          <form
            className="profile-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              run(async () => {
                const msg = await postMessage(club.id, text.trim(), spoilers);
                setMessages((l) => [msg, ...l]);
                await withAuthors([msg]);
                setText('');
                setSpoilers(false);
              });
            }}
          >
            <textarea className="social-input club-text" value={text} maxLength={CLUB_MESSAGE_MAX} onChange={(e) => setText(e.target.value)} placeholder="Escribe al club…" aria-label="Mensaje para el club" />
            <div className="social-actions">
              <label className="social-check">
                <input type="checkbox" checked={spoilers} onChange={(e) => setSpoilers(e.target.checked)} />
                <span>Contiene spoilers</span>
              </label>
              <button type="submit" className="social-btn social-btn--primary" disabled={!text.trim()}>
                Publicar
              </button>
              <small className="readers__count">
                {text.length}/{CLUB_MESSAGE_MAX}
              </small>
            </div>
          </form>
        )}
        {messages.length === 0 && <p className="social-note">Todavía no hay mensajes.</p>}
        {messages.map((m) => (
          <Message key={m.id} msg={m} author={profiles[m.user_id]} mine={m.user_id === community.userId} owner={owner} onChanged={(next) => setMessages((l) => l.map((x) => (x.id === next.id ? next : x)))} onRemoved={(id) => setMessages((l) => l.filter((x) => x.id !== id))} />
        ))}
        {more && (
          <button
            type="button"
            className="social-btn"
            onClick={() =>
              run(async () => {
                const page = await fetchMessages(club.id, messages.at(-1));
                setMessages((l) => [...l, ...page]);
                setMore(page.length === PAGE_SIZE);
                await withAuthors(page);
              })
            }
          >
            Ver mensajes anteriores
          </button>
        )}
      </section>
      <div className="social-actions">
        {!owner && (
          <button type="button" className="social-btn" onClick={() => setConfirm({ kind: 'leave' })}>
            Salir del club
          </button>
        )}
        {owner && active && (
          <button type="button" className="social-btn" onClick={() => setConfirm({ kind: 'archive' })}>
            Archivar el club
          </button>
        )}
      </div>
      {confirm && (
        <div className="social-confirm" role="alertdialog" aria-label="Confirmar">
          <p>{confirm.kind === 'leave' ? '¿Salir del club? Necesitarás otra invitación para volver.' : confirm.kind === 'archive' ? '¿Archivar el club? Se podrá leer, pero no admitirá mensajes.' : `¿Retirar a ${confirm.alias ?? 'esta persona'} del club?`}</p>
          <div className="social-actions">
            <button
              type="button"
              className="social-btn social-btn--primary"
              onClick={() =>
                run(async () => {
                  const c = confirm;
                  setConfirm(null);
                  if (c.kind === 'leave') {
                    await removeMember(club.id, community.userId);
                    onLeft(club.id);
                  } else if (c.kind === 'archive') setClub(await updateClub(club.id, { status: 'archived' }));
                  else {
                    await removeMember(club.id, c.id);
                    setMembers((l) => l.filter((m) => m.user_id !== c.id));
                  }
                })
              }
            >
              Sí
            </button>
            <button type="button" className="social-btn" onClick={() => setConfirm(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </NotebookShell>
  );
}

export function ClubTab({ openClubId = null }) {
  const community = useCommunity({ autoload: true });
  const [clubs, setClubs] = useState(null);
  const [current, setCurrent] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', workTitle: '' });
  const [failure, setFailure] = useState('');
  const ready = community.status === 'ready' && community.member;

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    fetchMyClubs()
      .then((list) => {
        if (!alive) return;
        setClubs(list);
        if (openClubId) setCurrent(list.find((c) => c.id === openClubId) ?? null);
      })
      .catch((e) => alive && setFailure(e.message));
    return () => {
      alive = false;
    };
  }, [ready, openClubId]);

  if (community.status !== 'ready') return <p className="social-note">Abre «Mi Perfil & Avatar» para empezar.</p>;
  if (!community.member) return <p className="social-note">Activa «Participar en la comunidad» en «Mi Perfil & Avatar» para crear o unirte a un club.</p>;
  if (current) return <ClubView club={current} onBack={() => setCurrent(null)} onLeft={(id) => (setClubs((l) => l.filter((c) => c.id !== id)), setCurrent(null))} />;

  return (
    <div className="readers">
      {failure && (
        <p className="social-error" role="alert">
          {failure}
        </p>
      )}
      <h3 className="social-title">Mis clubes</h3>
      {clubs === null && <p className="social-note">Cargando…</p>}
      {clubs?.length === 0 && <p className="social-note">Aún no estás en ningún club. Crea uno o abre el enlace de invitación que te hayan enviado.</p>}
      {clubs?.map((c) => (
        <button key={c.id} type="button" className="activity-row" onClick={() => setCurrent(c)}>
          <span>
            <b>{c.name}</b>
            {c.status === 'archived' ? ' · archivado' : c.discussion_point ? ` · ${c.discussion_point}` : ''}
          </span>
        </button>
      ))}
      {creating ? (
        <form
          className="profile-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setFailure('');
            try {
              const club = await createClub({ name: form.name.trim(), description: form.description.trim(), workTitle: form.workTitle.trim() });
              setClubs((l) => [club, ...(l ?? [])]);
              setCreating(false);
              setForm({ name: '', description: '', workTitle: '' });
              setCurrent(club);
            } catch (err) {
              setFailure(err.message);
            }
          }}
        >
          <label htmlFor="club-name">Nombre</label>
          <input id="club-name" className="social-input" value={form.name} maxLength={80} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <label htmlFor="club-desc">Descripción breve</label>
          <input id="club-desc" className="social-input" value={form.description} maxLength={280} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <label htmlFor="club-work">Obra que leeréis</label>
          <input id="club-work" className="social-input" value={form.workTitle} maxLength={300} placeholder="Título del libro" onChange={(e) => setForm((f) => ({ ...f, workTitle: e.target.value }))} />
          <p className="social-hand">No se añadirá a tu biblioteca ni cambiará su estado.</p>
          <div className="social-actions">
            <button type="submit" className="social-btn social-btn--primary" disabled={form.name.trim().length < 2}>
              Crear club
            </button>
            <button type="button" className="social-btn" onClick={() => setCreating(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="social-btn" onClick={() => setCreating(true)}>
          Crear un club
        </button>
      )}
    </div>
  );
}
