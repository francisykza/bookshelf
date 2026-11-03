// La caja del casino (1.80; Francisco, 3-11-2026: «muy atractiva, con recompensas muy llamativas»): la ventanilla
// donde las fichas se cambian por un sobre de coleccionista, ropa del personaje, muebles con efectos y el conejo de la
// chistera, que va arriba de todo, vivo, como premio gordo. Cada cosa con su dibujo de verdad (el mismo motor del
// edificio), su precio en fichas y, si ya es tuya, su sello. Se pide confirmación antes de cambiar y, al cambiar, un
// destello con lo que te llevas y dónde encontrarlo. Lo cobra y lo da el servidor (piso_casino_canjear).
// Sin cuentas atrás ni ofertas: los precios no cambian y lo que no es el sobre se tiene una vez.
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_AVATAR } from '../actor';
import { catalogItem } from '../catalog';
import { rarezaInfo, SOBRES } from '../economy';
import { misticoSprite, misticoThumb } from '../misticos';
import { renderActorThumb, renderThumb } from '../render';
import { canjearCaja } from '../service';
import { packArt } from '../shopArt';
import { PixelNum } from './cartas21';
import { CAJA, fichasDe } from './veintiuna';

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Recorta lo dibujado (sin el aire de la miniatura del catálogo) y lo amplía a un cuadrado de `size`. */
function recortar(canvas, size) {
  const { width: w, height: h } = canvas;
  const px = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < w * h; i += 1) {
    if (px[i * 4 + 3] < 60) continue;
    const x = i % w;
    const y = (i / w) | 0;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  if (x1 < 0) return canvas;
  const lado = Math.max(x1 - x0, y1 - y0) + 1;
  const fit = (size * 0.86) / lado;
  const k = fit >= 2 ? Math.floor(fit) : fit;
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const dw = (x1 - x0 + 1) * k;
  const dh = (y1 - y0 + 1) * k;
  ctx.drawImage(canvas, x0, y0, x1 - x0 + 1, y1 - y0 + 1, Math.round((size - dw) / 2), Math.round((size - dh) / 2), dw, dh);
  return out;
}

// Los dibujos, hechos una vez
const arts = new Map();
function artOf(a) {
  if (arts.has(a.id)) return arts.get(a.id);
  let src;
  if (a.tipo === 'sobre') src = packArt(SOBRES.find((s) => s.id === 'coleccion')).full;
  else if (a.tipo === 'prenda') {
    const [key, raw] = a.id.split(':');
    const frame = key === 'complemento' ? 'head' : key === 'pantalon' ? 'legs' : raw === '16' ? 'all' : 'torso';
    src = renderActorThumb({ ...DEFAULT_AVATAR, [key]: key === 'complemento' ? raw : Number(raw) }, { frame, size: 96 }).toDataURL();
  } else if (a.tipo === 'companero') src = misticoThumb(a.id, 96).toDataURL();
  else src = recortar(renderThumb(a.id, 0, 192), 96).toDataURL();
  arts.set(a.id, src);
  return src;
}
const thumbOf = (mueble) => {
  const key = `m:${mueble}`;
  if (!arts.has(key)) arts.set(key, recortar(renderThumb(mueble, 0, 128), 96).toDataURL());
  return arts.get(key);
};

const DONDE = {
  prenda: 'Ya está en el armario de tu piso: póntela cuando quieras.',
  mueble: 'Ya está en tu inventario: colócalo en tu piso del edificio.',
  companero: 'Elígelo en el armario de tu piso y te acompañará a todas partes.',
  sobre: 'Ya está en tu inventario.',
};
const TIPO = { prenda: 'Ropa', mueble: 'Mueble', companero: 'Legendario', sobre: 'Sobre' };

/** El conejo, vivo, en la tarjeta grande (quieto con movimiento reducido). */
function Vivo({ id }) {
  const host = useRef(null);
  useEffect(() => {
    const sprite = misticoSprite(id);
    sprite.canvas.className = 'gh-caja__live';
    sprite.canvas.setAttribute('aria-hidden', 'true');
    host.current?.append(sprite.canvas);
    if (reducedMotion()) {
      sprite.paint(1.3);
      return () => sprite.canvas.remove();
    }
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    const tick = (now) => {
      if (now - last > 32) {
        last = now;
        sprite.paint((now - t0) / 1000);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      sprite.canvas.remove();
    };
  }, [id]);
  return <span className="gh-caja__stage" ref={host} />;
}

export function CajaCasino({ data, dia, onData, sfx }) {
  const [pide, setPide] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [premio, setPremio] = useState(null);
  const tienes = new Map(data.caja.map((x) => [x.id, x.tienes]));
  const articulos = CAJA.map((a) => ({ ...a, tienes: Boolean(tienes.get(a.id)) }));
  const gordo = articulos.find((a) => a.tipo === 'companero');
  const resto = articulos.filter((a) => a !== gordo);

  const cambiar = async (a) => {
    setBusy(true);
    setMsg('');
    try {
      const next = await canjearCaja(dia, a.id);
      onData(next);
      setPide(null);
      setPremio({ articulo: a, premios: next.premios ?? [] });
      sfx.play('chips');
      setTimeout(() => sfx.play('mano-veintiuna'), 260);
    } catch (e) {
      setMsg(`No se ha podido: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  /** El botón (o el sello) de cada cosa, con la confirmación en el sitio. */
  const acciones = (a) => {
    if (a.tienes) return <p className="gh-caja__stamp">Ya es tuyo</p>;
    const falta = a.precio - data.fichas;
    if (pide === a.id)
      return (
        <div className="gh-caja__ask" role="group" aria-label={`¿Cambias ${fichasDe(a.precio)} por ${a.nombre}?`}>
          <span>¿Cambias {fichasDe(a.precio)}?</span>
          <button type="button" className="gh-21btn is-deal is-small" disabled={busy} onClick={() => cambiar(a)}>
            Sí, cambiar
          </button>
          <button type="button" className="gh-21link" disabled={busy} onClick={() => setPide(null)}>
            No
          </button>
        </div>
      );
    return (
      <button
        type="button"
        className="gh-21btn is-small gh-caja__buy"
        disabled={falta > 0}
        aria-label={falta > 0 ? `${a.nombre}: te faltan ${fichasDe(falta)}` : `Cambiar ${fichasDe(a.precio)} por ${a.nombre}`}
        onClick={() => (sfx.play('tap'), setPide(a.id), setMsg(''))}
      >
        {falta > 0 ? `Faltan ${falta}` : 'Cambiar'}
      </button>
    );
  };
  const precio = (a) => (
    <p className="gh-caja__price">
      <i aria-hidden="true" />
      <PixelNum value={a.precio} label={fichasDe(a.precio)} />
    </p>
  );

  if (premio) {
    const { articulo: a, premios } = premio;
    return (
      <div className="gh-21__felt is-caja">
        <div className="gh-caja__reveal" role="status">
          <span className="gh-caja__rays" aria-hidden="true" />
          <h4>{a.tipo === 'sobre' ? '¡Sobre abierto!' : '¡Es tuyo!'}</h4>
          {a.tipo === 'sobre' ? (
            <ul className="gh-caja__prizes" aria-label="Lo que traía el sobre">
              {premios.map((x, k) => {
                const cat = catalogItem(x.mueble);
                return (
                  <li key={k} className={`is-${x.rareza}`}>
                    <img src={thumbOf(x.mueble)} alt="" width="64" height="64" />
                    <b>{cat?.nombre ?? x.mueble}</b>
                    <span>
                      {rarezaInfo(x.rareza).nombre}
                      {x.nuevo ? ' · ¡nuevo!' : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <>
              <img className="gh-caja__prize" src={artOf(a)} alt="" width="96" height="96" />
              <p className="gh-caja__name">{a.nombre}</p>
            </>
          )}
          <p>{DONDE[a.tipo]}</p>
          <button type="button" className="gh-21btn is-deal is-small" onClick={() => setPremio(null)}>
            Volver a la caja
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="gh-21__felt is-caja">
        <h4 className="gh-21__lobbytitle">La caja</h4>
        <article className={`gh-caja__jackpot${gordo.tienes ? ' is-mine' : ''}`} aria-labelledby="gh-caja-gordo">
          <span className="gh-caja__rays" aria-hidden="true" />
          <p className="gh-caja__ribbon">Legendario · con efectos</p>
          <Vivo id={gordo.id} />
          <div className="gh-caja__info">
            <h5 id="gh-caja-gordo">{gordo.nombre}</h5>
            <p>{gordo.texto}</p>
            {precio(gordo)}
            {!gordo.tienes && (
              <span className="gh-21__bar gh-caja__goal" role="progressbar" aria-label={`Fichas para el ${gordo.nombre.toLowerCase()}`} aria-valuemin={0} aria-valuemax={gordo.precio} aria-valuenow={Math.min(data.fichas, gordo.precio)}>
                <span style={{ width: `${Math.min(100, (data.fichas / gordo.precio) * 100)}%` }} />
              </span>
            )}
            {acciones(gordo)}
          </div>
        </article>
        <ul className="gh-caja__grid" aria-label="Lo que hay en la caja">
          {resto.map((a) => (
            <li key={a.id} className={`gh-caja__item is-${a.tipo}${a.tienes ? ' is-mine' : ''}`}>
              <p className="gh-caja__kind">
                {TIPO[a.tipo]}
                {a.efecto && <b> · con efectos</b>}
              </p>
              <img src={artOf(a)} alt="" width="96" height="96" />
              <h5>{a.nombre}</h5>
              <p className="gh-caja__text">{a.texto}</p>
              {precio(a)}
              {acciones(a)}
            </li>
          ))}
        </ul>
      </div>
      <p className="gh-21__msg" role="status" aria-live="polite">
        {msg}
      </p>
    </>
  );
}
