// 1.102 (SPEC §102) · El probador del Almacén del Puerto: te cambias la ropa que ya tienes delante del espejo grande.
// Lo que tocas se ve al momento en el espejo (o en la muestra, sin 3D) y «Listo» lo guarda; «Volver» lo deja como estaba.
// No vende ropa ni cuenta misiones: la ropa nueva sigue saliendo de las misiones del día, el casino y la estiba.
import { useMemo, useState } from 'react';
import { prendaKey } from '../actor';
import { FILAS_ROPA, GANABLES, mismoLook, opcionesDe } from './ropa';
import { renderActorThumb } from '../render';

const muestras = new Map();
function muestra(avatar, frame, size) {
  const key = JSON.stringify(avatar) + frame + size;
  if (!muestras.has(key)) muestras.set(key, renderActorThumb(avatar, { frame, size }).toDataURL());
  return muestras.get(key);
}

/**
 * `look`: cómo vas ahora en el espejo; `base`: cómo ibas al entrar; `prendas`: lo ganado (null: sin la migración de las
 * misiones, solo lo de serie); `sin3d`: sin espejo en la escena, la muestra va en el papel.
 */
export function Probador({ look, base, prendas, onLook, onListo, guardando = false, error = '', sin3d = false }) {
  const [filaId, setFilaId] = useState(FILAS_ROPA[0].key);
  const fila = FILAS_ROPA.find((f) => f.key === filaId);
  const opciones = useMemo(() => opcionesDe(fila, prendas, base), [fila, prendas, base]);
  const tienes = prendas ? GANABLES.filter((p) => prendas.includes(p)).length : 0;
  const cambiado = !mismoLook(look, base);
  return (
    <div className="alm-probador">
      {sin3d && <img className="alm-probador__muestra" src={muestra(look, 'all', 96)} width="96" height="96" alt="Tu personaje con lo que te has puesto" />}
      <div className="alm-probador__filas" role="tablist" aria-label="Qué te cambias">
        {FILAS_ROPA.map((f) => (
          <button key={f.key} type="button" role="tab" className="alm-probador__fila" aria-selected={f.key === filaId} onClick={() => setFilaId(f.key)}>
            {f.corto ?? f.nombre}
          </button>
        ))}
      </div>
      <div className="alm-probador__perchas" role="group" aria-label={fila.nombre}>
        {opciones.map((o) => {
          const next = { ...look, [fila.key]: o.value };
          return (
            <button key={String(o.value)} type="button" className="alm-percha" aria-pressed={look[fila.key] === o.value} data-prenda={prendaKey(fila.key, o.value)} onClick={() => onLook(next)}>
              <img src={muestra(next, fila.frame, 44)} width="44" height="44" alt="" />
              <span>{o.nombre}</span>
            </button>
          );
        })}
      </div>
      <p className="alm-nota alm-probador__nota">
        {prendas
          ? `Tienes ${tienes} de ${GANABLES.length} prendas especiales.`
          : 'Aquí está la ropa de serie.'}{' '}
        Aquí no se vende ropa: la nueva sale de las misiones del día, la caja del casino y la estiba.
      </p>
      {error && (
        <p className="alm-aviso" role="alert">
          {error}
        </p>
      )}
      <div className="alm-probador__pie">
        <button type="button" className="alm-btn alm-btn--papel" disabled={!cambiado || guardando} onClick={() => onLook(base)}>
          Como iba
        </button>
        <button type="button" className="alm-btn alm-btn--primario" disabled={guardando} onClick={onListo}>
          {guardando ? 'Guardando…' : cambiado ? 'Listo, me lo quedo' : 'Listo'}
        </button>
      </div>
    </div>
  );
}
