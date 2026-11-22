// 1.141 (§141): el ranking de los cafés, en la franja de abajo del café, como el panel de los libros. Dos ámbitos (tu edificio y
// a quien sigues) y tres tablas (nivel, granos ganados y esta semana); de cada café de otro, «Visitar» (pasear y mirar).
import { useEffect, useMemo, useState } from 'react';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { AMBITOS, TABLAS, ordenRanking } from './cafeSocial';
import { cargarRanking } from './cafeService';
import './cafeSocial.css';

const VACIO = {
  edificio: 'Aún no hay más cafés abiertos en tu edificio. Cuando tus vecinos abran el suyo, saldrán aquí.',
  seguidos: 'Sigue a otros lectores en la Comunidad y sus cafés saldrán aquí.',
};

export function RankingCafes({ onVisitar, onCerrar, sfx = null }) {
  const [ambito, setAmbito] = useState('edificio');
  const [tabla, setTabla] = useState('nivel');
  // { [ambito]: filas | null (sin la migración) | 'error' }; sin la clave, cargando
  const [datos, setDatos] = useState({});
  useEffect(() => {
    if (ambito in datos) return undefined;
    let vivo = true;
    cargarRanking(ambito).then(
      (filas) => vivo && setDatos((d) => ({ ...d, [ambito]: filas })),
      () => vivo && setDatos((d) => ({ ...d, [ambito]: 'error' })),
    );
    return () => {
      vivo = false;
    };
  }, [ambito, datos]);
  const filas = datos[ambito];
  const orden = useMemo(() => (Array.isArray(filas) ? ordenRanking(filas, tabla) : []), [filas, tabla]);
  const t = TABLAS.find((x) => x.id === tabla);
  const otros = orden.filter((f) => !f.yo).length;

  return (
    <div className="cf3-balda cf3-ranking" role="region" aria-label="Los cafés del barrio">
      <div className="cf3-balda__cabeza">
        <div className="cf3-balda__pestanas" role="tablist" aria-label="De quién">
          {AMBITOS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={ambito === a.id}
              className="cf3-pestana"
              onClick={() => {
                sfx?.play('papel');
                setAmbito(a.id);
              }}
            >
              {a.nombre}
            </button>
          ))}
        </div>
        <div className="cf3-balda__herr">
          <button type="button" className="cf3-btn" onClick={onCerrar} data-atras>
            Cerrar
          </button>
        </div>
      </div>

      <div className="cf3-ranking__tablas" role="radiogroup" aria-label="Ordenar por">
        {TABLAS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={tabla === x.id}
            className="cf3-ranking__tabla"
            onClick={() => {
              sfx?.play('toque');
              setTabla(x.id);
            }}
          >
            {x.nombre}
          </button>
        ))}
      </div>

      {filas === undefined ? (
        <p className="cf3-ranking__nota" role="status">
          Mirando los cafés del barrio…
        </p>
      ) : filas === 'error' ? (
        <p className="cf3-ranking__nota" role="alert">
          No se ha podido cargar el ranking. Vuelve a intentarlo en un rato.
        </p>
      ) : filas === null ? (
        <p className="cf3-ranking__nota">El ranking de los cafés llegará muy pronto.</p>
      ) : (
        <>
          <ol className="cf3-ranking__lista" aria-label={`${AMBITOS.find((a) => a.id === ambito).nombre}, por ${t.nombre.toLowerCase()}`}>
            {orden.map((f) => (
              <li key={f.userId} className="cf3-ranking__fila" data-yo={f.yo ? 'true' : undefined} data-puesto={f.puesto <= 3 ? f.puesto : undefined}>
                <span className="cf3-ranking__puesto" aria-label={`Puesto ${f.puesto}`}>
                  {f.puesto}
                </span>
                <ReaderAvatar avatarId={f.avatarId} alias={f.alias} size="list" decorative />
                <span className="cf3-ranking__quien">
                  <span className="cf3-ranking__cafe">{f.cafe}</span>
                  <span className="cf3-ranking__alias">{f.yo ? 'Tú' : f.alias}</span>
                </span>
                <span className="cf3-ranking__cifra" aria-label={`${t.cifra(f)}, ${t.detalle(f)}`}>
                  <span aria-hidden="true">{t.cifra(f)}</span>
                  <span className="cf3-ranking__sub" aria-hidden="true">
                    {t.sub(f)}
                  </span>
                </span>
                {!f.yo && (
                  <button type="button" className="cf3-btn cf3-ranking__visitar" aria-label={`Visitar ${f.cafe}, el café de ${f.alias}`} onClick={() => onVisitar(f)}>
                    Visitar
                  </button>
                )}
              </li>
            ))}
          </ol>
          {otros === 0 && <p className="cf3-ranking__nota">{VACIO[ambito]}</p>}
        </>
      )}
    </div>
  );
}
