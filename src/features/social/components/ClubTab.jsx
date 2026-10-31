// Club de lectura (SPEC §25.11; reorganizado en la 1.62, §62.4, según la maqueta del paquete «salón social y radio»):
// dentro de un club, tres pestañas —Lectura (obra, descripción y punto de debate), Conversación (mensajes de 20 en 20
// en orden de lectura, spoilers plegados al recibirlos, redactor fijo abajo) y Miembros—. Administrar (punto de debate e
// invitaciones revocables) y archivar están en el menú «…» del propietario, con confirmación; salir, en el de los demás.
// Todo lo autoriza el servidor (RLS): esconder un botón no es la protección. Sin adjuntos ni mensajes privados. El punto
// de debate es contexto: no oculta mensajes por capítulo (no hay datos para prometerlo).
import { ArrowLeft, Ban, EyeOff, Flag, Pencil, SendHorizontal, Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { OptionsMenu } from '../../../components/book/Annotations';
import { CLUB_MESSAGE_MAX, inviteLink } from '../connections';
import { useCommunity } from '../hooks/useCommunity';
import { PAGE_SIZE, blockUser, fetchProfiles, reportContent } from '../services/community';
import { createClub, createInvite, editMessage, fetchInvites, fetchMembers, fetchMessages, fetchMyClubs, hideMessage, postMessage, removeMember, revokeInvite, updateClub } from '../services/connections';

const fmtDay = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

const SECTIONS = [
  { id: 'lectura', label: 'Lectura' },
  { id: 'conversacion', label: 'Conversación' },
  { id: 'miembros', label: 'Miembros' },
];

/** Confirmación en línea, con el foco en «Cancelar» (la opción segura). */
function Confirm({ text, yes = 'Sí', onYes, onNo }) {
  const ref = useRef(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="social-confirm" role="alertdialog" aria-label={text}>
      <p>{text}</p>
      <div className="social-actions">
        <button type="button" className="social-btn social-btn--primary" onClick={onYes}>
          {yes}
        </button>
        <button ref={ref} type="button" className="social-btn" onClick={onNo}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Un mensaje: avatar, nombre y fecha; el texto en su bocadillo, o plegado si avisa de spoilers. Acciones en «…». */
function Message({ msg, author, mine, owner, active, onChanged, onRemoved }) {
  const [open, setOpen] = useState(!msg.has_spoilers);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(msg.body);
  const [spoilers, setSpoilers] = useState(msg.has_spoilers);
  const [confirm, setConfirm] = useState(null);
  const [failure, setFailure] = useState('');
  const alias = author?.alias ?? 'Lector';
  const run = async (fn) => {
    setFailure('');
    try {
      await fn();
    } catch (e) {
      setFailure(e.message);
    }
  };
  const items = [
    ...(mine && active ? [{ label: 'Editar', icon: <Pencil aria-hidden="true" />, onSelect: () => setEditing(true) }] : []),
    ...(mine ? [{ label: 'Borrar', icon: <Trash2 aria-hidden="true" />, danger: true, onSelect: () => setConfirm('delete') }] : []),
    ...(!mine && owner ? [{ label: 'Retirar del club', icon: <Trash2 aria-hidden="true" />, danger: true, onSelect: () => setConfirm('remove') }] : []),
    ...(!mine ? [{ label: 'Denunciar', icon: <Flag aria-hidden="true" />, onSelect: () => setConfirm('report') }] : []),
    ...(!mine ? [{ label: `Bloquear a ${alias}`, icon: <Ban aria-hidden="true" />, danger: true, onSelect: () => setConfirm('block') }] : []),
  ];
  const question = { delete: '¿Borrar tu mensaje?', remove: '¿Retirar este mensaje del club?', block: `¿Bloquear a ${alias}? Dejaréis de ver vuestras aportaciones.`, report: '¿Denunciar este mensaje? Solo lo verá moderación.' }[confirm];
  return (
    <li className="club-msg" data-mine={mine || undefined}>
      <ReaderAvatar avatarId={author?.avatar_id} alias={alias} size="review" />
      <div className="club-msg__main">
        <p className="club-msg__who">
          <b>{alias}</b>
          <time dateTime={msg.created_at} title={`${fmtDay(msg.created_at)} · ${fmtTime(msg.created_at)}`}>
            {fmtDay(msg.created_at)}
          </time>
          {msg.edited_at && <small>· editado</small>}
        </p>
        {editing ? (
          <div className="club-msg__edit">
            <textarea className="social-input club-text" value={text} maxLength={CLUB_MESSAGE_MAX} onChange={(e) => setText(e.target.value)} aria-label="Editar mensaje" />
            <label className="social-check">
              <input type="checkbox" checked={spoilers} onChange={(e) => setSpoilers(e.target.checked)} />
              <span>Contiene spoilers</span>
            </label>
            <div className="social-actions">
              <button
                type="button"
                className="social-btn social-btn--primary"
                disabled={!text.trim()}
                onClick={() =>
                  run(async () => {
                    await editMessage(msg.id, text.trim(), spoilers);
                    onChanged({ ...msg, body: text.trim(), has_spoilers: spoilers, edited_at: new Date().toISOString() });
                    setEditing(false);
                  })
                }
              >
                Guardar
              </button>
              <button type="button" className="social-btn" onClick={() => setEditing(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : open ? (
          <p className="club-msg__bubble">{msg.body}</p>
        ) : (
          <button type="button" className="club-msg__bubble club-msg__spoiler" aria-expanded="false" onClick={() => setOpen(true)}>
            <EyeOff aria-hidden="true" />
            <span>Contiene spoilers · Mostrar el mensaje</span>
          </button>
        )}
        {failure && <p className="social-error">{failure}</p>}
        {confirm && (
          <Confirm
            text={question}
            onNo={() => setConfirm(null)}
            onYes={() =>
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
          />
        )}
      </div>
      {!editing && !confirm && items.length > 0 && <OptionsMenu label={`Opciones del mensaje de ${alias}`} items={items} />}
    </li>
  );
}

/** Lo que administra el propietario: el punto de debate y las invitaciones (se llega desde «…»). */
function ClubAdmin({ club, invites, setInvites, onSaved, onBack, run, setNotice }) {
  const [point, setPoint] = useState(club.discussion_point ?? '');
  const backRef = useRef(null);
  useEffect(() => backRef.current?.focus({ preventScroll: true }), []);
  return (
    <section className="club-admin" aria-labelledby="club-admin-title">
      <button ref={backRef} type="button" className="club-back" onClick={onBack}>
        <ArrowLeft aria-hidden="true" /> Volver al club
      </button>
      <h4 id="club-admin-title" className="club-heading">
        Administrar el club
      </h4>
      <div className="profile-form">
        <label htmlFor="club-point">Punto de debate</label>
        <p className="social-note">Sirve de guía para no adelantar la trama; no oculta mensajes por capítulo.</p>
        <div className="club-admin__row">
          <input id="club-point" className="social-input club-point" value={point} maxLength={120} placeholder="Por ejemplo: hasta el capítulo 8" onChange={(e) => setPoint(e.target.value)} />
          <button type="button" className="social-btn" onClick={() => run(async () => (onSaved(await updateClub(club.id, { discussion_point: point.trim() })), setNotice('Punto de debate guardado.')))}>
            Guardar
          </button>
        </div>
      </div>
      <section aria-label="Invitaciones" className="club-invites">
        <h4 className="club-heading">Invitaciones</h4>
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
        <button
          type="button"
          className="social-btn"
          onClick={() =>
            run(async () => {
              const inv = await createInvite(club.id);
              setInvites((l) => [inv, ...l]);
            })
          }
        >
          Crear enlace de invitación
        </button>
      </section>
    </section>
  );
}

function ClubView({ club: initial, onBack, onLeft }) {
  const community = useCommunity();
  const [club, setClub] = useState(initial);
  const [section, setSection] = useState('conversacion');
  const [admin, setAdmin] = useState(false);
  const [members, setMembers] = useState(null);
  const [profiles, setProfiles] = useState({});
  // Del más nuevo al más antiguo (como llegan, de 20 en 20); se pintan en orden de lectura
  const [messages, setMessages] = useState(null);
  const [more, setMore] = useState(false);
  const [invites, setInvites] = useState([]);
  const [text, setText] = useState('');
  const [spoilers, setSpoilers] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');
  const endRef = useRef(null);
  const stick = useRef(true);
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
        await withAuthors([...m, ...msgs]);
        if (!alive) return;
        setMembers(m);
        setMessages(msgs);
        setMore(msgs.length === PAGE_SIZE);
        setInvites(inv);
      })
      .catch((e) => alive && setFailure(e.message));
    return () => {
      alive = false;
    };
  }, [club.id, owner, withAuthors]);

  // La conversación se abre por el final (lo último dicho), y vuelve al final al publicar
  useLayoutEffect(() => {
    if (section !== 'conversacion' || admin || !messages || !stick.current) return;
    // Solo la hoja de la comunidad se desplaza (nunca la página ni el velo)
    const sheet = endRef.current?.closest('.social-hub__body');
    if (sheet) sheet.scrollTop = sheet.scrollHeight;
    stick.current = false;
  }, [section, admin, messages]);

  const run = async (fn) => {
    setFailure('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setFailure(e.message);
    }
  };
  const send = (event) => {
    event.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    run(async () => {
      const msg = await postMessage(club.id, text.trim(), spoilers);
      await withAuthors([msg]);
      stick.current = true;
      setMessages((l) => [msg, ...(l ?? [])]);
      setText('');
      setSpoilers(false);
    }).finally(() => setSending(false));
  };
  const older = () =>
    run(async () => {
      const page = await fetchMessages(club.id, messages.at(-1));
      await withAuthors(page);
      setMessages((l) => [...l, ...page]);
      setMore(page.length === PAGE_SIZE);
    });

  const menu = owner
    ? [...(active ? [{ label: 'Administrar el club', icon: <Users aria-hidden="true" />, onSelect: () => setAdmin(true) }] : []), ...(active ? [{ label: 'Archivar el club', icon: <Trash2 aria-hidden="true" />, danger: true, onSelect: () => setConfirm({ kind: 'archive' }) }] : [])]
    : [{ label: 'Salir del club', icon: <ArrowLeft aria-hidden="true" />, danger: true, onSelect: () => setConfirm({ kind: 'leave' }) }];
  const question = confirm && (confirm.kind === 'leave' ? '¿Salir del club? Necesitarás otra invitación para volver.' : confirm.kind === 'archive' ? '¿Archivar el club? Se podrá leer, pero no admitirá mensajes.' : `¿Retirar a ${confirm.alias ?? 'esta persona'} del club?`);
  const aliasOf = (id) => profiles[id]?.alias ?? 'Lector';

  return (
    <div className="club-view" data-section={admin ? 'admin' : section}>
      <button type="button" className="club-back" onClick={onBack} aria-label="Mis clubes">
        <ArrowLeft aria-hidden="true" /> Mis clubes
      </button>
      <header className="club-view__head">
        <h3 className="club-view__name">{club.name}</h3>
        {menu.length > 0 && <OptionsMenu label={owner ? 'Opciones del propietario del club' : 'Opciones del club'} items={menu} />}
      </header>
      {!active && <p className="social-note club-archived">Este club está archivado: se puede leer, pero ya no admite mensajes.</p>}
      {confirm && (
        <Confirm
          text={question}
          onNo={() => setConfirm(null)}
          onYes={() =>
            run(async () => {
              const c = confirm;
              setConfirm(null);
              if (c.kind === 'leave') {
                await removeMember(club.id, community.userId);
                onLeft(club.id);
              } else if (c.kind === 'archive') {
                setClub(await updateClub(club.id, { status: 'archived' }));
                setAdmin(false);
                setNotice('Club archivado.');
              } else {
                await removeMember(club.id, c.id);
                setMembers((l) => l.filter((m) => m.user_id !== c.id));
              }
            })
          }
        />
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
      {admin ? (
        <ClubAdmin club={club} invites={invites} setInvites={setInvites} onSaved={setClub} onBack={() => setAdmin(false)} run={run} setNotice={setNotice} />
      ) : (
        <>
          <div className="club-tabs" role="tablist" aria-label={`Secciones de ${club.name}`}>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                id={`club-tab-${s.id}`}
                aria-selected={section === s.id}
                aria-controls={`club-panel-${s.id}`}
                onClick={() => {
                  if (s.id === 'conversacion') stick.current = true;
                  setSection(s.id);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          {section === 'lectura' && (
            <section id="club-panel-lectura" role="tabpanel" aria-labelledby="club-tab-lectura" className="club-panel club-reading">
              {club.work_title ? (
                <p className="club-reading__work">
                  <span>Leemos</span>
                  <b>{club.work_title}</b>
                </p>
              ) : (
                <p className="social-note">Este club aún no ha elegido obra.</p>
              )}
              {club.description && <p className="club-reading__desc">{club.description}</p>}
              <div className="club-reading__point">
                <h4 className="club-heading">Punto de debate</h4>
                <p>{club.discussion_point ? `Debatimos: ${club.discussion_point}` : 'Sin punto de debate por ahora.'}</p>
                <p className="social-note">Es una guía para no adelantar la trama: cada mensaje con spoilers se pliega igualmente.</p>
              </div>
            </section>
          )}
          {section === 'conversacion' && (
            <section id="club-panel-conversacion" role="tabpanel" aria-labelledby="club-tab-conversacion" className="club-panel club-talk">
              <div className="club-talk__context">
                <h4 className="club-heading">{club.discussion_point ? `Debate: ${club.discussion_point}` : 'Conversación'}</h4>
                <p>Los mensajes con spoilers se ocultan hasta que decides verlos.</p>
              </div>
              {messages === null && !failure && (
                <p className="social-note" role="status">
                  Cargando la conversación…
                </p>
              )}
              {more && (
                <button type="button" className="social-btn club-older" onClick={older}>
                  Ver mensajes anteriores
                </button>
              )}
              {messages?.length === 0 && <p className="social-note">Todavía no hay mensajes. {active ? 'Escribe el primero.' : ''}</p>}
              <ol className="club-msgs" aria-label="Mensajes del club">
                {[...(messages ?? [])].reverse().map((m) => (
                  <Message key={m.id} msg={m} author={profiles[m.user_id]} mine={m.user_id === community.userId} owner={owner} active={active} onChanged={(next) => setMessages((l) => l.map((x) => (x.id === next.id ? next : x)))} onRemoved={(id) => setMessages((l) => l.filter((x) => x.id !== id))} />
                ))}
              </ol>
              <span ref={endRef} aria-hidden="true" />
              {active && (
                <form className="club-composer" onSubmit={send} aria-label="Escribir al club">
                  <div className="club-composer__row">
                    <textarea
                      className="social-input club-composer__text"
                      value={text}
                      rows={1}
                      maxLength={CLUB_MESSAGE_MAX}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Escribe al club…"
                      aria-label="Mensaje para el club"
                      aria-describedby="club-composer-count"
                    />
                    <button type="submit" className="club-composer__send" disabled={!text.trim() || sending} aria-label="Publicar">
                      <SendHorizontal aria-hidden="true" />
                    </button>
                  </div>
                  <div className="club-composer__foot">
                    <label className="social-check">
                      <input type="checkbox" checked={spoilers} onChange={(e) => setSpoilers(e.target.checked)} />
                      <span>Contiene spoilers</span>
                    </label>
                    <small id="club-composer-count" className="readers__count">
                      {text.length}/{CLUB_MESSAGE_MAX}
                    </small>
                  </div>
                </form>
              )}
            </section>
          )}
          {section === 'miembros' && (
            <section id="club-panel-miembros" role="tabpanel" aria-labelledby="club-tab-miembros" className="club-panel">
              {members === null && !failure && <p className="social-note">Cargando…</p>}
              <ul className="club-members">
                {(members ?? []).map((m) => (
                  <li key={m.user_id} className="club-member">
                    <ReaderAvatar avatarId={profiles[m.user_id]?.avatar_id} alias={aliasOf(m.user_id)} size="list" />
                    <span className="club-member__name">
                      <b>{aliasOf(m.user_id)}</b>
                      {m.role === 'owner' && <small>Propietario</small>}
                      {m.user_id === community.userId && m.role !== 'owner' && <small>Tú</small>}
                    </span>
                    {owner && active && m.role !== 'owner' && (
                      <button type="button" className="social-btn" onClick={() => setConfirm({ kind: 'remove', id: m.user_id, alias: aliasOf(m.user_id) })} aria-label={`Retirar a ${aliasOf(m.user_id)} del club`}>
                        Retirar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {owner && active && <p className="social-note">Para invitar a alguien, abre «…» → «Administrar el club».</p>}
            </section>
          )}
        </>
      )}
    </div>
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

  if (community.status !== 'ready') return <p className="social-note">Abre «Tu perfil lector» desde tu avatar, arriba a la izquierda, para empezar.</p>;
  if (!community.member) return <p className="social-note">Activa «Participar en la comunidad» en «Tu perfil lector» (desde tu avatar, arriba a la izquierda) para crear o unirte a un club.</p>;
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
