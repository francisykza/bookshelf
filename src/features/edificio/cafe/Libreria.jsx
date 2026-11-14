// El café-librería del bajo, 1.130 (Francisco, 14-11-2026: «que quiero que le pongas especial mimo de detalle, sonido,
// atractivo visual y mecanicas para que sea lo más divertido, cozy y cuidado posible asi como hiciste con la preparación del
// café pero hasta con más esmero»; plan en docs/qa/cafe-libreria.md §15). Con la taza lista, el libro, siempre a mano (aunque
// la bebida la prepare Pilar), en la estantería de la pared y en la escena:
// 1. La estantería entera, por secciones: tocas la placa de latón de la que pide (solo están las que tienen ejemplares).
// 2. De cerca, pasas el dedo por los lomos: el que queda bajo el dedo asoma, suena distinto cada uno y dice su título y sus
//    páginas. Tirando hacia abajo, sale de la balda.
// 3. Sale la tabla extraíble de la estantería y el libro cae en ella: su portada real, para mirarlo. «Devolverlo» o «Este».
// 4. Cómo se lo lleva: tocas el rollo de papel, el tarro de los marcapáginas o las bolsas, y cada forma tiene sus gestos (el
//    papel que se desenrolla y se rasga, las dos solapas, el cordel y su lazo; la tapa que se abre y el marcapáginas; la bolsa
//    que se abre de un soplido, el libro dentro y el borde doblado) y, siempre, el sello del café apretando y manteniendo.
// 5. El paquete se va a la bandeja con la taza, y «Llevárselo».
// Con movimiento reducido o el teclado, cada gesto es un toque. Sin la escena 3D, lo mismo con botones.
import { useEffect, useMemo, useRef, useState } from 'react';
import { nombreGenero } from './cafeClientes';
import { GESTOS, crearGesto, ladoNota } from './cafeGestos';
import { FORMAS, aciertosLibro, estanteLibreria, extensionDe, formaPorId, grosorDe } from './cafeLibreria';
import { colorDe } from './cafeMuebles';
import { portadaPorIsbn, portadaRecordada } from './cafePortadaIsbn';
import { portadaPixel } from './cafePortadas';
import { Pista } from './Pista';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const reloj = () => performance.now();
const rgb = (c) => `rgb(${c[0]} ${c[1]} ${c[2]})`;
/** El respiro entre un gesto y el siguiente (directo con movimiento reducido). */
const RESPIRO_MS = 380;
/** Dónde va la pista de cada gesto (la marca de la escena; en el cordel, también el centro de la vuelta). */
const MARCA_LIB = { papel: 'rollo', doblar: 'libro', cordel: 'libro', abrir: 'libro', marca: 'libro', bolsa: 'bolsas', meter: 'libroAlto', pliegue: 'bolsaBorde', sello: 'libro' };
const SONIDO_FORMA = { regalar: 'kraft', aqui: 'marca', llevar: 'pliegue' };
const OBJETO_FORMA = { regalar: 'rollo', aqui: 'tarro', llevar: 'bolsas' };
const ETIQUETA_FORMA = { regalar: 'Papel y cordel', aqui: 'Marcapáginas', llevar: 'Bolsas' };
const paginasDe = (p) => (p ? `${p} págs.` : 'sin páginas');
const extensionTexto = (p) => ({ corto: 'corto', largo: 'largo' })[extensionDe(p)] ?? 'corto o largo';
const urlPortada = (b) => b?.cover || portadaRecordada(b?.isbn) || null;

/** Cuando la cámara ha llegado (la escena está quieta), una vez. Devuelve cómo cancelarlo. */
function alQuedarQuieta(escena, fn) {
  let vivo = true;
  let id = 0;
  const mira = () => {
    if (!vivo) return;
    if (escena && !escena.settled()) {
      id = requestAnimationFrame(mira);
      return;
    }
    fn();
  };
  id = requestAnimationFrame(mira);
  return () => {
    vivo = false;
    cancelAnimationFrame(id);
  };
}

/**
 * La librería de Atender: `activo` mientras dura el paso del libro; `pedido`, lo que pide ({ genero, extension, forma });
 * `balda`, los libros de la balda (`librosDeLaBalda`). Devuelve lo que Atender pone en la escena (`capa`) y en su cuadro
 * (`texto`, `extra`, `botones`), y si la comanda se pliega.
 */
export function useLibreria({ activo, pedido, balda, escena, sfx, ayuda = false, onListo, onSolo }) {
  const [fase, setFase] = useState('estanteria');
  const [genero, setGenero] = useState(null);
  const [foco, setFoco] = useState(null);
  const [sale, setSale] = useState(0);
  const [elegido, setElegido] = useState(null);
  const [enTabla, setEnTabla] = useState(false);
  const [tabla, setTabla] = useState(0);
  const [posa, setPosa] = useState(1);
  const [portada, setPortada] = useState(null);
  // Las portadas que no cargaron (por URL) y la de esa edición en Google Books (por ISBN), como en las fichas de la 1.128
  const [fallidas, setFallidas] = useState({});
  const [alternas, setAlternas] = useState({});
  const [forma, setForma] = useState(null);
  const [gi, setGi] = useState(0);
  const [hechos, setHechos] = useState({});
  const [g, setG] = useState(null);
  const [soplo, setSoplo] = useState(1);
  const [cerrar, setCerrar] = useState(0);
  const [bandeja, setBandeja] = useState(0);
  const [placas, setPlacas] = useState([]);
  const [lomos, setLomos] = useState([]);
  const [pistaEn, setPistaEn] = useState(null);
  const [objetos, setObjetos] = useState([]);
  const zona = useRef(null);
  const rec = useRef(null);
  const raf = useRef(0);
  const anim = useRef(0);
  const respiro = useRef(0);
  const arrastre = useRef(null);

  const tramos = useMemo(() => estanteLibreria(balda ?? []), [balda]);
  const secciones = useMemo(() => tramos.filter((t) => t.placa).map((t) => ({ genero: t.genero, nombre: t.nombre })), [tramos]);
  const porClave = useMemo(() => new Map((balda ?? []).map((b) => [b.clave, b])), [balda]);
  const deSeccion = useMemo(() => tramos.filter((t) => t.genero === genero).flatMap((t) => t.lomos), [tramos, genero]);
  const gestos = formaPorId(forma)?.gestos ?? [];
  const gesto = fase === 'gesto' ? (gestos[gi] ?? null) : null;
  const clave = gesto ? `${forma}:${gi}:${gesto}` : null;
  const actual = gesto && g?.clave === clave ? g : null;
  const pista = pistaEn?.clave === clave ? pistaEn : null;
  const def = gesto ? GESTOS[gesto] : null;
  const focoLomo = fase === 'seccion' ? (lomos.find((l) => l.k === foco) ?? null) : null;
  const focoDato = fase === 'seccion' ? (deSeccion.find((l) => l.k === foco) ?? null) : null;
  const sin3d = !escena;

  // ── La escena sigue a la librería ──
  useEffect(() => {
    if (!activo || !escena) return;
    escena.setLibreria?.({
      fase,
      genero,
      foco,
      sale,
      tabla,
      posa,
      libro: elegido && enTabla ? { k: elegido.k, clave: elegido.clave, titulo: elegido.titulo, alto: elegido.alto, g: elegido.g } : null,
      portada,
      forma,
      gesto,
      pose: actual?.pose ?? null,
      hechos,
      soplo,
      cerrar,
      bandeja,
    });
  }, [activo, escena, fase, genero, foco, sale, tabla, posa, elegido, enTabla, portada, forma, gesto, actual, hechos, soplo, cerrar, bandeja]);
  // Al acabar (o al irte con «Luego»), la escena sale de la librería
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      cancelAnimationFrame(anim.current);
      clearTimeout(respiro.current);
      escena?.libreria?.(false);
    },
    [escena],
  );
  // Dónde caen las placas, los lomos, lo de envolver y la pista, cuando la cámara ya ha llegado
  const enZona = (p) => {
    const r = zona.current?.getBoundingClientRect();
    return r ? { ...p, x: p.x - r.left, y: p.y - r.top, cx: p.x, cy: p.y } : null;
  };
  useEffect(() => {
    if (!activo || !escena || fase !== 'estanteria') return undefined;
    return alQuedarQuieta(escena, () =>
      setPlacas(
        (escena.libreriaPlacas?.() ?? [])
          .filter((p) => p.front)
          .map(enZona)
          .filter(Boolean),
      ),
    );
  }, [activo, escena, fase, tramos]);
  useEffect(() => {
    if (!activo || !escena || fase !== 'seccion') return undefined;
    return alQuedarQuieta(escena, () => {
      const r = zona.current?.getBoundingClientRect();
      if (!r) return;
      setLomos((escena.libreriaLomos?.() ?? []).filter((l) => l.front).map((l) => ({ ...l, x: l.x - r.left, x0: l.x0 - r.left, x1: l.x1 - r.left, y: l.y - r.top })));
    });
  }, [activo, escena, fase, genero, tramos]);
  useEffect(() => {
    if (!activo || !escena || fase !== 'forma') return undefined;
    return alQuedarQuieta(escena, () =>
      setObjetos(
        FORMAS.map((f) => ({ forma: f.id, ...escena.libreriaMarca?.(OBJETO_FORMA[f.id]) }))
          .filter((o) => o.front)
          .map(enZona)
          .filter(Boolean),
      ),
    );
  }, [activo, escena, fase]);
  useEffect(() => {
    if (!gesto) return undefined;
    return alQuedarQuieta(escena, () => {
      const r = zona.current?.getBoundingClientRect();
      if (!r) return;
      // El sello, para llevar, va en el borde doblado de la bolsa
      const m = escena?.libreriaMarca?.(gesto === 'sello' && forma === 'llevar' ? 'bolsaBorde' : MARCA_LIB[gesto]);
      if (m) setPistaEn({ clave, x: m.x - r.left, y: m.y - r.top, cx: m.x, cy: m.y });
      else setPistaEn({ clave, x: r.width / 2, y: r.height * 0.32, cx: r.left + r.width / 2, cy: r.top + r.height * 0.32 });
    });
  }, [gesto, clave, escena, forma]);
  // La portada real del libro elegido, pixelada para la escena (si no se puede, la tapa de color)
  useEffect(() => {
    if (!elegido) {
      setPortada(null);
      return undefined;
    }
    let vivo = true;
    const b = elegido.b;
    portadaPixel(urlPortada(b))
      .then((p) => p ?? (b?.isbn ? portadaPorIsbn(b.isbn).then((otra) => portadaPixel(otra || null)) : null))
      .then((p) => vivo && setPortada(p ?? null));
    return () => {
      vivo = false;
    };
  }, [elegido]);
  // En la ficha: su portada; si no carga (o no tiene), la de su ISBN en Google Books; si tampoco, la tapa de color
  const fichaB = fase === 'mirar' ? (elegido?.b ?? null) : null;
  const portadaFicha = (() => {
    if (!fichaB) return null;
    if (fichaB.cover && !fallidas[fichaB.cover]) return fichaB.cover;
    const otra = alternas[fichaB.isbn] ?? portadaRecordada(fichaB.isbn);
    return otra && !fallidas[otra] ? otra : null;
  })();
  const isbnFalta = fichaB?.isbn && (!fichaB.cover || fallidas[fichaB.cover]) && alternas[fichaB.isbn] === undefined && portadaRecordada(fichaB.isbn) === undefined ? fichaB.isbn : null;
  useEffect(() => {
    if (!isbnFalta) return undefined;
    let vivo = true;
    portadaPorIsbn(isbnFalta).then((url) => vivo && setAlternas((m) => ({ ...m, [isbnFalta]: url })));
    return () => {
      vivo = false;
    };
  }, [isbnFalta]);

  /** Una animación corta (de 0 a 1 en `ms`); directa con movimiento reducido o sin escena. */
  const tween = (ms, fn, fin) => {
    cancelAnimationFrame(anim.current);
    if (reduced() || !escena) {
      fn(1);
      fin?.();
      return;
    }
    const t0 = performance.now();
    const paso = (now) => {
      const t = Math.min(1, Math.max(0, (now - t0) / ms));
      fn(t);
      if (t < 1) anim.current = requestAnimationFrame(paso);
      else fin?.();
    };
    anim.current = requestAnimationFrame(paso);
  };

  // ── 1 y 2. La sección y los lomos ──
  const elegirSeccion = (gen) => {
    if (fase !== 'estanteria') return;
    sfx.play('placa');
    setGenero(gen);
    setFoco(null);
    setSale(0);
    setLomos([]);
    setFase('seccion');
  };
  const otraSeccion = () => {
    sfx.play('placa');
    setFoco(null);
    setSale(0);
    setFase('estanteria');
  };
  const enfocar = (k) => {
    if (k == null || k === foco) return;
    setFoco(k);
    sfx.play('lomo', {
      k: Math.max(
        0,
        deSeccion.findIndex((l) => l.k === k),
      ),
    });
  };
  /** El lomo bajo el dedo (en px de la capa), o el más cercano si cae entre dos. */
  const lomoEn = (x) => {
    let mejor = null;
    let dist = Infinity;
    for (const l of lomos) {
      const d = x < l.x0 ? l.x0 - x : x > l.x1 ? x - l.x1 : 0;
      if (d < dist) {
        dist = d;
        mejor = l;
      }
    }
    return dist < 36 ? mejor.k : null;
  };
  // ── 3. Sale de la balda, la tabla y el libro en ella ──
  const sacar = (k = foco) => {
    const l = deSeccion.find((x) => x.k === k);
    if (!l) return;
    arrastre.current = null;
    sfx.play('sacar');
    setFoco(k);
    setElegido({ k: l.k, clave: l.clave, titulo: l.titulo, paginas: l.paginas, alto: l.alto, g: grosorDe(l.paginas), b: porClave.get(l.clave) ?? { title: l.titulo } });
    setSale(1);
    setEnTabla(false);
    setPosa(0);
    setFase('tabla');
    setTimeout(() => sfx.play('tabla'), reduced() ? 0 : 140);
    tween(460, setTabla, () => {
      setEnTabla(true);
      tween(240, setPosa, () => {
        sfx.play('libroTabla');
        setFase('mirar');
      });
    });
  };
  const devolver = () => {
    sfx.play('devolver');
    const k = elegido?.k ?? null;
    setEnTabla(false);
    setElegido(null);
    setForma(null);
    setHechos({});
    setGi(0);
    setG(null);
    rec.current = null;
    tween(
      300,
      (t) => setTabla(1 - t),
      () => {
        setSale(0);
        setFoco(k);
        setFase('seccion');
      },
    );
  };
  const este = () => {
    sfx.play('libroEtapa');
    setFase('forma');
  };
  // ── 4. La forma y sus gestos ──
  const elegirForma = (f) => {
    if (fase !== 'forma') return;
    sfx.play(SONIDO_FORMA[f]);
    rec.current = null;
    setForma(f);
    setGi(0);
    setHechos({});
    setG(null);
    setSoplo(1);
    setCerrar(0);
    setFase('gesto');
  };
  const alBandeja = () => {
    setFase('listo');
    sfx.play('devolver');
    tween(420, setBandeja, () => sfx.play('libroTabla'));
  };
  const terminar = () => {
    if (forma === 'aqui') {
      setFase('cerrando');
      tween(340, setCerrar, () => {
        sfx.play('cierra');
        alBandeja();
      });
    } else alBandeja();
  };
  const reconocedor = () => {
    if (rec.current?.clave !== clave) {
      const ancho = zona.current?.getBoundingClientRect().width || 390;
      const centro = pista ? { x: pista.cx, y: pista.cy } : null;
      rec.current = { clave, g: crearGesto(gesto, { escala: Math.min(ancho, 600) / 390, centro }) };
    }
    return rec.current.g;
  };
  const aplicar = (s) => {
    setG({ ...s, clave });
    if (rec.current?.fin) return;
    for (const ev of s.eventos) if (ev !== 'hecho' && ev !== 'toca') sfx.play(ev);
    if (s.hecho && rec.current && !rec.current.fin) {
      rec.current.fin = true;
      cancelAnimationFrame(raf.current);
      const h = { ...hechos, [gesto]: s.pose };
      const sig = gi + 1;
      if (gesto === 'bolsa') {
        setSoplo(0);
        tween(280, setSoplo);
      }
      clearTimeout(respiro.current);
      const seguir = () => {
        setHechos(h);
        rec.current = null;
        setG(null);
        if (sig < gestos.length) {
          sfx.play('libroEtapa');
          setGi(sig);
        } else terminar();
      };
      if (reduced()) seguir();
      else respiro.current = setTimeout(seguir, RESPIRO_MS);
    }
  };
  const latido = () => {
    const r = rec.current?.g;
    if (!r) return;
    const s = r.paso(reloj());
    aplicar(s);
    if (s.pulsado && !s.hecho) raf.current = requestAnimationFrame(latido);
  };
  const completar = () => {
    if (!gesto || actual?.hecho) return;
    aplicar(reconocedor().completar());
  };

  // ── El dedo sobre la escena: en la sección, pasar por los lomos y tirar; en los gestos, el reconocedor ──
  const onDown = (e) => {
    if (fase === 'seccion') {
      const r = zona.current?.getBoundingClientRect();
      if (!r) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const k = lomoEn(e.clientX - r.left);
      enfocar(k);
      arrastre.current = { id: e.pointerId, x: e.clientX, y: e.clientY, modo: null, k: k ?? foco };
      return;
    }
    if (!gesto || actual?.hecho) return;
    e.preventDefault();
    if (reduced()) return completar();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const r = reconocedor();
    aplicar(r.abajo(e.clientX, e.clientY, reloj()));
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(latido);
  };
  const onMove = (e) => {
    if (fase === 'seccion') {
      const d = arrastre.current;
      if (!d || d.id !== e.pointerId) return;
      const r = zona.current?.getBoundingClientRect();
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.modo) {
        if (dy > 10 && dy > Math.abs(dx) * 1.2 && d.k != null && !reduced()) {
          d.modo = 'sacar';
          d.g = crearGesto('sacar', { escala: Math.min(r?.width || 390, 600) / 390 });
          d.g.abajo(d.x, d.y, reloj());
          if (d.k !== foco) setFoco(d.k);
        } else if (Math.abs(dx) > 6) d.modo = 'pasar';
      }
      if (d.modo === 'pasar' && r) {
        const k = lomoEn(e.clientX - r.left);
        if (k != null) {
          d.k = k;
          enfocar(k);
        }
      } else if (d.modo === 'sacar') {
        const s = d.g.mover(e.clientX, e.clientY, reloj());
        setSale(s.pose.fuera ?? 0);
        if (s.hecho) sacar(d.k);
      }
      return;
    }
    const r = rec.current?.clave === clave ? rec.current.g : null;
    if (!r || !r.estado.pulsado) return;
    aplicar(r.mover(e.clientX, e.clientY, reloj()));
  };
  const onUp = (e) => {
    if (fase === 'seccion') {
      const d = arrastre.current;
      if (!d || (e.pointerId != null && d.id !== e.pointerId)) return;
      arrastre.current = null;
      if (d.modo === 'sacar') setSale(0);
      return;
    }
    const r = rec.current?.clave === clave ? rec.current.g : null;
    cancelAnimationFrame(raf.current);
    if (!r || !r.estado.pulsado) return;
    aplicar(r.arriba());
  };
  const onKey = (e) => {
    if (e.repeat) return;
    if (fase === 'seccion' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const orden = lomos.length ? lomos.map((l) => l.k) : deSeccion.map((l) => l.k);
      const i = orden.indexOf(foco);
      enfocar(orden[Math.max(0, Math.min(orden.length - 1, i < 0 ? 0 : i + (e.key === 'ArrowRight' ? 1 : -1)))]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (fase === 'seccion' && foco != null) {
        e.preventDefault();
        sacar();
      } else if (gesto) {
        e.preventDefault();
        completar();
      }
    }
  };

  const listo = () => {
    const b = elegido?.b ?? null;
    onListo({ libro: b, forma, ok: aciertosLibro(b, pedido, forma), paquete: { forma, titulo: elegido?.titulo ?? '' } });
  };

  // ── Lo que se ve encima de la escena ──
  const toca = fase === 'seccion' || Boolean(gesto);
  const capa = !activo ? null : (
    <div
      ref={zona}
      className="cf3-gesto cf3-lib"
      data-fase={fase}
      data-activo={toca ? 'true' : undefined}
      data-gesto={gesto ?? undefined}
      role={toca ? 'button' : undefined}
      tabIndex={toca ? 0 : -1}
      aria-hidden={toca || fase === 'estanteria' || fase === 'forma' ? undefined : 'true'}
      aria-label={fase === 'seccion' ? 'Los lomos de la sección. Con las flechas pasas de uno a otro; Intro lo saca.' : gesto ? `${def.orden}. Con el teclado, Intro lo hace de una vez.` : undefined}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onLostPointerCapture={onUp}
      onKeyDown={onKey}
    >
      {fase === 'estanteria' &&
        placas.map((p) => (
          <button
            key={p.genero}
            type="button"
            className="cf3-seccion"
            data-genero={p.genero}
            style={{ left: `${p.x}px`, top: `${p.y}px`, '--cf3-hueco': p.ancho ? `${Math.round(p.ancho - 8)}px` : undefined }}
            onClick={() => elegirSeccion(p.genero)}
            aria-label={`Sección ${p.nombre}`}
          >
            {p.nombre}
          </button>
        ))}
      {fase === 'seccion' && foco == null && lomos.length > 0 && (
        <span className="cf3-gesto__pista" style={{ left: `${(lomos[0].x + lomos[lomos.length - 1].x) / 2}px`, top: `${Math.min(...lomos.map((l) => l.y)) + 36}px` }}>
          <Pista trazo="vaiven" />
        </span>
      )}
      {focoLomo && focoDato && (
        <span className="cf3-lomo-etiqueta" data-lado={ladoNota(focoLomo.x, zona.current?.clientWidth ?? 390)} style={{ left: `${focoLomo.x}px`, top: `${focoLomo.y}px` }} aria-hidden="true">
          <b>{focoDato.titulo}</b>
          <span>
            {paginasDe(focoDato.paginas)} · {extensionTexto(focoDato.paginas)}
          </span>
        </span>
      )}
      {focoLomo && sale === 0 && !reduced() && (
        <span className="cf3-gesto__pista" style={{ left: `${focoLomo.x}px`, top: `${focoLomo.y + 54}px` }}>
          <Pista tipo="sacar" />
        </span>
      )}
      {ayuda && focoLomo && sale === 0 && <span className="cf3-ayuda cf3-ayuda--gesto" style={{ left: `${focoLomo.x}px`, top: `${focoLomo.y + 20}px` }} aria-hidden="true" />}
      {fase === 'forma' &&
        objetos.map((o) => (
          <button
            key={o.forma}
            type="button"
            className="cf3-objeto"
            data-forma={o.forma}
            style={{ left: `${o.x}px`, top: `${o.y}px` }}
            onClick={() => elegirForma(o.forma)}
            aria-label={formaPorId(o.forma).nombre}
          >
            {ayuda && <span className="cf3-ayuda" aria-hidden="true" />}
            {ETIQUETA_FORMA[o.forma]}
          </button>
        ))}
      {ayuda && gesto && pista && !(actual?.progreso > 0) && <span className="cf3-ayuda cf3-ayuda--gesto" style={{ left: `${pista.x}px`, top: `${pista.y}px` }} aria-hidden="true" />}
      {gesto && pista && !(actual?.progreso > 0) && (
        <span className="cf3-gesto__pista" style={{ left: `${pista.x}px`, top: `${pista.y}px` }}>
          <Pista tipo={gesto} />
        </span>
      )}
      {gesto && pista && !(actual?.progreso > 0) && !reduced() && (
        <span className="cf3-gesto__nota" data-lado={ladoNota(pista.x, zona.current?.clientWidth ?? 390)} style={{ left: `${pista.x}px`, top: `${pista.y}px` }} aria-hidden="true">
          {def.ayuda}
        </span>
      )}
      {gesto && actual?.hecho && (
        <span className="cf3-gesto__hecho" aria-hidden="true">
          ¡Hecho!
        </span>
      )}
    </div>
  );

  // ── Lo que se dice y se elige en el cuadro de abajo ──
  let texto = '';
  let extra = null;
  const solo = (
    <button key="solo" type="button" className="cf3-btn cf3-btn--suave" onClick={onSolo}>
      Solo el café
    </button>
  );
  let botones = solo;
  if (fase === 'estanteria') {
    texto = (
      <>
        ¿Qué sección? <span className="cf3-dice__como">Toca su placa en la estantería.</span>
      </>
    );
    if (sin3d || !placas.length)
      extra = (
        <div className="cf3-opciones" role="group" aria-label="Las secciones">
          {secciones.map((s) => (
            <button key={s.genero} type="button" className="cf3-opcion" data-genero={s.genero} onClick={() => elegirSeccion(s.genero)}>
              {s.nombre}
            </button>
          ))}
        </div>
      );
  } else if (fase === 'seccion') {
    texto = (
      <>
        {nombreGenero(genero)}. <span className="cf3-dice__como">{reduced() || sin3d ? 'Toca un lomo y sácalo.' : 'Pasa el dedo por los lomos y tira hacia abajo del que quieras.'}</span>
      </>
    );
    if (sin3d || !lomos.length)
      extra = (
        <div className="cf3-opciones cf3-opciones--lomos" role="group" aria-label={`Los libros de ${nombreGenero(genero)}`}>
          {deSeccion
            .filter((l, i, a) => a.findIndex((x) => x.clave === l.clave) === i)
            .map((l) => (
              <button key={l.k} type="button" className="cf3-opcion" data-clave={l.clave} aria-pressed={foco === l.k} onClick={() => enfocar(l.k)} style={{ '--cf3-tapa': rgb(colorDe(l.titulo)) }}>
                {l.titulo} · {paginasDe(l.paginas)}
              </button>
            ))}
        </div>
      );
    botones = (
      <>
        <button key="otra" type="button" className="cf3-btn cf3-btn--suave" onClick={otraSeccion}>
          Otra sección
        </button>
        {solo}
        {foco != null && (reduced() || sin3d || !lomos.length) && (
          <button key="sacar" type="button" className="cf3-btn cf3-btn--verde" onClick={() => sacar()}>
            Sacarlo
          </button>
        )}
      </>
    );
  } else if (fase === 'tabla') {
    texto = 'Sale la tabla…';
    botones = null;
  } else if (fase === 'mirar' && elegido) {
    const b = elegido.b ?? {};
    const img = portadaFicha;
    texto = '¿Este? Míralo bien.';
    extra = (
      <div className="cf3-libro" style={{ '--cf3-tapa': rgb(colorDe(elegido.titulo)) }}>
        <span className={`cf3-ficha__tapa${img ? ' cf3-ficha__tapa--portada' : ''}`} aria-hidden="true">
          {img ? (
            <img
              key={img}
              className="cf3-ficha__portada"
              src={img}
              alt=""
              referrerPolicy="no-referrer"
              decoding="async"
              draggable="false"
              onLoad={(ev) => ev.currentTarget.naturalWidth < 10 && setFallidas((m) => ({ ...m, [img]: true }))}
              onError={() => setFallidas((m) => ({ ...m, [img]: true }))}
            />
          ) : (
            <span className="cf3-ficha__titulo">{elegido.titulo}</span>
          )}
        </span>
        <span className="cf3-libro__datos">
          <b className="cf3-libro__titulo">{elegido.titulo}</b>
          {b.author && <span className="cf3-libro__autor">{b.author}</span>}
          <span className="cf3-libro__pistas">
            <span>{nombreGenero(b.genero ?? genero)}</span>
            <span>{paginasDe(elegido.paginas)}</span>
            <span>{extensionTexto(elegido.paginas)}</span>
          </span>
        </span>
      </div>
    );
    botones = (
      <>
        <button key="devolver" type="button" className="cf3-btn cf3-btn--suave" onClick={devolver}>
          Devolverlo
        </button>
        {solo}
        <button key="este" type="button" className="cf3-btn cf3-btn--verde" onClick={este}>
          Este
        </button>
      </>
    );
  } else if (fase === 'forma') {
    texto = (
      <>
        ¿Cómo se lo lleva? <span className="cf3-dice__como">Toca el papel, el tarro o las bolsas.</span>
      </>
    );
    extra = (
      <div className="cf3-opciones" role="group" aria-label="Cómo se lo lleva">
        {FORMAS.map((f) => (
          <button key={f.id} type="button" className="cf3-opcion" data-forma={f.id} onClick={() => elegirForma(f.id)}>
            {f.nombre}
          </button>
        ))}
      </div>
    );
    botones = (
      <>
        <button key="devolver" type="button" className="cf3-btn cf3-btn--suave" onClick={devolver}>
          Otro libro
        </button>
        {solo}
      </>
    );
  } else if (fase === 'gesto' && def) {
    texto = reduced() ? (
      `${def.orden}. Un toque basta.`
    ) : (
      <>
        {def.orden}.<span className="px-sr"> {def.ayuda}</span>
      </>
    );
    extra = (
      <>
        <ol className="cf3-etapas cf3-etapas--libro" aria-label={`Los pasos: ${formaPorId(forma).nombre.toLowerCase()}`}>
          {gestos.map((id, k) => {
            const est = k < gi ? 'hecha' : k === gi ? 'ahora' : 'luego';
            return (
              <li key={id} data-estado={est} aria-current={est === 'ahora' ? 'step' : undefined}>
                <span className="cf3-etapas__num" aria-hidden="true">
                  {est === 'hecha' ? '✓' : k + 1}
                </span>
                <span className="cf3-etapas__nombre">{GESTOS[id].atajo}</span>
              </li>
            );
          })}
        </ol>
        <div className="cf3-medidor" role="progressbar" aria-label={def.orden} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((actual?.progreso ?? 0) * 100)}>
          <span className="cf3-medidor__lleno" style={{ width: `${Math.round((actual?.progreso ?? 0) * 100)}%` }} />
        </div>
      </>
    );
    botones = (reduced() || sin3d) && (
      <button key={`atajo-${clave}`} type="button" className="cf3-btn cf3-btn--verde" onClick={completar}>
        {def.atajo}
      </button>
    );
  } else if (fase === 'cerrando' || fase === 'listo') {
    texto = forma === 'regalar' ? '¡Listo! Envuelto y con su lazo.' : forma === 'aqui' ? '¡Listo! Con su marcapáginas, para leerlo aquí.' : '¡Listo! En su bolsa, para llevar.';
    botones =
      fase === 'listo' ? (
        <button key="llevarlo" type="button" className="cf3-btn cf3-btn--verde" onClick={listo}>
          Llevárselo
        </button>
      ) : null;
  }

  return { capa, texto, extra, botones, fase, gesto, plegada: Boolean(gesto), progreso: gesto ? Math.round((actual?.progreso ?? 0) * 100) : undefined };
}
