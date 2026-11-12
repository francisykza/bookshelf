// El café-librería del bajo, bloque 4a (1.122): el cartel de lo conseguido al terminar con un cliente. La subida de nivel
// (el número grande, sus tickets y lo que se abre), los hitos (un mueble nuevo en la tienda, lo nuevo de la carta, granos) y
// los tickets del día. Honesto: solo dice lo que el servidor ha dado; sin cuentas atrás ni presión para seguir. Con
// movimiento reducido, sin animación. Suena una vez, al aparecer (siempre después de un toque).
import { useEffect, useRef } from 'react';
import { CAFE_NIVELES, cafeMueble } from './cafeCatalogo';
import { ABRE, textoHito } from './cafeNiveles';
import { crearSfxBarra } from './cafeSfx';

const nombreNivel = (n) => CAFE_NIVELES.find((x) => x.nivel === n)?.nombre ?? '';

/** `logro`: el progreso de `cafe_servir` ({ niveles, hitos, granos, ticketsDia }). */
export function LogroCafe({ logro, soundOn = false, onCerrar }) {
  const boton = useRef(null);
  // La subida que se celebra: la del nivel más alto (el 1 se cobra al inaugurar y no tiene cartel)
  const subida = logro.niveles.filter((x) => x.nivel > 1).at(-1) ?? null;
  const inaugura = logro.niveles.find((x) => x.nivel === 1) ?? null;
  const hitos = logro.hitos;
  useEffect(() => {
    boton.current?.focus();
    const sfx = crearSfxBarra();
    sfx.setActivo(soundOn);
    sfx.play(subida ? 'subeNivel' : 'hito');
  }, [soundOn, subida]);
  return (
    <div className="cf3-logro" role="dialog" aria-modal="true" aria-labelledby="cf3-logro-t" data-subida={subida ? 'true' : undefined}>
      <div className="cf3-logro__carta">
        {subida ? (
          <>
            <p className="cf3-logro__ante">¡Tu café crece!</p>
            <h3 className="cf3-logro__t" id="cf3-logro-t">
              <span className="cf3-logro__nv" aria-hidden="true">
                <span>NV</span>
                {subida.nivel}
              </span>
              <span>
                Nivel {subida.nivel} · {nombreNivel(subida.nivel)}
              </span>
            </h3>
            <p className="cf3-logro__tickets">
              <span className="cf3-logro__ticket" aria-hidden="true" />+{subida.tickets} tickets
            </p>
            <ul className="cf3-logro__abre">
              {(ABRE[subida.nivel] ?? []).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </>
        ) : (
          <h3 className="cf3-logro__t cf3-logro__t--hito" id="cf3-logro-t">
            {inaugura ? '¡Primer día con clientes!' : hitos.length > 1 ? '¡Hitos del café!' : hitos.length === 1 ? '¡Un hito del café!' : '¡Primer cliente del día!'}
          </h3>
        )}
        {(hitos.length > 0 || inaugura || logro.ticketsDia > 0) && (
          <ul className="cf3-logro__hitos">
            {inaugura && (
              <li data-tipo="tickets">
                <span className="cf3-logro__ticket" aria-hidden="true" />+{inaugura.tickets} tickets por abrir el café
              </li>
            )}
            {hitos.map((h) => (
              <li key={`${h.nivel}:${h.hito}`} data-tipo="hito">
                <span className="cf3-logro__estrella" aria-hidden="true" />
                {textoHito(h, (id) => cafeMueble(id)?.nombre ?? id)}
              </li>
            ))}
            {logro.ticketsDia > 0 && (
              <li data-tipo="tickets">
                <span className="cf3-logro__ticket" aria-hidden="true" />+{logro.ticketsDia} {logro.ticketsDia === 1 ? 'ticket' : 'tickets'} del café de hoy
              </li>
            )}
          </ul>
        )}
        <button ref={boton} type="button" className="cf3-btn cf3-btn--verde cf3-logro__ok" onClick={onCerrar}>
          {subida ? '¡A por ello!' : 'Seguir'}
        </button>
      </div>
    </div>
  );
}
