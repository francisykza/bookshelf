// 1.142 (§142): el cuaderno de Pilar, en la franja de abajo del café (como el ranking). Tres tareas que se le encargan a cambio
// de granos, para siempre y con grados: colocar la caja, la hucha de propinas y la pizarra de la acera. Lo cobra el servidor.
// Tras verlo (Francisco: «que su interfaz sea un poco más atractiva»): Pilar en la cabecera con lo que llevas encargado, cada
// tarea con su dibujo, la escalera de grados a la vista (lo que viene y desde qué nivel), lo que te ha dado hasta hoy y, en la
// hucha, en cuántos días se paga sola. Al encargar, el sello de «¡Apuntado!».
import { useState } from 'react';
import { PixelArt } from './PixelArt';
import { anfitrion, conQuien } from './cafePersonaje';
import { CAJA, GRANO, HUCHA, PIZARRA } from './cafeIconos';
import { GRADOS_TOTAL, TAREAS, estadoTarea, gradosHechos } from './cafeCuaderno';
import { errorCafe, mejorarPilar } from './cafeService';
import './cafeCuaderno.css';

const ICONO = { caja: CAJA, hucha: HUCHA, pizarra: PIZARRA };

export function CuadernoPilar({ local, onCambio, onCerrar, sfx = null }) {
  const [ocupado, setOcupado] = useState(null);
  const [error, setError] = useState(null);
  const [hecho, setHecho] = useState(null);
  const pilar = local?.pilar ?? null;
  const hechos = gradosHechos(pilar);

  const encargar = async (t) => {
    setOcupado(t.id);
    setError(null);
    setHecho(null);
    try {
      const r = await mejorarPilar(t.id);
      sfx?.play('campanilla');
      onCambio?.(r);
      setHecho(t.id);
    } catch (e) {
      setError(errorCafe(e));
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="cf3-balda cf3-cuaderno" role="region" aria-label={`El cuaderno de ${anfitrion().nombre}`}>
      <div className="cf3-cuaderno__cabeza">
        <span className="cf3-cuaderno__pilar" aria-hidden="true">
          <PixelArt icono={anfitrion().retrato('lee')} />
        </span>
        <div className="cf3-cuaderno__titulos">
          <h2 className="cf3-cuaderno__titulo">El cuaderno de {anfitrion().nombre}</h2>
          {pilar && (
            <p className="cf3-cuaderno__marcador" aria-label={`Llevas ${hechos} de ${GRADOS_TOTAL} encargos`}>
              <span className="cf3-cuaderno__barra" aria-hidden="true">
                <span style={{ width: `${Math.round((hechos / GRADOS_TOTAL) * 100)}%` }} />
              </span>
              <span aria-hidden="true">
                {hechos} / {GRADOS_TOTAL}
              </span>
            </p>
          )}
        </div>
        <button type="button" className="cf3-btn" onClick={onCerrar} data-atras>
          Cerrar
        </button>
      </div>
      {!pilar ? (
        <p className="cf3-cuaderno__nota">«Aún no tengo cuaderno. Muy pronto podrás encargarme tareas.»</p>
      ) : (
        <>
          <p className="cf3-cuaderno__nota">
            {hechos === GRADOS_TOTAL ? '«Lo tengo todo apuntado. Este café va solo… casi.»' : '«Encárgame algo y lo haré siempre, también cuando no estés. Se paga una vez.»'}
          </p>
          <ul className="cf3-cuaderno__lista">
            {TAREAS.map((t) => {
              const e = estadoTarea(t, { pilar, nivel: local.nivel, granos: local.granos });
              const quePone = e.falta === 'hecho' ? 'Hecho' : e.falta === 'nivel' ? `Desde el nivel ${e.siguiente.nivel}` : e.grado ? 'Mejorar' : 'Encargar';
              const dado = t.dado(pilar.dado);
              return (
                <li
                  key={t.id}
                  className="cf3-cuaderno__tarea"
                  data-tarea={t.id}
                  data-grado={e.grado}
                  data-cerrada={e.falta === 'nivel' && e.grado === 0 ? 'true' : undefined}
                  data-completa={e.falta === 'hecho' ? 'true' : undefined}
                  data-recien={hecho === t.id ? 'true' : undefined}
                >
                  <span className="cf3-cuaderno__icono" aria-hidden="true">
                    <PixelArt icono={ICONO[t.id]} />
                  </span>
                  <div className="cf3-cuaderno__texto">
                    <p className="cf3-cuaderno__nombre">{t.nombre}</p>
                    <ol className="cf3-cuaderno__escalera" aria-label={`Grado ${e.grado} de ${t.grados.length}`}>
                      {t.grados.map((g, k) => (
                        <li key={k} aria-hidden="true" data-estado={k < e.grado ? 'hecho' : k === e.grado ? (e.falta === 'nivel' ? 'cerrado' : 'siguiente') : 'luego'}>
                          {k < e.grado ? '✓ ' : ''}
                          {g.corto}
                          {k >= e.grado && g.nivel > local.nivel ? <small> · Nv {g.nivel}</small> : null}
                        </li>
                      ))}
                    </ol>
                    <p className="cf3-cuaderno__efecto">
                      {e.actual ? <strong>Ahora: {conQuien(e.actual.efecto)}.</strong> : null}
                      {e.siguiente ? ` ${e.actual ? 'Siguiente' : 'Con ella'}: ${conQuien(e.siguiente.efecto)}.` : ''}
                    </p>
                    {e.seaPagaEn && e.falta !== 'hecho' && <p className="cf3-cuaderno__paga">Se paga sola en {e.seaPagaEn} días; luego, todo es ganancia.</p>}
                    <p className="cf3-cuaderno__detalle">{conQuien(t.nota)}</p>
                    {t.id === 'hucha' && e.grado > 0 && <p className="cf3-cuaderno__detalle">Ahora guarda {pilar.huchaLista} granos.</p>}
                    {dado && (
                      <p className="cf3-cuaderno__dado">
                        <span>Te ha dado</span> {dado}
                      </p>
                    )}
                    {hecho === t.id && (
                      <p className="cf3-cuaderno__hecho" role="status">
                        «¡Apuntado! Me pongo con ello.»
                      </p>
                    )}
                  </div>
                  {e.falta === 'hecho' ? (
                    <span className="cf3-cuaderno__listo">Hecho</span>
                  ) : (
                    <button
                      type="button"
                      className="cf3-btn cf3-cuaderno__btn"
                      disabled={Boolean(ocupado) || Boolean(e.falta)}
                      aria-label={
                        e.falta === 'nivel'
                          ? `${t.nombre}: ${e.grado ? 'el siguiente grado se abre' : 'se abre'} en el nivel ${e.siguiente.nivel}`
                          : `${quePone} ${t.nombre.toLowerCase()} por ${e.siguiente.precio} granos${e.falta === 'granos' ? ' (no tienes bastantes)' : ''}`
                      }
                      onClick={() => encargar(t)}
                    >
                      {e.falta === 'nivel' ? (
                        <span>Nivel {e.siguiente.nivel}</span>
                      ) : (
                        <>
                          <span>{quePone}</span>
                          <span className="cf3-cuaderno__precio" data-falta={e.falta === 'granos' ? 'true' : undefined}>
                            <PixelArt icono={GRANO} />
                            {e.siguiente.precio}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                  {hecho === t.id && (
                    <span className="cf3-cuaderno__sello" aria-hidden="true">
                      ¡Apuntado!
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {error && (
        <p className="cf3-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
