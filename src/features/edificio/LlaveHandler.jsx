// 1.151 · El enlace de una llave (`/#llave=ABCDEFGH`, docs/qa/amigos-vecinos.md, bloque 1). Como las invitaciones a clubes
// (InviteHandler): el código sale de la barra de direcciones en cuanto se lee y no se muda nadie sin decirlo. Quien llega sin
// cuenta o sin la comunidad activada no la pierde: la llave se queda guardada en el dispositivo (7 días) y la nota vuelve a
// salir cuando ya puede usarla. Va en el arranque de la app, así que solo usa `llave.js` (nada del resto del edificio).
import { useEffect, useRef, useState } from 'react';
import { useCommunity } from '../social/hooks/useCommunity';
import { MOTIVOS_LLAVE, guardarLlavePendiente, llaveBonita, llaveDeHash, llavePendiente, mudarse, olvidarLlavePendiente, verLlave } from './llave';

// Motivos que no se arreglan esperando: la llave se olvida
const PARA_SIEMPRE = new Set(['no_sirve', 'lleno', 'ya_vives', 'tuya']);

export function LlaveHandler({ onIrAlEdificio }) {
  const community = useCommunity();
  // Recién llegada por el enlace (se avisa aunque aún no se pueda usar) o guardada de antes (solo si ya se puede)
  const [llave, setLlave] = useState(() => {
    const deEnlace = llaveDeHash(globalThis.location?.hash);
    if (deEnlace) {
      guardarLlavePendiente(deEnlace);
      return { codigo: deEnlace, reciente: true };
    }
    const guardada = llavePendiente();
    return guardada ? { codigo: guardada, reciente: false } : null;
  });
  const [nota, setNota] = useState(null);
  const pedida = useRef(false);

  useEffect(() => {
    if (llave?.reciente) history.replaceState(history.state, '', window.location.pathname + window.location.search);
  }, [llave]);

  useEffect(() => {
    if (llave && community.status === 'idle') community.load();
  }, [llave, community]);

  // Sin cuenta o sin comunidad: se guarda y, si acaba de llegar, se dice qué falta
  useEffect(() => {
    if (!llave) return;
    const falta = community.status === 'signed-out' || community.status === 'off' ? 'sesion' : community.status === 'ready' && !community.member ? 'comunidad' : null;
    if (!falta) return;
    if (llave.reciente) setNota({ texto: MOTIVOS_LLAVE[falta] + ' La llave se queda guardada en este dispositivo.' });
    setLlave(null);
  }, [llave, community.status, community.member]);

  // Con todo listo, se mira qué abre antes de mudarse
  useEffect(() => {
    if (!llave || community.status !== 'ready' || !community.member || pedida.current) return;
    pedida.current = true;
    const { codigo } = llave;
    setLlave(null);
    verLlave(codigo)
      .then((vista) => {
        if (!vista?.motivo) return setNota({ codigo, vista });
        if (PARA_SIEMPRE.has(vista.motivo)) olvidarLlavePendiente();
        setNota({ texto: MOTIVOS_LLAVE[vista.motivo] ?? MOTIVOS_LLAVE.no_sirve });
      })
      .catch(() => {
        // Sin la migración (o sin red), la llave se queda para otro momento, sin molestar
      })
      .finally(() => {
        pedida.current = false;
      });
  }, [llave, community.status, community.member]);

  if (!nota) return null;
  const cerrar = () => setNota(null);

  if (nota.hecho) {
    return (
      <div className="invite-toast paper-sheet llave-toast" role="status" data-llave="hecho">
        <p>{nota.hecho}</p>
        <div className="llave-toast__acciones">
          <button
            type="button"
            className="social-btn"
            onClick={() => {
              cerrar();
              onIrAlEdificio?.();
            }}
          >
            Ir al edificio
          </button>
          <button type="button" className="social-btn" onClick={cerrar}>
            Entendido
          </button>
        </div>
      </div>
    );
  }

  if (nota.vista) {
    const { vista, codigo } = nota;
    const n = vista.vecinos;
    return (
      <div className="invite-toast paper-sheet llave-toast" role="dialog" aria-label="Una llave de un edificio" data-llave="enlace">
        <p className="llave-toast__titulo">
          Te han dado una llave: <b>{llaveBonita(codigo)}</b>
        </p>
        <p>
          Es del edificio de <b>{vista.de?.alias ?? 'un vecino'}</b>, donde {n === 1 ? 'vive una persona' : `viven ${n} personas`}. Si te mudas, tu piso y tus muebles van contigo, con todo lo que
          tienes.
        </p>
        {nota.error && (
          <p className="llave-toast__aviso" role="alert">
            {nota.error}
          </p>
        )}
        <div className="llave-toast__acciones">
          <button
            type="button"
            className="social-btn"
            disabled={nota.mudando}
            onClick={() => {
              setNota({ ...nota, mudando: true, error: '' });
              mudarse(codigo)
                .then(() => {
                  olvidarLlavePendiente();
                  setNota({ hecho: `Ya vives en el edificio de ${vista.de?.alias ?? 'tu amigo'}.` });
                })
                .catch((e) => setNota({ ...nota, mudando: false, error: e.message }));
            }}
          >
            {nota.mudando ? 'Mudándote…' : 'Mudarme'}
          </button>
          <button
            type="button"
            className="social-btn"
            disabled={nota.mudando}
            onClick={() => {
              olvidarLlavePendiente();
              cerrar();
            }}
          >
            Ahora no
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="invite-toast paper-sheet llave-toast" role="status" data-llave="aviso">
      <p>{nota.texto}</p>
      <button type="button" className="social-btn" onClick={cerrar}>
        Entendido
      </button>
    </div>
  );
}
