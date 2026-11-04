// El tablón de la Lonja (1.86): arriba, «Se busca», lo que quieren los vecinos, sin texto libre: si tienes copia la ofreces en tu
// puesto. Debajo, los talleres: lo que tienes y lo que te falta de cada uno, y tocar lo que falta lo marca en el tablón (hasta tres).
// Con un taller completo se recoge su placa y los sellos. Lo decide el servidor (piso_lonja_buscar, piso_taller_recoger).
import { useEffect, useRef } from 'react';
import { catalogItem } from '../catalog';
import { PREMIO_TALLER, TALLERES, placaDe } from '../talleres';
import { sellosDe } from './estiba';
import { arteMueble } from './LonjaPared';

const nombre = (id) => catalogItem(id)?.nombre ?? id;
const TOPE = 3;

function quienes({ cuantos, quienes: nombres }) {
  const resto = cuantos - nombres.length;
  const lista = resto > 0 ? [...nombres, `${resto} más`] : nombres;
  return lista.length > 1 ? `${lista.slice(0, -1).join(', ')} y ${lista.at(-1)}` : lista[0];
}

function Taller({ taller, estado, buscas, busy, onBuscar, onRecoger }) {
  const faltan = new Set(estado?.faltan ?? taller.muebles);
  const tiene = taller.muebles.length - faltan.size;
  const completo = faltan.size === 0;
  return (
    <article className={`lj-taller${completo ? ' is-completo' : ''}`} style={{ '--taller': `rgb(${taller.color.join(' ')})` }} aria-labelledby={`lj-taller-${taller.id}`}>
      <header>
        <h5 id={`lj-taller-${taller.id}`}>{taller.nombre}</h5>
        <p>{taller.lema}</p>
        <span className="lj-taller__cuenta">
          {tiene} de {taller.muebles.length}
        </span>
      </header>
      <ul className="lj-taller__muebles" aria-label={`Muebles de ${taller.nombre}`}>
        {taller.muebles.map((id) => {
          const falta = faltan.has(id);
          const buscado = buscas.includes(id);
          return (
            <li key={id} className={falta ? 'is-falta' : ''}>
              {falta ? (
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={buscado}
                  aria-label={`${nombre(id)}: te falta. ${buscado ? 'Quitar del tablón' : 'Marcar en el tablón'}`}
                  onClick={() => onBuscar(id, !buscado)}
                >
                  <img src={arteMueble(id)} alt="" width="48" height="48" draggable="false" />
                  {buscado && <i aria-hidden="true" />}
                </button>
              ) : (
                <img src={arteMueble(id)} alt={nombre(id)} title={nombre(id)} width="48" height="48" draggable="false" />
              )}
            </li>
          );
        })}
      </ul>
      {estado?.recogido ? (
        <p className="lj-taller__placa">
          <img src={arteMueble(placaDe(taller.id))} alt="" width="32" height="32" />
          Placa recogida: cuélgala en tu piso.
        </p>
      ) : completo ? (
        <button type="button" className="lj-btn is-sello is-chico" disabled={busy} onClick={() => onRecoger(taller.id)}>
          Recoger la placa y {sellosDe(PREMIO_TALLER)}
        </button>
      ) : (
        <p className="lj-taller__premio">Al completarlo: su placa para la pared y {sellosDe(PREMIO_TALLER)}.</p>
      )}
    </article>
  );
}

export function LonjaTablon({ lonja, busy, cara, onBuscar, onRecoger, onOfrecer }) {
  const estados = new Map(lonja.talleres.map((t) => [t.id, t]));
  const raiz = useRef(null);
  // El tablón, a la vista nada más entrar
  useEffect(() => {
    raiz.current?.scrollIntoView({ block: 'start' });
  }, []);
  return (
    <div className="lj-estiba" ref={raiz}>
      <p className="lj-dice">
        <img src={cara} alt="" draggable="false" />
        <span>{lonja.tablon.length ? 'Aquí se apunta lo que se busca. Si lo tienes, ya sabes.' : 'Hoy nadie busca nada. Marca tú lo que te falta.'}</span>
      </p>

      <section className="lj-corcho" aria-labelledby="lj-corcho-t">
        <h4 id="lj-corcho-t">Se busca</h4>
        {lonja.tablon.length ? (
          <ul>
            {lonja.tablon.map((e) => (
              <li key={e.mueble}>
                <img src={arteMueble(e.mueble)} alt="" width="56" height="56" draggable="false" />
                <b>{nombre(e.mueble)}</b>
                <span>Lo busca {quienes(e)}</span>
                {e.tienes ? (
                  <button type="button" className="lj-btn is-chico" aria-label={`Ofrecer ${nombre(e.mueble)} en tu puesto`} onClick={() => onOfrecer(e.mueble)}>
                    Ofrecer
                  </button>
                ) : (
                  <em>No tienes copia libre</em>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="lj-corcho__vacio">El tablón está vacío.</p>
        )}
      </section>

      <div className="lj-buscas">
        <p>
          Tú buscas ({lonja.buscas.length} de {TOPE})
        </p>
        {lonja.buscas.length ? (
          <ul>
            {lonja.buscas.map((id) => (
              <li key={id}>
                <img src={arteMueble(id)} alt="" width="32" height="32" draggable="false" />
                <b>{nombre(id)}</b>
                <button type="button" className="lj-link" disabled={busy} aria-label={`Quitar ${nombre(id)} del tablón`} onClick={() => onBuscar(id, false)}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="lj-nota">Toca un mueble que te falte en los talleres de abajo.</p>
        )}
      </div>

      <h4 className="lj-pared__titulo lj-talleres__titulo">Los talleres del puerto</h4>
      <div className="lj-talleres">
        {TALLERES.map((t) => (
          <Taller key={t.id} taller={t} estado={estados.get(t.id)} buscas={lonja.buscas} busy={busy} onBuscar={onBuscar} onRecoger={onRecoger} />
        ))}
      </div>
    </div>
  );
}
