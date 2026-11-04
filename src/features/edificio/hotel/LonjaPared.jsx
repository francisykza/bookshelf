// La pared de premios de la Lonja (1.86): lo que se puede conseguir con los sellos de la estiba, colgado a la vista y nunca plegado.
// Arriba, la gaviota viva como premio gordo; debajo, ropa de estibador, lo del puesto y los acabados. Cada cosa con su dibujo de
// verdad y su precio. Un acabado se elige sin azar y se pone en una copia lisa tuya. Sin ofertas ni cuentas atrás: los precios no
// cambian. Lo cobra y lo da el servidor (piso_lonja_canjear); nada de esto da tickets.
import { useState } from 'react';
import { ACABADOS, admiteAcabado } from '../acabados';
import { DEFAULT_AVATAR } from '../actor';
import { catalogItem } from '../catalog';
import { misticoThumb } from '../misticos';
import { renderActorThumb, renderThumb } from '../render';
import { Vivo, recortar } from './CajaCasino';
import { PARED, sellosDe } from './estiba';
import { TOLDOS_ESPECIALES } from './lonjaArt';

const DONDE = {
  prenda: 'Ya está en el armario de tu piso.',
  companero: 'Elígela en el armario de tu piso y te acompañará a todas partes.',
  acabado: 'Esa copia ya luce su acabado en tu inventario.',
  puesto: 'Ya es tuyo.',
};
const artes = new Map();
function arte(clave, hacer) {
  if (!artes.has(clave)) artes.set(clave, hacer());
  return artes.get(clave);
}
function arteDe(a) {
  return arte(a.id, () => {
    if (a.tipo === 'companero') return misticoThumb(a.id, 96).toDataURL();
    const [key, raw] = a.id.split(':');
    const frame = key === 'complemento' ? 'head' : key === 'pantalon' ? 'legs' : 'torso';
    return renderActorThumb({ ...DEFAULT_AVATAR, [key]: key === 'complemento' ? raw : Number(raw) }, { frame, size: 96 }).toDataURL();
  });
}
export const arteMueble = (mueble, acabado = null) => arte(`${mueble}@${acabado}`, () => recortar(renderThumb(mueble, 0, 128, acabado), 96).toDataURL());

function Precio({ n }) {
  return (
    <p className="lj-etiqueta__precio">
      <i aria-hidden="true" />
      {sellosDe(n)}
    </p>
  );
}

export function LonjaPared({ lonja, busy, sfx, onCanjear, onToldo }) {
  const [pide, setPide] = useState(null);
  const [acabado, setAcabado] = useState(null);
  const [premio, setPremio] = useState(null);
  const [ahora] = useState(() => Date.now());
  const tienes = new Map(lonja.estiba.pared.map((x) => [x.id, x.tienes]));
  const articulos = PARED.map((a) => ({ ...a, tienes: Boolean(tienes.get(a.id)) }));
  const gordo = articulos.find((a) => a.tipo === 'companero');
  const ropa = articulos.filter((a) => a.tipo === 'prenda');
  const hueco = lonja.huecoHasta && new Date(lonja.huecoHasta).getTime() > ahora;
  const copias = Object.entries(lonja.libres)
    .filter(([id, n]) => n > 0 && admiteAcabado(id))
    .map(([id]) => id);

  const cambiar = async (que, nombre, tipo, img) => {
    setPide(null);
    const hecho = await onCanjear(que);
    if (hecho) {
      setPremio({ nombre, tipo, img });
      setAcabado(null);
    }
  };

  /** El botón de cada cosa, con la confirmación en el sitio. */
  const accion = (id, nombre, precio, tipo, img, que = id) => {
    const falta = precio - lonja.sellos;
    if (pide === id)
      return (
        <div className="lj-etiqueta__ask" role="group" aria-label={`¿Cambias ${sellosDe(precio)} por ${nombre}?`}>
          <button type="button" className="lj-btn is-sello is-chico" disabled={busy} onClick={() => cambiar(que, nombre, tipo, img)}>
            Sí, cambiar
          </button>
          <button type="button" className="lj-link" onClick={() => setPide(null)}>
            No
          </button>
        </div>
      );
    return (
      <button
        type="button"
        className="lj-btn is-chico"
        disabled={busy || falta > 0}
        aria-label={falta > 0 ? `${nombre}: te faltan ${sellosDe(falta)}` : `Cambiar ${sellosDe(precio)} por ${nombre}`}
        onClick={() => (sfx.play('tap'), setPide(id))}
      >
        {falta > 0 ? `Faltan ${falta}` : 'Cambiar'}
      </button>
    );
  };

  const elegido = ACABADOS.find((a) => a.id === acabado);

  return (
    <section className="lj-pared" aria-labelledby="lj-pared-t">
      <h4 id="lj-pared-t" className="lj-pared__titulo">
        La pared de premios
      </h4>
      <p className="lj-pared__saldo">
        Tienes <b>{sellosDe(lonja.sellos)}</b>. Los sellos no caducan.
      </p>

      {premio && (
        <div className="lj-premio-nuevo" role="status">
          {premio.img && <img src={premio.img} alt="" width="72" height="72" />}
          <p>
            <b>¡{premio.nombre}!</b>
            <span>{DONDE[premio.tipo]}</span>
          </p>
          <button type="button" className="lj-link" onClick={() => setPremio(null)}>
            Vale
          </button>
        </div>
      )}

      <article className={`lj-gordo${gordo.tienes ? ' is-mio' : ''}`} aria-labelledby="lj-gordo-t">
        <Vivo id={gordo.id} />
        <div>
          <p className="lj-gordo__cinta">Legendaria · te acompaña</p>
          <h5 id="lj-gordo-t">{gordo.nombre}</h5>
          <p>{gordo.texto}</p>
          <Precio n={gordo.precio} />
          {gordo.tienes ? (
            <p className="lj-etiqueta__mia">Ya es tuya</p>
          ) : (
            <>
              <span
                className="lj-gordo__meta"
                role="progressbar"
                aria-label="Sellos para la gaviota"
                aria-valuemin={0}
                aria-valuemax={gordo.precio}
                aria-valuenow={Math.min(gordo.precio, lonja.sellos)}
              >
                <span style={{ width: `${Math.min(100, (lonja.sellos / gordo.precio) * 100)}%` }} />
              </span>
              {accion(gordo.id, gordo.nombre, gordo.precio, 'companero', arteDe(gordo))}
            </>
          )}
        </div>
      </article>

      <h5 className="lj-pared__balda">Ropa de estibador</h5>
      <ul className="lj-etiquetas">
        {ropa.map((a) => (
          <li key={a.id} className={`lj-etiqueta${a.tienes ? ' is-mio' : ''}`}>
            <img src={arteDe(a)} alt="" width="72" height="72" />
            <b>{a.nombre}</b>
            <span>{a.texto}</span>
            <Precio n={a.precio} />
            {a.tienes ? <p className="lj-etiqueta__mia">Ya es tuyo</p> : accion(a.id, a.nombre, a.precio, 'prenda', arteDe(a))}
          </li>
        ))}
      </ul>

      <h5 className="lj-pared__balda">Un acabado a tu elección</h5>
      <p className="lj-pared__nota">Sin azar: eliges el acabado y una copia lisa guardada, y esa copia lo lleva para siempre.</p>
      <ul className="lj-etiquetas is-cuatro">
        {ACABADOS.map((a) => (
          <li key={a.id} className={`lj-etiqueta is-acabado${acabado === a.id ? ' is-elegida' : ''}`}>
            <img src={arteMueble('sofa', a.id)} alt="" width="72" height="72" />
            <b>{a.nombre}</b>
            <Precio n={lonja.estiba.acabados[a.id] ?? 0} />
            <button type="button" className="lj-btn is-chico" aria-pressed={acabado === a.id} onClick={() => (sfx.play('tap'), setPide(null), setAcabado(acabado === a.id ? null : a.id))}>
              {acabado === a.id ? 'Elegido' : 'Elegir'}
            </button>
          </li>
        ))}
      </ul>
      {elegido && (
        <div className="lj-copias">
          {copias.length ? (
            <>
              <p>¿En qué copia va el {elegido.nombre.toLowerCase()}?</p>
              <ul>
                {copias.map((id) => {
                  const nombre = `${catalogItem(id)?.nombre ?? id}, ${elegido.nombre.toLowerCase()}`;
                  const img = arteMueble(id, elegido.id);
                  return (
                    <li key={id}>
                      <img src={img} alt="" width="48" height="48" />
                      <b>{catalogItem(id)?.nombre ?? id}</b>
                      {accion(`acabado:${id}`, nombre, lonja.estiba.acabados[elegido.id], 'acabado', img, `acabado:${elegido.id}:${id}`)}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p>Hace falta una copia lisa guardada, ni colocada ni recién llegada. Guarda un mueble en tu piso y vuelve.</p>
          )}
        </div>
      )}

      <h5 className="lj-pared__balda">Para tu puesto</h5>
      <ul className="lj-canje">
        <li>
          <p>
            <b>Venta sin comisión</b>
            <span>La próxima venta, entera para ti. Guardadas: {lonja.sinComision} de 2.</span>
          </p>
          {lonja.sinComision >= 2 ? <p className="lj-etiqueta__mia">Tienes dos</p> : accion('sin-comision', 'Venta sin comisión', 10, 'puesto', null)}
        </li>
        <li>
          <p>
            <b>Un hueco más</b>
            <span>{hueco ? 'Tu puesto ya tiene cuatro huecos: sumas siete días.' : 'Cuatro ofertas a la vez durante siete días.'}</span>
          </p>
          {accion('hueco', 'Un hueco más', 14, 'puesto', null)}
        </li>
        {Object.entries(TOLDOS_ESPECIALES).map(([id, t]) => (
          <li key={id}>
            <p>
              <b>{t.nombre}</b>
              <i className="lj-canje__toldo" style={{ '--toldo': `rgb(${t.color.join(' ')})` }} aria-hidden="true" />
            </p>
            {lonja.toldos.includes(id) ? (
              <button type="button" className="lj-link" disabled={busy} aria-pressed={lonja.toldo === id} onClick={() => onToldo(lonja.toldo === id ? null : id)}>
                {lonja.toldo === id ? 'Puesto' : 'Poner'}
              </button>
            ) : (
              accion(id, t.nombre, 18, 'puesto', null, `toldo:${id}`)
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
