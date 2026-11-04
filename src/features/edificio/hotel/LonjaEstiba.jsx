// La estiba (1.86): el juego de la Lonja. Los bultos del día esperan en el muelle y se encajan en la bodega del barco, arrastrándolos
// o tocando un bulto y después el sitio; tocar el bulto que tienes en la mano lo gira. La carga se ve mientras se coloca, con lo que
// da cada nivel, y solo se zarpa una vez al día: el servidor la comprueba y da los sellos. Debajo, siempre a la vista, la pared de
// premios (LonjaPared.jsx). Con teclado: flechas para mover, R para girar, Intro para soltar y Esc para devolver.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ESTIBA_H, ESTIBA_W, crearEstiba, pintarBulto } from './estibaArt';
import { bultoDe, cabe, girar, huecosLlenos, nivelDe, sellosDe } from './estiba';
import { LonjaPared } from './LonjaPared';

const reducido = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const CLAVE = 'bookshelf:estiba';

/** Lo colocado sobrevive a salir de la sala, solo en este dispositivo y solo ese día. */
function leerCarga(bodega) {
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    if (guardada?.dia !== bodega.dia || !Array.isArray(guardada.carga)) return [];
    return guardada.carga.reduce((carga, c) => {
      const pieza = bodega.piezas.find((p) => p.id === c.pieza);
      return pieza && !carga.some((x) => x.pieza === c.pieza) && cabe(bodega, carga, pieza, c.x, c.y, c.rot) ? [...carga, c] : carga;
    }, []);
  } catch {
    return [];
  }
}
function guardarCarga(dia, carga) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ dia, carga }));
  } catch {
    // Sin almacenamiento, la carga dura lo que dure la pantalla
  }
}

function Bulto({ pieza, rot, elegido, onPointerDown, onClick }) {
  const src = useMemo(() => pintarBulto(pieza, rot, 12).toDataURL(), [pieza, rot]);
  const forma = girar(pieza.celdas, rot);
  const w = Math.max(...forma.map((p) => p[0])) + 1;
  const h = Math.max(...forma.map((p) => p[1])) + 1;
  return (
    <button type="button" className="lj-bulto" aria-pressed={elegido} aria-label={`${bultoDe(pieza).nombre}, ${pieza.celdas.length} huecos`} onPointerDown={onPointerDown} onClick={onClick}>
      <img src={src} alt="" width={w * 12} height={h * 12} draggable="false" />
    </button>
  );
}

function Parte({ hecha, niveles }) {
  const pct = Math.floor((hecha.celdas * 100) / hecha.total);
  const nivel = [...niveles].reverse().find((n) => pct >= n.desde);
  return (
    <div className="lj-parte" role="status">
      <p className="lj-parte__titulo">{nivel?.nombre ?? 'Poca carga'}</p>
      <p>
        {hecha.celdas} de {hecha.total} huecos
      </p>
      <p className="lj-parte__sello">+{sellosDe(hecha.sellos)}</p>
      <p>Tu barco ya ha zarpado. Mañana hay otra bodega.</p>
    </div>
  );
}

export function LonjaEstiba({ lonja, busy, cara, sfx, onZarpar, onCanjear, onToldo }) {
  const bodega = lonja.estiba;
  const { hecha, niveles } = bodega;
  const [carga, setCarga] = useState(() => (hecha ? [] : leerCarga(bodega)));
  const [mano, setMano] = useState(null);
  const [giros, setGiros] = useState({});
  const [pregunta, setPregunta] = useState(false);
  const [yendose, setYendose] = useState(false);
  const [aviso, setAviso] = useState('');
  const raiz = useRef(null);
  const lienzo = useRef(null);
  const escena = useRef(null);
  const arrastre = useRef(null);
  const yaHecha = useRef(Boolean(hecha));

  const piezaDe = (id) => bodega.piezas.find((p) => p.id === id);
  const enMuelle = bodega.piezas.filter((p) => !carga.some((c) => c.pieza === p.id) && p.id !== mano?.pieza);
  const llenos = huecosLlenos(bodega, carga);
  const { nivel, sellos, pct } = nivelDe(bodega, llenos);

  // El barco, a la vista nada más entrar
  useEffect(() => {
    raiz.current?.scrollIntoView({ block: 'start' });
  }, []);
  useEffect(() => {
    escena.current = crearEstiba(lienzo.current, { reducido: reducido() });
    return () => escena.current?.destruir();
  }, []);
  useEffect(() => {
    const ido = Boolean(hecha) && !yendose;
    const puesta = hecha && yendose ? hecha.carga : hecha ? [] : carga;
    const conAviso = mano && mano.x !== null ? { ...mano, cabe: cabe(bodega, carga, piezaDe(mano.pieza), mano.x, mano.y, mano.rot) } : mano;
    escena.current?.poner({ bodega, carga: puesta, mano: hecha ? null : conAviso, ido });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodega, carga, mano, hecha, yendose]);
  useEffect(() => {
    if (!hecha) guardarCarga(bodega.dia, carga);
  }, [bodega.dia, carga, hecha]);
  // Acaba de zarpar: el barco se va y, cuando ya no se ve, sale el parte
  useEffect(() => {
    if (!hecha || yaHecha.current) return;
    yaHecha.current = true;
    setYendose(true);
    sfx.play('bocina');
    escena.current?.zarpar(() => {
      setYendose(false);
      sfx.play('stamp');
    });
  }, [hecha, sfx]);

  const encajar = (m) => {
    const pieza = piezaDe(m.pieza);
    if (m.x === null || !cabe(bodega, carga, pieza, m.x, m.y, m.rot)) {
      setMano(m);
      if (m.x !== null) setAviso('Ahí no cabe.');
      return false;
    }
    setCarga((c) => [...c.filter((x) => x.pieza !== m.pieza), { pieza: m.pieza, x: m.x, y: m.y, rot: m.rot }]);
    setMano(null);
    setPregunta(false);
    setAviso(`${bultoDe(pieza).nombre} en la bodega.`);
    sfx.play('thunk');
    return true;
  };
  const coger = (id) => {
    if (busy || hecha) return;
    sfx.play('tap');
    setPregunta(false);
    setAviso('');
    setMano({ pieza: id, rot: giros[id] ?? 0, x: null, y: null });
  };
  const girarMano = () => {
    if (!mano) return;
    sfx.play('creak');
    const rot = (mano.rot + 1) % 4;
    setGiros((g) => ({ ...g, [mano.pieza]: rot }));
    if (mano.x === null) setMano({ ...mano, rot });
    else {
      const f = girar(piezaDe(mano.pieza).celdas, rot);
      const w = Math.max(...f.map((p) => p[0])) + 1;
      const h = Math.max(...f.map((p) => p[1])) + 1;
      setMano({ ...mano, rot, x: Math.max(0, Math.min(bodega.w - w, mano.x)), y: Math.max(0, Math.min(bodega.h - h, mano.y)) });
    }
  };
  const devolver = () => {
    setMano(null);
    setAviso('');
  };
  /** El bulto, con el dedo en su centro y sin salirse de la bodega. */
  const situar = (m, celda, agarre = null) => {
    const f = girar(piezaDe(m.pieza).celdas, m.rot);
    const w = Math.max(...f.map((p) => p[0])) + 1;
    const h = Math.max(...f.map((p) => p[1])) + 1;
    const [ax, ay] = agarre ?? [Math.floor((w - 1) / 2), Math.floor((h - 1) / 2)];
    return { ...m, x: Math.max(0, Math.min(bodega.w - w, celda.x - ax)), y: Math.max(0, Math.min(bodega.h - h, celda.y - ay)) };
  };
  const pisa = (m, celda) => m.x !== null && girar(piezaDe(m.pieza).celdas, m.rot).some(([a, b]) => m.x + a === celda.x && m.y + b === celda.y);

  // Sobre la bodega: tocar coge lo que hay, mueve lo que llevas o, si tocas lo que llevas, lo gira
  const pulsar = (e) => {
    if (busy || hecha) return;
    const celda = escena.current.celda(e.clientX, e.clientY);
    if (!celda) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (mano) {
      const encima = pisa(mano, celda);
      arrastre.current = { mano, inicio: celda, movido: false, encima, agarre: encima ? [celda.x - mano.x, celda.y - mano.y] : null };
      return;
    }
    const puesta = carga.find((c) => {
      const f = girar(piezaDe(c.pieza).celdas, c.rot);
      return f.some(([a, b]) => c.x + a === celda.x && c.y + b === celda.y);
    });
    if (!puesta) return;
    const m = { pieza: puesta.pieza, rot: puesta.rot, x: puesta.x, y: puesta.y };
    sfx.play('creak');
    setCarga((c) => c.filter((x) => x !== puesta));
    setMano(m);
    setPregunta(false);
    arrastre.current = { mano: m, inicio: celda, movido: false, encima: false, cogida: true, agarre: [celda.x - m.x, celda.y - m.y] };
  };
  const mover = (e) => {
    const a = arrastre.current;
    if (!a) return;
    const celda = escena.current.celda(e.clientX, e.clientY);
    if (!celda) return;
    if (celda.x === a.inicio.x && celda.y === a.inicio.y && !a.movido) return;
    a.movido = true;
    a.mano = situar(a.mano, celda, a.agarre);
    setMano(a.mano);
  };
  const soltar = (e) => {
    const a = arrastre.current;
    arrastre.current = null;
    if (!a) return;
    if (a.movido) {
      encajar(a.mano);
      return;
    }
    if (a.cogida) return;
    if (a.encima) {
      girarMano();
      return;
    }
    const celda = escena.current.celda(e.clientX, e.clientY);
    if (celda) encajar(situar(a.mano, celda));
  };

  // Desde el muelle: arrastrar el bulto hasta la bodega. Se escucha en la ventana porque el botón desaparece al cogerlo
  const arrastrarDesdeMuelle = (e, id) => {
    if (busy || hecha) return;
    const a = { x: e.clientX, y: e.clientY, movido: false, m: { pieza: id, rot: giros[id] ?? 0, x: null, y: null } };
    const moverlo = (ev) => {
      if (!a.movido && Math.hypot(ev.clientX - a.x, ev.clientY - a.y) < 8) return;
      if (!a.movido) {
        a.movido = true;
        sfx.play('tap');
        setPregunta(false);
      }
      const celda = escena.current.celda(ev.clientX, ev.clientY - (ev.pointerType === 'touch' ? 34 : 0));
      const r = lienzo.current.getBoundingClientRect();
      a.m = celda && ev.clientY < r.bottom + 10 ? situar(a.m, celda) : { ...a.m, x: null, y: null };
      setMano(a.m);
    };
    const acabar = () => {
      window.removeEventListener('pointermove', moverlo);
      window.removeEventListener('pointerup', acabar);
      window.removeEventListener('pointercancel', acabar);
      if (a.movido) encajar(a.m);
    };
    window.addEventListener('pointermove', moverlo);
    window.addEventListener('pointerup', acabar);
    window.addEventListener('pointercancel', acabar);
  };
  const tocarBulto = (e, id) => {
    coger(id);
    if (e.detail === 0) lienzo.current?.focus();
  };

  const teclas = (e) => {
    if (!mano) return;
    const paso = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (paso) {
      e.preventDefault();
      const base = mano.x === null ? situar(mano, { x: 3, y: 2 }) : mano;
      setMano(situar(base, { x: base.x + paso[0], y: base.y + paso[1] }, [0, 0]));
    } else if (e.key === 'r' || e.key === 'R') girarMano();
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      encajar(mano.x === null ? situar(mano, { x: 3, y: 2 }) : mano);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      devolver();
    }
  };

  const zarpar = () => {
    sfx.play('tap');
    if (llenos < bodega.total && !pregunta) {
      setPregunta(true);
      return;
    }
    setPregunta(false);
    onZarpar(carga);
  };

  const frase = hecha
    ? 'Buena carga. Mañana llegan más bultos.'
    : llenos === bodega.total
      ? 'Ni un hueco. Así da gusto: ya puedes zarpar.'
      : carga.length
        ? 'Tocar un bulto lo levanta. Si no te gusta, muévelo.'
        : `Hoy hay ${bodega.piezas.length} bultos en el muelle. Si no dejas un hueco, son ${sellosDe(niveles.at(-1)?.sellos ?? 7)}.`;

  return (
    <div className="lj-estiba" ref={raiz}>
      <p className="lj-dice">
        <img src={cara} alt="" draggable="false" />
        <span>{frase}</span>
      </p>

      {mano && <span data-escape-local="open" hidden />}
      <div className="lj-barco">
        <canvas
          ref={lienzo}
          width={ESTIBA_W}
          height={ESTIBA_H}
          tabIndex={hecha ? -1 : 0}
          role="application"
          aria-label="La bodega del barco. Con un bulto en la mano: flechas para moverlo, R para girarlo, Intro para soltarlo y Escape para devolverlo."
          onPointerDown={pulsar}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={() => (arrastre.current = null)}
          onKeyDown={teclas}
        />
        {hecha && !yendose && <Parte hecha={hecha} niveles={niveles} />}
      </div>

      {!hecha && (
        <>
          {enMuelle.length > 0 && (
            <div className="lj-muelle" role="group" aria-label="Bultos en el muelle">
              {enMuelle.map((p) => (
                <Bulto key={p.id} pieza={p} rot={giros[p.id] ?? 0} elegido={false} onPointerDown={(e) => arrastrarDesdeMuelle(e, p.id)} onClick={(e) => tocarBulto(e, p.id)} />
              ))}
            </div>
          )}

          <div className="lj-acciones lj-estiba__mano">
            <button type="button" className="lj-btn is-chico" disabled={!mano} onClick={girarMano}>
              Girar
            </button>
            <button type="button" className="lj-btn is-chico" disabled={!mano || mano.x === null} onClick={() => mano && encajar(mano)}>
              Soltar aquí
            </button>
            <button type="button" className="lj-link" disabled={!mano} onClick={devolver}>
              Al muelle
            </button>
          </div>

          <div className="lj-carga">
            <div className="lj-carga__barra" role="progressbar" aria-label="Carga de la bodega" aria-valuemin={0} aria-valuemax={bodega.total} aria-valuenow={llenos}>
              <span style={{ width: `${(llenos * 100) / bodega.total}%` }} />
              {niveles.map((n) => (
                <i key={n.id} style={{ left: `${n.desde}%` }} />
              ))}
            </div>
            <ol className="lj-carga__niveles">
              {niveles.map((n) => (
                <li key={n.id} className={pct >= n.desde ? 'is-hecho' : ''}>
                  <b>{sellosDe(n.sellos)}</b>
                  <span>{n.nombre}</span>
                </li>
              ))}
            </ol>
          </div>

          <p className="lj-nota" role="status" aria-live="polite">
            {aviso ||
              (mano
                ? mano.x === null
                  ? 'Toca la bodega donde quieras dejarlo.'
                  : 'Tócalo para girarlo o toca otro sitio para moverlo.'
                : carga.length
                  ? `${llenos} de ${bodega.total} huecos.`
                  : 'Arrastra un bulto a la bodega, o tócalo y toca el sitio.')}
          </p>

          {pregunta ? (
            <div className="lj-seguro" role="group" aria-label="Confirmar la salida">
              <p>
                {nivel ? `Zarpas con ${nivel.nombre.toLowerCase()}: ` : 'Zarpas con poca carga: '}
                {sellosDe(sellos)}. Solo se zarpa una vez al día.
              </p>
              <div className="lj-acciones">
                <button type="button" className="lj-btn is-sello" disabled={busy} onClick={zarpar}>
                  Sí, zarpar
                </button>
                <button type="button" className="lj-link" onClick={() => setPregunta(false)}>
                  Seguir cargando
                </button>
              </div>
            </div>
          ) : (
            <div className="lj-acciones">
              <button type="button" className="lj-btn is-sello" disabled={busy || !carga.length || Boolean(mano)} onClick={zarpar}>
                Zarpar · {sellosDe(sellos)}
              </button>
            </div>
          )}
        </>
      )}

      <LonjaPared lonja={lonja} busy={busy} sfx={sfx} onCanjear={onCanjear} onToldo={onToldo} />
    </div>
  );
}
