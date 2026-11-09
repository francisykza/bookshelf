// El tablón de otra persona: solo su composición pública, sin mover ni editar nada, y el post-it si lo acepta.
import { useEffect, useRef, useState } from 'react';
import { Lienzo } from './Lienzo';
import { BoardFrame, DetailSheet, Sheet } from './parts';
import { PortIcon } from '../../ui/PortIcon';
import { MAX_NOTE, nextSendLabel, PAPER_NAMES, PAPERS, uid } from './model';
import { sendDrawing, sendNote } from './service';
import { Dibujar } from './Dibujar';
import './tablon.css';

/** Dejar un post-it. La clave no cambia hasta que el envío termina: un doble toque o un reintento no crea otro. */
export function PostItForm({ destino, alias, visit, onSent }) {
  const [text, setText] = useState('');
  const [paper, setPaper] = useState('crema');
  const [spoiler, setSpoiler] = useState(false);
  const [allow, setAllow] = useState(false);
  const [state, setState] = useState('');
  const key = useRef(uid());
  const busy = useRef(false);
  if (!visit?.acepta) return <p className="tb-note">{alias} no recibe post-its ahora mismo.</p>;
  if (visit.enviada_hoy || state === 'sent') return <p className="tb-note" role="status">{state === 'sent' ? 'Post-it enviado. ' : 'Ya le has dejado un post-it o un dibujo hoy. '}Podrás dejar otro el {nextSendLabel(visit.proximo)}.</p>;
  const send = async (e) => {
    e.preventDefault();
    if (busy.current || !text.trim()) return;
    busy.current = true;
    setState('sending');
    try {
      await sendNote({ destino, texto: text, estilo: paper, spoiler, permitePublico: allow, clave: key.current });
      setState('sent');
      onSent?.();
    } catch (err) {
      setState(`No se ha podido enviar: ${err.message}`);
    } finally {
      busy.current = false;
    }
  };
  return (
    <form className="tb-form" onSubmit={send}>
      <label className="tb-field">
        <span>Tu post-it para {alias}</span>
        <textarea value={text} maxLength={MAX_NOTE} rows={4} onChange={(e) => setText(e.target.value)} />
        <small aria-live="polite">{text.length} / {MAX_NOTE}</small>
      </label>
      <Papers value={paper} onChange={setPaper} />
      <label className="tb-check"><input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} /> Contiene spoiler</label>
      <label className="tb-check"><input type="checkbox" checked={allow} onChange={(e) => setAllow(e.target.checked)} /> Permitir que lo exponga en su tablón público</label>
      {state && state !== 'sending' && <p className="tb-note" role="alert">{state}</p>}
      <button type="submit" className="tb-btn tb-btn--main" disabled={!text.trim() || state === 'sending'}>{state === 'sending' ? 'Enviando…' : 'Dejar el post-it'}</button>
    </form>
  );
}

/** Dejar un dibujo: mismas reglas y mismo cupo que el post-it. */
export function DibujoForm({ destino, alias, visit, onSent }) {
  const [allow, setAllow] = useState(false);
  const [state, setState] = useState('');
  const key = useRef(uid());
  const busy = useRef(false);
  if (!visit?.acepta) return <p className="tb-note">{alias} no recibe dibujos ahora mismo.</p>;
  if (visit.enviada_hoy || state === 'sent') return <p className="tb-note" role="status">{state === 'sent' ? 'Dibujo enviado. ' : 'Ya le has dejado un post-it o un dibujo hoy. '}Podrás dejar otro el {nextSendLabel(visit.proximo)}.</p>;
  const send = async ({ dibujo, recortado }) => {
    if (busy.current) return;
    busy.current = true;
    setState('sending');
    try {
      await sendDrawing({ destino, dibujo, forma: recortado, permitePublico: allow, clave: key.current });
      setState('sent');
      onSent?.();
    } catch (err) {
      setState(`No se ha podido enviar: ${err.message}`);
    } finally {
      busy.current = false;
    }
  };
  return (
    <Dibujar submitLabel="Dejar el dibujo" sending={state === 'sending'} onSubmit={send}>
      <label className="tb-check"><input type="checkbox" checked={allow} onChange={(e) => setAllow(e.target.checked)} /> Permitir que lo exponga en su tablón público</label>
      {state && state !== 'sending' && <p className="tb-note" role="alert">{state}</p>}
    </Dibujar>
  );
}

export function Papers({ value, onChange }) {
  return (
    <fieldset className="tb-swatches">
      <legend>Papel</legend>
      {Object.entries(PAPERS).map(([id, color]) => (
        <label key={id} style={{ '--c': color }}>
          <input type="radio" name="tb-papel" checked={value === id} onChange={() => onChange(id)} />
          <span>{PAPER_NAMES[id]}</span>
        </label>
      ))}
    </fieldset>
  );
}

export default function TablonVisita({ ownerId, alias, visit, onClose, onSent }) {
  const [detail, setDetail] = useState(null);
  const [writing, setWriting] = useState(null);
  const map = useRef(null);
  const pub = visit?.publico ?? null;
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || detail || writing) return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [detail, writing, onClose]);
  const covered = detail || writing ? true : undefined;
  return (
    <div className="tb-app tb-app--visit" data-escape-local="open" role="dialog" aria-modal="true" aria-label={`Tablón de ${alias}`}>
      <div className="tb-look" inert={covered}>
        <div className="tb-look__top">
          <button type="button" className="tb-ghost" onClick={onClose}>
            <PortIcon name="flecha" back /> Volver
          </button>
        </div>
        <BoardFrame title={`Tablón de ${alias}`}>
          {pub ? <Lienzo ref={map} doc={pub.doc} mode="ver" readOnly label={`Tablón de ${alias}`} onTapItem={(id) => setDetail(pub.doc.items.find((i) => i.id === id))} /> : <div className="tb-map"><p className="tb-empty">{alias} no comparte nada todavía</p></div>}
        </BoardFrame>
        <div className="tb-look__foot">
          <button type="button" className="tb-ghost" onClick={() => setWriting('dibujo')}>
            <PortIcon name="lapiz" /> Dejar un dibujo
          </button>
          <button type="button" className="tb-ghost" onClick={() => setWriting('nota')}>
            <PortIcon name="lapiz" /> Dejar un post-it
          </button>
        </div>
      </div>
      {detail && <DetailSheet item={detail} onClose={() => setDetail(null)} />}
      {writing && (
        <Sheet title={writing === 'nota' ? 'Dejar un post-it' : 'Dejar un dibujo'} onClose={() => setWriting(null)}>
          {writing === 'nota' ? <PostItForm destino={ownerId} alias={alias} visit={visit} onSent={onSent} /> : <DibujoForm destino={ownerId} alias={alias} visit={visit} onSent={onSent} />}
        </Sheet>
      )}
    </div>
  );
}
