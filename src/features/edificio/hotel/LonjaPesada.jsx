// La pesada de Remedios (1.84): tres encargos al día en la mesa de la lonjera. De unas cajas, una pesa distinto y hay que
// encontrarla con la balanza: seis de sardinas, nueve de naranjas y ocho de libros en las que no se sabe si pesa de más o de
// menos. Es lógica, sin azar que apostar: siempre se puede en las pesadas justas, y Remedios tacha con tiza lo descartado. Fallar
// acaba el día y no quita nada. Da sellos, que nunca son tickets: se canjean abajo, en «El canje de Remedios». La caja la guarda
// el servidor; aquí solo se deduce con lo que la balanza ya ha dicho.
import { useEffect, useMemo, useRef, useState } from 'react';
import { GENEROS, PESADA_H, PESADA_W, crearPesada, huecoCaja } from './pesadaArt';
import { TOLDOS_ESPECIALES } from './lonjaArt';

const PRECIO = { toldo: 18, comision: 10, hueco: 14 };
const PAR = [2, 2, 3];
const BAJA = { izq: 'Baja la izquierda', der: 'Baja la derecha', igual: 'Se quedan iguales' };
const INCLINA = { izq: -1, der: 1, igual: 0 };
const ENTRADA = [
  'Seis cajas de sardinas, y una no cuadra.',
  'Nueve cajas de naranjas. Se puede en dos pesadas, si repartes bien.',
  'Ocho cajas de libros. Una no cuadra, y esta vez ni yo sé si pesa de más o de menos.',
];
const sellosDe = (n) => `${n} ${n === 1 ? 'sello' : 'sellos'}`;
const pesadasDe = (n) => `${n} ${n === 1 ? 'pesada' : 'pesadas'}`;
const reducido = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// Lo que diría la balanza si `caja` fuese la distinta
const diria = (p, caja, pesaMas) => {
  const izq = p.izq.includes(caja);
  if (!izq && !p.der.includes(caja)) return 'igual';
  return izq === pesaMas ? 'izq' : 'der';
};

/** Las cajas que aún pueden ser, con lo que ya ha dicho la balanza. */
function candidatas(total, pesaMas, pesadas) {
  const quedan = new Set();
  for (let caja = 1; caja <= total; caja += 1) {
    const pesos = pesaMas == null ? [true, false] : [pesaMas];
    if (pesos.some((p) => pesadas.every((x) => diria(x, caja, p) === x.baja))) quedan.add(caja);
  }
  return quedan;
}

function Canje({ lonja, busy, onCanjear, onToldo }) {
  const [ahora] = useState(() => Date.now());
  const hueco = lonja.huecoHasta && new Date(lonja.huecoHasta).getTime() > ahora;
  const fila = (clave, titulo, texto, precio, que, tope = false) => (
    <li key={clave}>
      <p>
        <b>{titulo}</b>
        <span>{texto}</span>
      </p>
      <button
        type="button"
        className="lj-btn is-chico"
        disabled={busy || tope || lonja.sellos < precio}
        aria-label={`Canjear ${titulo} por ${sellosDe(precio)}`}
        onClick={() => onCanjear(que, `${titulo}: ya es tuyo.`)}
      >
        {sellosDe(precio)}
      </button>
    </li>
  );
  return (
    <details className="lj-plegable">
      <summary>
        El canje de Remedios <span>{sellosDe(lonja.sellos)}</span>
      </summary>
      <ul className="lj-canje">
        {fila('comision', 'Venta sin comisión', `La próxima venta, entera para ti. Guardadas: ${lonja.sinComision} de 2.`, PRECIO.comision, 'sin-comision', lonja.sinComision >= 2)}
        {fila('hueco', 'Un hueco más', hueco ? 'Tu puesto ya tiene cuatro huecos: sumas siete días.' : 'Cuatro ofertas a la vez durante siete días.', PRECIO.hueco, 'hueco')}
        {Object.entries(TOLDOS_ESPECIALES).map(([id, t]) =>
          lonja.toldos.includes(id) ? (
            <li key={id}>
              <p>
                <b>{t.nombre}</b>
                <i className="lj-canje__toldo" style={{ '--toldo': `rgb(${t.color.join(' ')})` }} aria-hidden="true" />
              </p>
              <button type="button" className="lj-link" disabled={busy} aria-pressed={lonja.toldo === id} onClick={() => onToldo(lonja.toldo === id ? null : id)}>
                {lonja.toldo === id ? 'Puesto' : 'Poner'}
              </button>
            </li>
          ) : (
            fila(id, t.nombre, 'Un toldo para tu puesto, que ve todo el mundo.', PRECIO.toldo, `toldo:${id}`)
          ),
        )}
      </ul>
    </details>
  );
}

function Encargo({ ronda, total, pesaMas, pesadas, resultado, acabada, busy, cara, sfx, onPesar, onSenalar, onSiguiente }) {
  const ultima = pesadas[pesadas.length - 1];
  const [platos, setPlatos] = useState(() => (ultima ? { izq: ultima.izq, der: ultima.der } : { izq: [], der: [] }));
  const [senalando, setSenalando] = useState(false);
  const [elegida, setElegida] = useState(null);
  const lienzo = useRef(null);
  const escena = useRef(null);
  const par = PAR[ronda - 1];
  const tope = par + 1;
  const hecha = Boolean(resultado);
  const acierto = hecha && resultado.senalada === resultado.caja;
  const mismos = (a, b) => a.length === b.length && a.every((n) => b.includes(n));
  const dicho = ultima && mismos(platos.izq, ultima.izq) && mismos(platos.der, ultima.der) ? ultima.baja : null;
  const t = dicho ? INCLINA[dicho] : 0;
  const quedan = useMemo(() => candidatas(total, pesaMas, pesadas), [total, pesaMas, pesadas]);
  const sitios = useMemo(() => {
    const s = {};
    for (let n = 1; n <= total; n += 1) s[n] = { lugar: 'mesa', k: 0 };
    platos.izq.forEach((n, k) => (s[n] = { lugar: 'izq', k }));
    platos.der.forEach((n, k) => (s[n] = { lugar: 'der', k }));
    return s;
  }, [platos, total]);

  useEffect(() => {
    escena.current = crearPesada(lienzo.current, { reducido: reducido(), alAsentar: () => sfx.play('thunk') });
    return () => escena.current.destruir();
  }, [sfx]);
  useEffect(() => {
    const tachadas = new Set(Array.from({ length: total }, (_, k) => k + 1).filter((n) => !quedan.has(n) && n !== resultado?.caja));
    escena.current.poner({
      genero: GENEROS[ronda - 1].id,
      total,
      sitios,
      t,
      tachadas,
      elegida: resultado ? resultado.senalada : elegida,
      abierta: resultado ? { caja: resultado.caja, pesaMas: resultado.pesaMas } : null,
      sello: acierto ? resultado.sellos : null,
    });
  }, [ronda, total, sitios, t, quedan, elegida, acierto, resultado]);

  const veces = pesadas.length;
  const listo = platos.izq.length > 0 && platos.izq.length === platos.der.length && !dicho && veces < tope;
  const tocar = (n) => {
    if (hecha) return;
    sfx.play('thunk');
    if (senalando) {
      setElegida(n);
      return;
    }
    setPlatos(({ izq, der }) => {
      if (izq.includes(n)) return { izq: izq.filter((x) => x !== n), der };
      if (der.includes(n)) return { izq, der: der.filter((x) => x !== n) };
      if (izq.length > der.length) return der.length < 4 ? { izq, der: [...der, n] } : { izq, der };
      return izq.length < 4 ? { izq: [...izq, n], der } : { izq, der };
    });
  };
  const pesar = () => {
    sfx.play('creak');
    onPesar(platos.izq, platos.der);
  };
  const etiqueta = (n) => {
    if (hecha) return `Caja ${n}${n === resultado.caja ? ': era esta' : ''}`;
    const tachada = quedan.has(n) ? '' : ', descartada';
    if (senalando) return `Señalar la caja ${n}${tachada}`;
    const lugar = sitios[n].lugar;
    return `Caja ${n}${lugar === 'izq' ? ' en el platillo izquierdo' : lugar === 'der' ? ' en el platillo derecho' : ''}${tachada}`;
  };
  const frase = () => {
    if (hecha) {
      const dentro = resultado.pesaMas ? 'Pesaba de más: se había metido el gatito dentro.' : 'Pesaba de menos: el gato se ha comido media caja.';
      return acierto ? `¡La ${resultado.caja}! ${dentro}` : `Era la ${resultado.caja}. ${dentro}`;
    }
    if (senalando) return elegida == null ? '¿Cuál es? Tócala.' : `¿La ${elegida}? Tú dirás.`;
    if (dicho) return quedan.size === 1 ? `${BAJA[dicho]}. Ya solo queda una.` : `${BAJA[dicho]}. Quedan ${quedan.size} sin tachar.`;
    if (veces === 0 && !platos.izq.length) return ENTRADA[ronda - 1];
    if (platos.izq.length !== platos.der.length) return 'Mismo número de cajas en cada platillo.';
    return veces >= tope ? 'Ya no quedan pesadas: señala.' : 'Cuando quieras, a pesar.';
  };

  return (
    <>
      <p className="lj-dice" key={frase()} role="status">
        <img src={cara} alt="" draggable="false" />
        <span>{frase()}</span>
      </p>
      <div className="lj-mesa" style={{ aspectRatio: `${PESADA_W} / ${PESADA_H}` }}>
        <canvas ref={lienzo} width={PESADA_W} height={PESADA_H} role="img" aria-label={`La balanza de Remedios. ${dicho ? BAJA[dicho] : 'Está en equilibrio'}.`} />
        <div className="lj-mesa__cajas" role="group" aria-label="Las cajas del encargo">
          {Array.from({ length: total }, (_, k) => k + 1).map((n) => {
            const r = huecoCaja(sitios[n], n, total, t);
            return (
              <button
                key={n}
                type="button"
                className="lj-mesa__caja"
                style={{ left: `${r.left * 100}%`, top: `${r.top * 100}%`, width: `${r.width * 100}%`, height: `${r.height * 100}%` }}
                aria-label={etiqueta(n)}
                aria-pressed={senalando ? elegida === n : undefined}
                disabled={hecha}
                onClick={() => tocar(n)}
              />
            );
          })}
        </div>
        <p className="lj-mesa__cuenta" aria-label={`${pesadasDe(veces)} de ${tope}; el sello entero, en ${par}`}>
          <span aria-hidden="true">Pesadas</span>
          {Array.from({ length: tope }, (_, k) => (
            <i key={k} className={`${k < veces ? 'is-hecha' : ''}${k >= par ? ' is-extra' : ''}`} />
          ))}
        </p>
      </div>
      {hecha ? (
        <div className="lj-acciones">
          {acierto && <p className="lj-premio">{sellosDe(resultado.sellos)}</p>}
          {acabada ? (
            <p className="lj-nota">Mañana, otros tres encargos.</p>
          ) : (
            <button type="button" className="lj-btn is-sello" onClick={onSiguiente}>
              Siguiente encargo
            </button>
          )}
        </div>
      ) : senalando ? (
        <div className="lj-acciones">
          <button type="button" className="lj-btn is-sello" disabled={busy || elegida == null} onClick={() => onSenalar(elegida)}>
            {elegida == null ? 'Toca una caja' : `Es la caja ${elegida}`}
          </button>
          <button type="button" className="lj-link" onClick={() => (setSenalando(false), setElegida(null))}>
            Seguir pesando
          </button>
        </div>
      ) : (
        <div className="lj-acciones">
          <button type="button" className="lj-btn" disabled={busy || !listo} onClick={pesar}>
            Pesar
          </button>
          <button type="button" className="lj-btn is-sello" disabled={busy || veces === 0} onClick={() => setSenalando(true)}>
            Señalar
          </button>
          {(platos.izq.length > 0 || platos.der.length > 0) && (
            <button type="button" className="lj-link" onClick={() => setPlatos({ izq: [], der: [] })}>
              Vaciar la balanza
            </button>
          )}
        </div>
      )}
    </>
  );
}

export function LonjaPesada({ lonja, busy, cara, sfx, onPesar, onSenalar, onCanjear, onToldo }) {
  const { juego } = lonja;
  const [visto, setVisto] = useState(juego.ronda);
  const raiz = useRef(null);
  const ronda = Math.min(visto, juego.ronda);
  const resultado = juego.encargos.find((e) => e.ronda === ronda) ?? null;

  useEffect(() => {
    raiz.current?.scrollIntoView({ block: 'start' });
  }, []);

  return (
    <div className="lj-pesada" ref={raiz}>
      <ol className="lj-albaranes" aria-label="Los encargos de hoy">
        {GENEROS.map((g, k) => {
          const hecho = juego.encargos.find((e) => e.ronda === k + 1);
          const estado = !hecho ? (k + 1 === ronda ? 'is-ahora' : '') : hecho.senalada === hecho.caja ? 'is-sellado' : 'is-fallido';
          return (
            <li key={g.id} className={estado} aria-current={k + 1 === ronda ? 'step' : undefined}>
              <b>{g.nombre}</b>
              <span>{hecho ? (hecho.sellos ? `+${hecho.sellos}` : 'Sin sello') : `Vale ${k + 1}`}</span>
            </li>
          );
        })}
      </ol>
      <Encargo
        key={ronda}
        ronda={ronda}
        total={resultado?.cajas ?? juego.cajas}
        pesaMas={resultado ? resultado.pesaMas : juego.pesaMas}
        pesadas={resultado?.pesadas ?? juego.pesadas}
        resultado={resultado}
        acabada={juego.acabada}
        busy={busy}
        cara={cara}
        sfx={sfx}
        onPesar={onPesar}
        onSenalar={onSenalar}
        onSiguiente={() => setVisto(juego.ronda)}
      />
      <Canje lonja={lonja} busy={busy} onCanjear={onCanjear} onToldo={onToldo} />
    </div>
  );
}
