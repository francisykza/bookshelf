// Sobre lacrado del día (SPEC §6, 1.13.0): una app del portátil. Una vez al día hay un sobre con lacre; al
// abrirlo revela una cita literaria célebre como carta de algodón y lacre y da hojas doradas (doble si hoy
// ya has leído; cada 5 hojas, una Caja Sorpresa para el Ático). Las citas se guardan en tu Diario.
import { useState } from 'react';
import { pageRustle } from '../../audio/ambientAudio';
import { LEAVES_PER_PIECE, QUOTE_CARDS, cardById, treasureFor, treasureReady } from '../../domain/companion';
import { dayKey } from '../../domain/dates';
import { useLibrary } from '../../state/useLibrary';
import { ElegantQuoteCard } from '../quotes/ElegantQuoteCard';

/** Sobre lacrado con una hoja dorada asomando. */
export function Envelope({ open = false }) {
  return (
    <svg viewBox="0 0 48 36" className="envelope" data-open={open} aria-hidden="true" overflow="visible">
      <rect x="2" y="6" width="44" height="28" rx="3" fill="#f4e3c1" stroke="#8a6a3e" strokeWidth="1.4" />
      {open ? (
        <path d="M2 8 L24 -6 L46 8" fill="#ead2a4" stroke="#8a6a3e" strokeWidth="1.4" strokeLinejoin="round" />
      ) : (
        <path d="M2 8 L24 22 L46 8" fill="#ead2a4" stroke="#8a6a3e" strokeWidth="1.4" strokeLinejoin="round" />
      )}
      <path d="M30 4 C36 -2 44 2 40 9 C36 6 33 6 30 4 Z" fill="#e2b13c" stroke="#a37616" strokeWidth="0.8" className="envelope__leaf" />
      {!open && (
        <>
          <circle cx="24" cy="21" r="5.6" fill="#b3261e" stroke="#7a1612" strokeWidth="1" />
          <path d="M21.5 21 h5 M24 18.5 v5" stroke="#f1b0a4" strokeWidth="1" />
        </>
      )}
    </svg>
  );
}

/** ¿Hay sobre por abrir hoy? (para el punto rojo del dock). */
export const dailyQuoteReady = (state) => treasureReady(state.progress.companion, dayKey());

export function DailyQuote() {
  const { state, actions } = useLibrary();
  const today = dayKey();
  const c = state.progress.companion;
  const ready = treasureReady(c, today);
  const pending = c.pendingCard && cardById(c.pendingCard);
  const [opening, setOpening] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const todayPages = state.progress.readingLog.filter((e) => e.date === today).reduce((sum, e) => sum + e.pages, 0);
  const pinned = state.settings.pinnedQuote;
  const pin = (card) => actions.setSettings({ pinnedQuote: pinned?.text === card.text ? null : { text: card.text, author: card.author, work: card.work } });

  return (
    <div className="daily-quote">
      {ready ? (
        <>
          <p className="daily-quote__lead">{todayPages > 0 ? 'Como hoy ya has leído, este sobre trae una hoja dorada de más.' : 'Ha llegado un sobre lacrado para ti.'}</p>
          {/* El sobre se abre y deja salir la cita del día */}
          <button
            type="button"
            className="treasure-open"
            data-opening={opening || undefined}
            disabled={opening}
            onClick={() => {
              setOpening(true);
              pageRustle(0.5);
              window.setTimeout(() => actions.claimTreasure({ date: today, ...treasureFor(c, todayPages) }), 650);
            }}
          >
            <Envelope open={opening} />
            <span>{opening ? 'Abriendo…' : 'Romper el lacre'}</span>
          </button>
        </>
      ) : pending ? (
        <>
          <span className="daily-quote__kicker">La cita literaria del día</span>
          {/* Sobre salvia abierto (decoración); la cita y su atribución son texto real encima de la hoja */}
          <div className="daily-quote__envelope">
            <img className="daily-quote__envelope-art" src="/assets/bookshelf/notebook/envelope-sage-open.webp" alt="" width="720" height="707" aria-hidden="true" />
          <ElegantQuoteCard text={pending.text} author={pending.author} work={pending.work} onSave={actions.saveCard} onPin={() => pin(pending)} pinned={pinned?.text === pending.text} short />
          </div>
          <p className="daily-quote__reward">
            {c.lastPieceUp ? '✨ ¡Tus hojas doradas se han convertido en una Caja Sorpresa para el Ático!' : `🍂 +${c.lastLeaves ?? 1} ${c.lastLeaves === 2 ? 'hojas doradas' : 'hoja dorada'} para tu próxima Caja Sorpresa`}
          </p>
        </>
      ) : (
        <p className="daily-quote__lead">Ya has abierto el sobre de hoy. Mañana llegará otro.</p>
      )}

      <div className="daily-quote__leaves" aria-label={`Hojas doradas: ${c.leaves} de ${LEAVES_PER_PIECE}`}>
        <span className="daily-quote__leaf-row" aria-hidden="true">
          {Array.from({ length: LEAVES_PER_PIECE }, (_, i) => (
            <i key={i} data-on={i < c.leaves} />
          ))}
        </span>
        <span>
          {c.leaves} / {LEAVES_PER_PIECE} hojas para la próxima Caja Sorpresa
        </span>
      </div>

      {c.cards.length > 0 && (
        <div className="daily-quote__collection">
          <button type="button" className="link-btn" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
            Tu Diario de citas · {c.cards.length} de {QUOTE_CARDS.length} tarjetas
          </button>
          {showAll && (
            <ul>
              {[...c.cards].reverse().map((id) => {
                const card = cardById(id);
                return card ? (
                  <li key={id}>
                    <ElegantQuoteCard text={card.text} author={card.author} work={card.work} compact animate={false} />
                  </li>
                ) : null;
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
