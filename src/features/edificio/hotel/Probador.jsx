// 1.102 (SPEC §102) · El probador del Almacén del Puerto: te cambias la ropa que ya tienes delante del espejo grande.
// Lo que tocas se ve al momento en el espejo (o en la muestra, sin 3D) y «Listo» lo guarda; «Volver» lo deja como estaba.
// No vende ropa ni cuenta misiones: la ropa nueva sigue saliendo de las misiones del día, el casino y la estiba.
// 2.ª ampliación (bloque 2): baja a la planta de ropa y trae lo de la cesta. Lo que aún no es tuyo te lo pones para verte,
// marcado, pero «Listo» no lo guarda (dice cómo se gana).
import { useMemo, useState } from 'react';
import { isPrenda, prendaKey, usesLocked } from '../actor';
import { ORIGEN_TEXTO, origenDe } from './plantaRopa';
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
export function Probador({ look, base, prendas, cesta = [], onLook, onListo, guardando = false, error = '', sin3d = false }) {
  // Con cesta, se empieza por la fila de lo primero que traes
  const [filaId, setFilaId] = useState(() => FILAS_ROPA.find((f) => cesta.some((p) => p.split(':')[0] === f.key))?.key ?? FILAS_ROPA[0].key);
  const fila = FILAS_ROPA.find((f) => f.key === filaId);
  const deCesta = useMemo(() => new Set(cesta), [cesta]);
  const opciones = useMemo(() => {
    const tuyas = opcionesDe(fila, prendas, base);
    const extra = fila.options.filter((o) => deCesta.has(prendaKey(fila.key, o.value)) && !tuyas.includes(o));
    return [...tuyas, ...extra];
  }, [fila, prendas, base, deCesta]);
  const tienes = prendas ? GANABLES.filter((p) => prendas.includes(p)).length : 0;
  const cambiado = !mismoLook(look, base);
  const mias = prendas ?? [];
  const ajena = (key, value) => isPrenda(key, value) && !mias.includes(prendaKey(key, value)) && base[key] !== value;
  // Lo que llevas puesto que aún no es tuyo: se ve, pero no se guarda
  const prestado = FILAS_ROPA.map((f) => [f.key, look[f.key]]).find(([k, v]) => ajena(k, v));
  const bloqueado = !!prestado && usesLocked(look, mias);
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
            <button
              key={String(o.value)}
              type="button"
              className="alm-percha"
              aria-pressed={look[fila.key] === o.value}
              data-prenda={prendaKey(fila.key, o.value)}
              data-prestada={ajena(fila.key, o.value) || undefined}
              aria-label={ajena(fila.key, o.value) ? `${o.nombre}, de la cesta: solo para probar` : undefined}
              onClick={() => onLook(next)}
            >
              <img src={muestra(next, fila.frame, 44)} width="44" height="44" alt="" />
              <span>{o.nombre}</span>
            </button>
          );
        })}
      </div>
      <p className="alm-nota alm-probador__nota">
        {bloqueado
          ? `Lo marcado es de la cesta y aún no es tuyo: solo para verte. ${ORIGEN_TEXTO[origenDe(prendaKey(...prestado))]}.`
          : `${prendas ? `Tienes ${tienes} de ${GANABLES.length} prendas especiales.` : 'Aquí está la ropa de serie.'} Lo de la cesta se prueba aquí; la ropa especial sale de las misiones del día, la caja, la ruleta y las chisteras del casino y la estiba, o se compra con tickets en esta planta.`}
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
        <button type="button" className="alm-btn alm-btn--primario" disabled={guardando || bloqueado} onClick={onListo}>
          {guardando ? 'Guardando…' : bloqueado ? 'Aún no es tuyo' : cambiado ? 'Listo, me lo quedo' : 'Listo'}
        </button>
      </div>
    </div>
  );
}
