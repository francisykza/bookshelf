// 1.136 (SPEC §136.6): en la dirección de antes, un aviso discreto de que Libotown se muda a libotown.es, con los pasos
// para pasarse sin perder nada. Solo en la habitación, en la esquina de arriba que el piso deja libre, con los marcos de
// papel del piso; en la habitación ilustrada, debajo de sus botones de arriba. «Ahora no» lo esconde tres días en este
// dispositivo. El bloque 4 cambiará esta dirección por una redirección.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { modalRoot } from '../../components/panels/modalRoot';
import { DIRECCION, DOMINIO, esDireccionAntigua } from '../../domain/direcciones';
import { installPixelVars } from '../edificio/pixelUi';
import './aviso-direccion.css';

export const CLAVE_AVISO = 'bookshelf:aviso-direccion';
const PAUSA = 3 * 24 * 60 * 60 * 1000;

function enPausa() {
  try {
    const desde = Number(localStorage.getItem(CLAVE_AVISO));
    return desde > 0 && Date.now() < desde + PAUSA;
  } catch {
    return false;
  }
}

/** `lugar`: 'piso' (la habitación 3D), 'sala' (la ilustrada) o nada, y entonces no se ve. */
export function AvisoDireccion({ lugar }) {
  const [antigua] = useState(() => {
    const es = esDireccionAntigua(window.location.hostname);
    if (es) installPixelVars();
    return es;
  });
  const [oculto, setOculto] = useState(enPausa);
  const [abierto, setAbierto] = useState(false);

  // Escape recoge la nota sin esconder el aviso
  useEffect(() => {
    if (!abierto) return undefined;
    const onKey = (e) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto]);

  if (!antigua || oculto || !lugar) return null;

  const ahoraNo = () => {
    try {
      localStorage.setItem(CLAVE_AVISO, String(Date.now()));
    } catch {
      // Sin almacenamiento, se esconde solo hasta recargar
    }
    setAbierto(false);
    setOculto(true);
  };

  return createPortal(
    <aside className={`aviso-dir aviso-dir--${lugar}`} aria-label={`Libotown se muda a ${DOMINIO}`}>
      <button type="button" className="aviso-dir__etiqueta" aria-expanded={abierto} aria-controls="aviso-dir-nota" onClick={() => setAbierto((v) => !v)}>
        <span>Nos mudamos a</span>
        <b>{DOMINIO}</b>
      </button>
      {abierto && (
        <div className="aviso-dir__nota" id="aviso-dir-nota">
          <h2>Libotown se muda a {DOMINIO}</h2>
          <p>Esta dirección seguirá funcionando un tiempo. Para pasarte sin perder nada:</p>
          <ol>
            <li>Abre {DOMINIO} y, si usas la app instalada, añádela a la pantalla de inicio desde allí.</li>
            <li>Ábrela y entra con tu cuenta, la misma de aquí.</li>
            <li>
              Si te pregunta con qué datos te quedas, pulsa <b>«Usar estos»</b> en «En tu cuenta» (no «Subir estos»).
            </li>
            <li>Los EPUB se guardan en cada dirección: vuelve a vincularlos allí.</li>
          </ol>
          <div className="aviso-dir__botones">
            <a className="aviso-dir__ir" href={DIRECCION} target="_blank" rel="noopener">
              Ir a {DOMINIO}
            </a>
            <button type="button" className="aviso-dir__luego" onClick={ahoraNo}>
              Ahora no
            </button>
          </div>
        </div>
      )}
    </aside>,
    modalRoot(),
  );
}
