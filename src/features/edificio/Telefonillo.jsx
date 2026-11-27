// 1.151 · El telefonillo del portal (docs/qa/amigos-vecinos.md, bloque 1; Francisco, 26-11-2026: «que fuera del edificio tengas
// como un telefonillo»). Una placa de latón con un botón por puerta (llamar a un vecino es entrar en su piso, como tocar su
// ventana) y, debajo, la llave de tu edificio: darla (un código y un enlace para compartir), usar una que te han dado y, si
// vives con alguien, irte a un edificio propio. Cada cuenta estrena su edificio; los vecinos son quien tú invitas.
import { useEffect, useRef, useState } from 'react';
import { darLlave, doorLabel, doorsOf, irseDelEdificio, misLlaves, retirarLlave } from './service';
import { MOTIVOS_LLAVE, enlaceLlave, llaveBonita, llaveLimpia, mudarse, verLlave } from './llave';

const fecha = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

/** Lo que dice una llave antes de usarla: de quién es, cuántos vecinos hay y qué pasa al mudarte. */
export function VistaLlave({ vista }) {
  const n = vista.vecinos;
  return (
    <div className="ed-tel__llavero" data-llave="vista">
      <p className="ed-tel__llavero-de">
        La llave de <b>{vista.de?.alias ?? 'un vecino'}</b>
      </p>
      <p>Su edificio tiene {n === 1 ? 'una vecina o vecino' : `${n} vecinos`}. Al mudarte, tu piso y tus muebles van contigo, con todo lo que tienes.</p>
    </div>
  );
}

export function Telefonillo({ vecinos, plantas = 3, libres = 0, onClose, onLlamar, onMudado }) {
  const [vista, setVista] = useState('inicio');
  const [llaves, setLlaves] = useState(null);
  const [nueva, setNueva] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [mirada, setMirada] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [copiado, setCopiado] = useState(false);
  const titulo = useRef(null);
  const solo = vecinos.filter((v) => !v.yo).length === 0;

  useEffect(() => {
    titulo.current?.focus({ preventScroll: true });
  }, [vista]);
  useEffect(() => {
    let vivo = true;
    misLlaves().then(
      (l) => vivo && setLlaves(l),
      () => vivo && setLlaves([]),
    );
    return () => {
      vivo = false;
    };
  }, []);
  const ir = (v) => {
    setAviso('');
    setCopiado(false);
    setVista(v);
  };
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (vista === 'inicio') onClose();
      else ir('inicio');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const conCuidado = async (fn) => {
    setOcupado(true);
    setAviso('');
    try {
      await fn();
    } catch (e) {
      setAviso(e.message);
    } finally {
      setOcupado(false);
    }
  };

  const dar = () =>
    conCuidado(async () => {
      const l = await darLlave();
      setNueva(l);
      setLlaves((ls) => [l, ...(ls ?? [])]);
    });
  const compartir = async (l) => {
    const url = enlaceLlave(l.codigo);
    const texto = `Te doy la llave de mi edificio en Libotown. Ábrela con este enlace o escribe ${llaveBonita(l.codigo)} en el telefonillo del portal.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'La llave de mi edificio', text: texto, url });
        return;
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(`${texto} ${url}`);
      setCopiado(true);
    } catch {
      setAviso(`No se ha podido copiar. Pásale el código: ${llaveBonita(l.codigo)}.`);
    }
  };
  const retirar = (l) =>
    conCuidado(async () => {
      await retirarLlave(l.codigo);
      setLlaves((ls) => (ls ?? []).filter((x) => x.codigo !== l.codigo));
      if (nueva?.codigo === l.codigo) setNueva(null);
    });
  const mirar = (e) => {
    e.preventDefault();
    const c = llaveLimpia(codigo);
    if (c.length !== 8) {
      setAviso('Una llave tiene 8 letras y números, como ABCD-EFGH.');
      return;
    }
    conCuidado(async () => setMirada(await verLlave(c)));
  };
  const mudarme = () =>
    conCuidado(async () => {
      await mudarse(llaveLimpia(codigo));
      onMudado(`Ya vives en el edificio de ${mirada?.de?.alias ?? 'tu amigo'}.`);
    });
  const irme = () =>
    conCuidado(async () => {
      await irseDelEdificio();
      onMudado('Ya vives en tu propio edificio, con tu piso y tus muebles.');
    });

  const vivas = llaves ?? [];
  return (
    <div className="ed-tel" data-escape-local="open" data-no-room-swipe>
      <button type="button" className="ed-tel__fondo" aria-label="Cerrar el telefonillo" onClick={onClose} />
      <section className="ed-tel__placa" role="dialog" aria-modal="true" aria-labelledby="ed-tel-t" data-vista={vista}>
        <div className="ed-tel__rejilla" aria-hidden="true" />
        <h2 id="ed-tel-t" ref={titulo} tabIndex={-1} className="ed-tel__titulo">
          {vista === 'dar' ? 'La llave de tu edificio' : vista === 'usar' ? 'Tengo una llave' : vista === 'irse' ? 'Irme del edificio' : 'El telefonillo'}
        </h2>

        {vista === 'inicio' && (
          <>
            <p className="ed-tel__sub">
              {solo
                ? 'Por ahora vives sola o solo en tu edificio. Dale una llave a quien quieras de vecino.'
                : `${vecinos.length} vecinos en ${plantas} plantas${libres ? ` · ${libres === 1 ? 'una puerta libre' : `${libres} puertas libres`}` : ' · edificio lleno'}`}
            </p>
            <ul className="ed-tel__botones" aria-label="Las puertas del edificio">
              {/* Como en la fachada: arriba la 3.ª planta, la A a la izquierda y la B a la derecha */}
              {doorsOf(vecinos, plantas)
                .sort((x, y) => y.puerta[0] - x.puerta[0] || x.puerta.localeCompare(y.puerta))
                .map(({ puerta, vecino }) => (
                  <li key={puerta}>
                    <button
                      type="button"
                      className={`ed-tel__boton${vecino?.yo ? ' is-mio' : ''}`}
                      disabled={!vecino}
                      onClick={() => vecino && onLlamar(vecino.user_id)}
                      aria-label={vecino ? (vecino.yo ? `Entrar en tu piso, ${doorLabel(puerta)}` : `Llamar al ${doorLabel(puerta)}: el piso de ${vecino.alias}`) : `${doorLabel(puerta)}: libre`}
                    >
                      <span className="ed-tel__pulsador" aria-hidden="true" />
                      <span className="ed-tel__puerta">{doorLabel(puerta)}</span>
                      <span className="ed-tel__nombre">{vecino ? (vecino.yo ? 'Tu piso' : vecino.alias) : 'Libre'}</span>
                    </button>
                  </li>
                ))}
            </ul>
            <div className="ed-tel__acciones">
              <button type="button" className="ed-tel__accion ed-tel__accion--llave" onClick={() => ir('dar')}>
                Dar una llave
              </button>
              <button type="button" className="ed-tel__accion" onClick={() => ir('usar')}>
                Tengo una llave
              </button>
              {!solo && (
                <button type="button" className="ed-tel__accion ed-tel__accion--suave" onClick={() => ir('irse')}>
                  Irme del edificio
                </button>
              )}
            </div>
          </>
        )}

        {vista === 'dar' && (
          <>
            <p className="ed-tel__sub">Abre una puerta, una sola vez, durante 7 días. Quien la use se muda con su piso y sus muebles; nadie entra sin llave.</p>
            {nueva ? (
              <div className="ed-tel__llavero" data-llave="nueva">
                <span className="ed-tel__codigo" aria-label={`Código: ${nueva.codigo.split('').join(' ')}`}>
                  {llaveBonita(nueva.codigo)}
                </span>
                <span className="ed-tel__caduca">Abre hasta el {fecha(nueva.caduca)}</span>
                <button type="button" className="ed-tel__accion ed-tel__accion--llave" onClick={() => compartir(nueva)}>
                  {copiado ? 'Enlace copiado' : 'Compartir la llave'}
                </button>
              </div>
            ) : libres === 0 ? (
              <p className="ed-tel__aviso">Tu edificio está lleno: no queda ninguna puerta para dar.</p>
            ) : (
              <button type="button" className="ed-tel__accion ed-tel__accion--llave" onClick={dar} disabled={ocupado || vivas.length >= 3}>
                {ocupado ? 'Haciendo la llave…' : 'Hacer una llave'}
              </button>
            )}
            {/* 1.152: con las plantas que hay llenas, quien entre estrena una planta nueva */}
            {libres > 0 && plantas < 5 && vecinos.length >= plantas * 2 && (
              <p className="ed-tel__nota" data-tel="crece">
                Tus {plantas} plantas están llenas: quien entre con esta llave estrenará la {plantas + 1}.ª planta, y el edificio crecerá.
              </p>
            )}
            {vivas.length > 0 && (
              <div className="ed-tel__llaves">
                <h3>Tus llaves sin usar</h3>
                <ul>
                  {vivas.map((l) => (
                    <li key={l.codigo}>
                      <span className="ed-tel__codigo ed-tel__codigo--peq">{llaveBonita(l.codigo)}</span>
                      <span className="ed-tel__caduca">hasta el {fecha(l.caduca)}</span>
                      {nueva?.codigo !== l.codigo && (
                        <button type="button" className="ed-tel__mini" onClick={() => compartir(l)}>
                          Compartir
                        </button>
                      )}
                      <button type="button" className="ed-tel__mini" onClick={() => retirar(l)} disabled={ocupado}>
                        Retirar
                      </button>
                    </li>
                  ))}
                </ul>
                {vivas.length >= 3 && <p className="ed-tel__nota">Como mucho, tres llaves sin usar: retira una para hacer otra.</p>}
              </div>
            )}
          </>
        )}

        {vista === 'usar' && (
          <>
            {!mirada || mirada.motivo ? (
              <form className="ed-tel__usar" onSubmit={mirar}>
                <label htmlFor="ed-tel-codigo">Escribe la llave que te han dado</label>
                <input
                  id="ed-tel-codigo"
                  className="ed-tel__input"
                  value={codigo}
                  onChange={(e) => {
                    setCodigo(e.target.value.toUpperCase());
                    setMirada(null);
                  }}
                  placeholder="ABCD-EFGH"
                  maxLength={12}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
                {mirada?.motivo && <p className="ed-tel__aviso">{MOTIVOS_LLAVE[mirada.motivo] ?? MOTIVOS_LLAVE.no_sirve}</p>}
                <button type="submit" className="ed-tel__accion ed-tel__accion--llave" disabled={ocupado}>
                  {ocupado ? 'Mirando…' : 'Mirar la llave'}
                </button>
              </form>
            ) : (
              <>
                <VistaLlave vista={mirada} />
                {!solo && <p className="ed-tel__nota">Dejarás tu edificio de ahora: tus vecinos de aquí seguirán siendo tus amigos.</p>}
                <div className="ed-tel__acciones">
                  <button type="button" className="ed-tel__accion ed-tel__accion--llave" onClick={mudarme} disabled={ocupado}>
                    {ocupado ? 'Mudándote…' : 'Mudarme'}
                  </button>
                  <button type="button" className="ed-tel__accion ed-tel__accion--suave" onClick={() => setMirada(null)}>
                    Ahora no
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {vista === 'irse' && (
          <>
            <p className="ed-tel__sub">Te vas a un edificio solo para ti, con tu piso, tus muebles y la misma puerta. Tus llaves sin usar dejan de abrir; para volver, te tendrán que dar otra.</p>
            <div className="ed-tel__acciones">
              <button type="button" className="ed-tel__accion ed-tel__accion--suave" onClick={irme} disabled={ocupado}>
                {ocupado ? 'Mudándote…' : 'Irme'}
              </button>
              <button type="button" className="ed-tel__accion ed-tel__accion--llave" onClick={() => ir('inicio')}>
                Me quedo
              </button>
            </div>
          </>
        )}

        {aviso && (
          <p className="ed-tel__aviso" role="alert">
            {aviso}
          </p>
        )}
        <button type="button" className="ed-tel__volver" onClick={() => (vista === 'inicio' ? onClose() : ir('inicio'))}>
          {vista === 'inicio' ? 'Colgar' : 'Atrás'}
        </button>
      </section>
    </div>
  );
}
