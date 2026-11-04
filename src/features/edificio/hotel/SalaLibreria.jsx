// La librería de la sala de lectura (1.83, docs/qa/gran-hotel.md §9.5): una balda común con los lomos de los libros que
// la gente ha terminado leyendo aquí. Al tocar un lomo se ve qué libro es y quién lo dejó; el tuyo se puede retirar.
import { useState } from 'react';

const TONOS = ['#96362f', '#345c6e', '#b08846', '#40684c', '#78466e', '#8a5a3a'];

// El mismo libro siempre tiene el mismo lomo: color y altura salen del título
function lomoDe(titulo) {
  let n = 7;
  for (const c of titulo) n = (n * 31 + c.charCodeAt(0)) % 9973;
  return { background: TONOS[n % TONOS.length], height: `${72 + (n % 5) * 7}%` };
}

export function SalaLibreria({ libreria, onRetirar }) {
  const [abierto, setAbierto] = useState(null);
  const elegido = libreria.lomos.find((l) => l.id === abierto) ?? null;
  return (
    <section className="gh-lect__lib" aria-labelledby="gh-lect-lib">
      <h4 className="gh-21__lobbytitle" id="gh-lect-lib">
        La librería de la sala
      </h4>
      {libreria.lomos.length === 0 ? (
        <p className="gh-21__empty">Aún está vacía. Quien termine aquí un libro podrá dejar su lomo.</p>
      ) : (
        <>
          <div className="gh-lect__balda" role="list" aria-label="Libros terminados en la sala">
            {libreria.lomos.map((l) => (
              <span key={l.id} role="listitem" className="gh-lect__lomoitem">
                <button
                  type="button"
                  className={l.id === abierto ? 'gh-lect__lomo is-on' : 'gh-lect__lomo'}
                  style={lomoDe(l.titulo)}
                  aria-label={`«${l.titulo}», de ${l.mio ? 'ti' : (l.alias ?? 'alguien')}`}
                  aria-pressed={l.id === abierto}
                  onClick={() => setAbierto(l.id === abierto ? null : l.id)}
                />
              </span>
            ))}
          </div>
          <p className="gh-lect__libnote" role="status">
            {elegido ? (
              <>
                <em>{elegido.titulo}</em>, {elegido.mio ? 'lo dejaste tú' : `lo dejó ${elegido.alias ?? 'alguien'}`}.
              </>
            ) : libreria.total === 1 ? (
              'Un libro terminado aquí.'
            ) : (
              `${libreria.total} libros terminados aquí.`
            )}
          </p>
          {elegido?.mio && (
            <button
              type="button"
              className="gh-21link gh-lect__retirar"
              onClick={() => {
                setAbierto(null);
                onRetirar(elegido.id);
              }}
            >
              Retirar mi lomo
            </button>
          )}
        </>
      )}
    </section>
  );
}
