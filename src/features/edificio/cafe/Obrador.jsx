// El café-librería del bajo, 1.143 (encargo de Francisco del 17-11-2026; plan en docs/qa/cafe-libreria.md §18, aprobado el mismo
// día): el obrador del ala lateral. La primera vez (desde el nivel 4) se abre el tabique y Pilar enseña el horno de la tahona de
// doña Amparo y su recetario; la primera hornada de la casa ya está en la vitrina de la barra. Después, cada vez:
// 1. El recetario: seis páginas (dos se hornean ya; las demás dicen en qué nivel se abren). Se elige una.
// 2. Sus dos gestos sobre la mesa de mármol (`cafeObradorGestos.js`), cada uno con su objeto y su sonido. Cómo quedan da las
//    estrellas (las del taller) y las estrellas, las piezas.
// 3. La pala al horno (empujar hacia el fondo) y `cafe_hornear`. Sin números: la hornada se dora poco a poco y la campanilla
//    avisa. Se puede salir mientras tanto; nunca se quema.
// 4. La pala fuera (tirar hacia ti) y `cafe_sacar_hornada`: Pilar lo lleva a la vitrina; lo que no cabe espera en la bandeja.
// Con movimiento reducido o con el teclado, cada gesto se hace de una vez y queda bien. La «!» de ayuda, como en la barra.
// 1.144 (bloque 2): cada receta enseña su maestría (★ con 3 hornadas buenas, ★★ con 10, ★★★ con 25) y si es la especialidad del
// día; con ★★★, «Que lo hornee Pilar»: sus manos hacen los dos gestos y la pala (unos 3 s; con movimiento reducido, de una vez).
// La última página, «El obrador»: las mejoras del horno y de la vitrina (con granos, una vez, para siempre), las vitrinas de tartas
// y lo que te ha dado cada cosa.
// 1.145 (bloque 3): las seis recetas se hornean, cada una desde su nivel. El pan de la bodega va en dos días: hoy se amasa y
// `cafe_masa_reposar` lo deja en la bodega ('reposa'); desde mañana, con la masa subida, se greña y al horno. La tortilla, al
// fogón: la vuelta con el plato junto al fuego, de vuelta a la sartén y fuera. En «El obrador», los hitos y sus adornos.
import { useEffect, useRef, useState } from 'react';
import { AYUDA_NIVELES, AYUDA_PARADO_MS, ladoNota, verAyuda } from './cafeGestos';
import {
  FOGON_NIVEL,
  GESTO_OBRADOR,
  HITOS_OBRADOR,
  HORNABLES,
  MASA,
  MEJORAS_OBRADOR,
  faltanHito,
  palaDe,
  PILAR_MEJORAS,
  PILAR_OBRADOR,
  PREMIO_MAESTRIA,
  TARTAS,
  RECETAS_OBRADOR,
  TOPE_HORNADAS,
  bandejaLibre,
  enVitrina,
  estadoHorno,
  faltanMaestria,
  fraseHorno,
  fraseMostrador,
  nombrePiezas,
  piezasDe,
  precioMesa,
  recetaAbierta,
  recetaObrador,
  siguienteMejora,
} from './cafeObrador';
import { GESTOS_RECETA, crearGestoObrador, trazoPilar } from './cafeObradorGestos';
import { crearSfxBarra } from './cafeSfx';
import { abrirObrador, errorCafe, hornear, hornearPilar, mejorarObrador, reposarMasa, sacarHornada } from './cafeService';
import { PILAR } from './cafeIconos';
import { PixelArt } from './PixelArt';
import { Pista } from './Pista';
import './cafeObrador.css';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** El trazo de la pista y la marca de la escena sobre la que va, por gesto. */
const PISTA = {
  rallar: 'abajo',
  colmar: 'vaiven',
  rodillo: 'vaiven-vertical',
  repulgo: 'giro',
  meter: 'arriba',
  sacar: 'abajo',
  // 1.145
  cortapastas: 'toque',
  glasa: 'ola',
  amasar: 'empujar',
  grenar: 'tajo',
  envolver: 'jota',
  tamiz: 'pasadas',
  cascar: 'cascar',
  vuelta: 'media-vuelta',
};
const MARCA = {
  rallar: 'rallador',
  colmar: 'moldes',
  rodillo: 'masa',
  repulgo: 'fuente',
  meter: 'pala',
  sacar: 'boca',
  cortapastas: 'hojaGalletas',
  glasa: 'raya',
  amasar: 'masaMadre',
  grenar: 'hogaza',
  envolver: 'bol',
  tamiz: 'plantilla',
  cascar: 'bolHuevos',
  vuelta: 'sarten',
};
/** El sonido de cada cosa que pasa en un gesto (los de las recetas nuevas, 1.145, con su nombre). */
const SONIDO = {
  raspa: 'rallar',
  masa: 'masa',
  colmado: 'colmado',
  rebosa: 'rebosa',
  rueda: 'rodillo',
  vuelta: 'vueltaRodillo',
  masaToca: 'masaToca',
  empuja: 'empuja',
  recoge: 'recoge',
  tajo: 'tajo',
  espatula: 'espatula',
  pliega: 'pliega',
  azucar: 'azucar',
  golpe: 'golpeHuevo',
  abre: 'abre',
  cascara: 'cascara',
  gira: 'chisporroteo',
  plof: 'plof',
};
/** Con varios del mismo (un tramo, una forma), el sonido sube un poco con cada uno. */
const CONTADOS = { corta: 'cortapastas', glasa: 'glasa', cubre: 'cubre' };
/** Lo que tarda en pasar al gesto siguiente, para que se lea lo que dice Pilar. */
const PAUSA_MS = 1300;
const HORNO = { 60: 'Al horno, un ratito', 90: 'Al horno, un rato largo' };
/** Cómo se hace cada receta (en la ficha), si no es solo «al horno». */
const COMO = { pan: 'Duerme una noche en la bodega; después, al horno un ratito', tortilla: 'Al fogón, un ratito' };
/** Las páginas del recetario: las seis recetas y, al final, «El obrador» (las mejoras; sin la migración 2, no está). */
const paginasDe = (obrador) => RECETAS_OBRADOR.length + (obrador?.conMejoras ? 1 : 0);
/** Entre un gesto de Pilar y el siguiente. */
const PAUSA_PILAR_MS = 280;

/** La maestría de una receta: tres estrellas de horno (las ganadas, llenas). */
function Maestria({ n }) {
  return (
    <span className="cf3-maestria" role="img" aria-label={`Maestría: ${n} de 3`}>
      {[1, 2, 3].map((k) => (
        <span key={k} className="cf3-maestria__estrella" data-llena={k <= n ? 'true' : undefined} aria-hidden="true" />
      ))}
    </span>
  );
}

function Estrellas({ n }) {
  return (
    <span className="cf3-estrellas" role="img" aria-label={`${n} de 3 estrellas`}>
      {[1, 2, 3].map((k) => (
        <span key={k} className="cf3-estrella" data-llena={k <= n ? 'true' : undefined} aria-hidden="true" />
      ))}
    </span>
  );
}

/**
 * `obrador`: el del servidor (`obradorDe` en cafeService.js), o null si aún no se ha abierto; `onObrador(obrador)`, con cada
 * estado nuevo que devuelve el servidor (la vitrina y el horno de fuera lo usan).
 */
export function Obrador({ escena, obrador, nivel = 4, soundOn = false, ayudas = 'auto', especialidad = null, granos = 0, dia = null, onObrador, onCafe, onCerrar }) {
  const [ahora, setAhora] = useState(() => Date.now());
  const horneando = obrador?.horneando ?? [];
  const listaDe = (o, t) => (o?.horneando ?? []).find((h) => estadoHorno(h, t).listo) ?? null;
  // 'abriendo' (el servidor abre el obrador), 'descubre' (Pilar lo enseña), 'recetario', 'gesto' (los dos de la receta),
  // 'meter' (la pala al horno), 'horneando', 'sacar' (la pala fuera) y 'hecho' (a la vitrina)
  const [fase, setFase] = useState(() => (!obrador ? 'abriendo' : listaDe(obrador, Date.now()) ? 'sacar' : 'recetario'));
  const [linea, setLinea] = useState(0);
  const [receta, setReceta] = useState(null);
  const [paso, setPaso] = useState(0);
  const [comentario, setComentario] = useState(null);
  const [bandeja, setBandeja] = useState(() => listaDe(obrador, Date.now())?.bandeja ?? null);
  const [dado, setDado] = useState(null);
  const [sacado, setSacado] = useState(null);
  const [pagina, setPagina] = useState(0);
  const [g, setG] = useState(null);
  const [pista, setPista] = useState(null);
  const [parado, setParado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  // 1.144: Pilar hornea esta receta (sus manos hacen los gestos) y lo último que ha dicho Pilar en el recetario (al mejorar algo)
  const [pilarHace, setPilarHace] = useState(false);
  const [dicho, setDicho] = useState(null);
  const [sfx] = useState(() => crearSfxBarra());
  const zona = useRef(null);
  const hojas = useRef(null);
  const rec = useRef(null);
  const medida = useRef({});
  const fin = useRef(false);
  const mimo = useRef([]);
  const timers = useRef([]);
  const despues = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const tipo = fase === 'gesto' && receta ? GESTOS_RECETA[receta]?.[paso] : fase === 'meter' || fase === 'sacar' ? fase : null;
  // 1.145: la tortilla, al fogón (la que se trabaja, o la que está en la bandeja que se mira)
  const recetaAhora = fase === 'sacar' || fase === 'horneando' ? ((horneando.find((h) => h.bandeja === bandeja) ?? horneando[0])?.receta ?? receta) : receta;
  const alFogon = Boolean(recetaObrador(recetaAhora)?.fogon);
  // Al descubrirlo, el horno entero; en cada gesto, su objeto; con la pala, la boca del horno (o el fogón); y si no, la mesa
  const vista =
    fase === 'abriendo' || fase === 'descubre'
      ? 'todo'
      : fase === 'gesto'
        ? tipo
        : fase === 'meter' || fase === 'horneando' || fase === 'sacar'
          ? alFogon
            ? 'fogon'
            : 'horno'
          : 'mesa';

  useEffect(() => sfx.setActivo(soundOn), [sfx, soundOn]);
  // Entrar y salir de la vista del obrador
  useEffect(() => {
    escena?.obrador(true);
    const pendientes = timers.current;
    return () => {
      for (const t of pendientes) clearTimeout(t);
      sfx.apagar();
      escena?.obrador(false);
    };
    // Solo al abrir y cerrar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escena]);
  // La primera vez: el servidor abre el obrador (y deja la primera hornada en la vitrina); se cae el tabique
  // (Una sola llamada aunque el efecto se repita, como en el modo estricto de desarrollo: la segunda ya lo vería abierto)
  const abriendo = useRef(null);
  useEffect(() => {
    if (fase !== 'abriendo') return undefined;
    let vivo = true;
    abriendo.current ??= abrirObrador();
    abriendo.current.then(
      (r) => {
        if (!vivo) return;
        onObrador?.(r.obrador);
        if (r.nuevo) {
          sfx.play('tabique');
          setFase('descubre');
        } else setFase('recetario');
      },
      (e) => {
        if (!vivo) return;
        setError(errorCafe(e));
      },
    );
    return () => {
      vivo = false;
    };
    // Solo al empezar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // El reloj del horno, mientras hay algo dentro (sin números: solo para dorarlo y para la campanilla)
  useEffect(() => {
    if (!horneando.length) return undefined;
    const id = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(id);
  }, [horneando.length]);
  // Mirando el horno, al sonar la campanilla: a sacarla
  useEffect(() => {
    if (fase !== 'horneando') return;
    const h = horneando.find((x) => x.bandeja === bandeja) ?? horneando[0];
    if (h && estadoHorno(h, ahora).listo) {
      sfx.play('campanillaHorno');
      setBandeja(h.bandeja);
      reiniciar();
      setFase('sacar');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, ahora]);

  // Lo que se ve del obrador. La bandeja con la que se trabaja va la primera (es la que se dibuja en la boca del horno)
  const pose = g?.pose ?? {};
  const enHorno = [...horneando].sort((a, b) => (a.bandeja === bandeja ? -1 : b.bandeja === bandeja ? 1 : a.bandeja - b.bandeja));
  const listo = horneando.some((h) => estadoHorno(h, ahora).listo);
  const faseEscena = fase === 'gesto' ? tipo : fase === 'meter' || fase === 'sacar' || fase === 'reposa' ? fase : 'recetario';
  useEffect(() => {
    escena?.setObrador({
      abierto: Boolean(obrador),
      vista,
      fase: faseEscena,
      receta: fase === 'sacar' ? (enHorno[0]?.receta ?? receta) : receta,
      pose,
      horneando: enHorno.map((h) => ({ receta: h.receta, t: estadoHorno(h, ahora).t })),
      listo,
      horno: obrador?.horno ?? 1,
      pilar: pilarHace && (fase === 'gesto' || fase === 'meter'),
      // 1.145: el fogón (desde el nivel 8), los adornos de los hitos y la masa del pan
      fogon: nivel >= FOGON_NIVEL,
      hitos: obrador?.hitos ?? 0,
      masa: obrador?.masa ? (obrador.masa.lista ? 'lista' : 'reposa') : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escena, obrador, vista, faseEscena, receta, g, ahora, bandeja, listo, pilarHace, nivel]);

  // Dónde cae el objeto del gesto en la pantalla, cuando la cámara ya ha llegado (la pista, la nota, la «!» y las medidas)
  useEffect(() => {
    setPista(null);
    if (!tipo) return undefined;
    let vivo = true;
    let id = 0;
    const mira = () => {
      if (!vivo) return;
      if (escena && !escena.settled()) {
        id = requestAnimationFrame(mira);
        return;
      }
      const r = zona.current?.getBoundingClientRect();
      const marca = (tipo === 'meter' || tipo === 'sacar') && alFogon ? 'fogon' : MARCA[tipo];
      const m = escena?.obradorMarca(marca);
      if (m && r) {
        setPista({ x: m.x - r.left, y: m.y - r.top });
        const med = { centro: { x: m.x, y: m.y } };
        // 1.145: lo que mide cada objeto en la pantalla (la hoja de las galletas, la raya y su ola, la plantilla y la sartén)
        const entre = (a, b, eje) => {
          const p = escena.obradorMarca(a);
          const q = escena.obradorMarca(b);
          return p && q ? Math.abs(q[eje] - p[eje]) : null;
        };
        if (tipo === 'cortapastas') {
          med.ancho = entre('hojaIzq', 'hojaDer', 'x');
          med.alto = entre('hojaArr', 'hojaAbj', 'y');
        }
        if (tipo === 'glasa') {
          med.ancho = entre('rayaIzq', 'rayaDer', 'x');
          const cresta = escena.obradorMarca('rayaCresta');
          if (cresta) med.ola = Math.abs(cresta.y - m.y);
        }
        if (tipo === 'tamiz') {
          med.ancho = entre('plantillaIzq', 'plantillaDer', 'x');
          med.alto = entre('plantillaArr', 'plantillaAbj', 'y');
        }
        if (tipo === 'vuelta') {
          const b = escena.obradorMarca('sartenBorde');
          if (b) med.radio = Math.abs(b.x - m.x);
        }
        if (tipo === 'colmar') {
          const a = escena.obradorMarca('moldeIzq');
          const b = escena.obradorMarca('moldeDer');
          if (a && b) med.ancho = Math.abs(b.x - a.x);
        }
        // El borde de la fuente se ve algo achatado desde arriba: el radio, un poco por dentro
        if (tipo === 'repulgo') {
          const b = escena.obradorMarca('fuenteBorde');
          if (b) med.radio = Math.abs(b.x - m.x) * 0.92;
        }
        medida.current = med;
      } else if (r) {
        setPista({ x: r.width / 2, y: r.height * 0.42 });
        medida.current = { centro: { x: r.left + r.width / 2, y: r.top + r.height * 0.42 } };
      }
    };
    id = requestAnimationFrame(mira);
    return () => {
      vivo = false;
      cancelAnimationFrame(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, escena, alFogon]);
  // Pasado un rato sin hacer nada (en los niveles altos), la «!» aparece igualmente
  useEffect(() => {
    setParado(false);
    if (!tipo || ayudas !== 'auto' || (nivel ?? 1) <= AYUDA_NIVELES) return undefined;
    const id = setTimeout(() => setParado(true), AYUDA_PARADO_MS);
    return () => clearTimeout(id);
  }, [tipo, ayudas, nivel]);
  const ayuda = Boolean(tipo) && !pilarHace && verAyuda(ayudas, nivel, parado);

  // 1.144: «Que lo hornee Pilar»: cuando la cámara ya mira el objeto, sus manos hacen el gesto con su trazo, a ritmo de mano (el
  // reconocedor es el mismo que a mano, así que suena y se ve igual); después, al siguiente, y la pala al horno
  useEffect(() => {
    if (!pilarHace || !tipo || tipo === 'sacar' || !pista) return undefined;
    const r = reconocedor();
    if (!r) return undefined;
    const ancho = zona.current?.getBoundingClientRect().width || 390;
    const { puntos, ms } = trazoPilar(tipo, { escala: Math.min(ancho, 600) / 390, ...medida.current });
    let k = 0;
    let id = 0;
    const t0 = performance.now();
    const paso = (t) => {
      const hasta = Math.min(puntos.length - 1, Math.floor(((t - t0) / Math.max(1, ms)) * (puntos.length - 1)));
      while (k <= hasta && !fin.current) {
        const pt = puntos[k];
        // 1.145: con `alza`, levanta la mano antes (un toque nuevo, otro empujón u otro huevo)
        if (pt.alza) {
          aplicar(r.arriba());
          aplicar(r.abajo(pt.x, pt.y));
        } else aplicar(k === 0 ? r.abajo(pt.x, pt.y) : r.mover(pt.x, pt.y));
        k += 1;
      }
      if (fin.current) return;
      if (k >= puntos.length) {
        aplicar(r.completar());
        return;
      }
      id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
    // Una vez por gesto, cuando ya se sabe dónde está su objeto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pilarHace, tipo, pista]);

  function reiniciar() {
    rec.current = null;
    fin.current = false;
    setG(null);
  }

  /** La pala ya dentro: el servidor apunta la hornada (con las estrellas de los dos gestos; si la hace Pilar, bien hecha). */
  const alHorno = (id = receta, conPilar = pilarHace) => {
    setOcupado(true);
    sfx.play(recetaObrador(id)?.fogon ? 'chisporroteo' : 'horno');
    (conPilar ? hornearPilar(id) : hornear(id, mimo.current))
      .then(
        (r) => {
          onObrador?.(r.obrador);
          setDado({ ...r.dado, pilar: conPilar });
          setBandeja(r.dado.bandeja);
          setAhora(Date.now());
          reiniciar();
          setFase('horneando');
        },
        (e) => {
          setError(errorCafe(e));
          reiniciar();
          setFase('recetario');
        },
      )
      .finally(() => {
        setOcupado(false);
        setPilarHace(false);
      });
  };
  /** 1.145: el pan amasado, al cesto y a la bodega (con cómo quedó el amasado). Mañana se greña. */
  const aLaBodega = (m) => {
    setOcupado(true);
    reposarMasa(m)
      .then(
        (r) => {
          onObrador?.(r.obrador);
          sfx.play('cesto');
          reiniciar();
          setFase('reposa');
        },
        (e) => {
          setError(errorCafe(e));
          reiniciar();
          setFase('recetario');
        },
      )
      .finally(() => {
        setOcupado(false);
        setPilarHace(false);
      });
  };
  /** La pala ya fuera: Pilar la lleva a la vitrina (lo que no cabe, espera en la bandeja). */
  const fuera = () => {
    setOcupado(true);
    sacarHornada(bandeja)
      .then(
        (r) => {
          onObrador?.(r.obrador);
          setSacado(r.dado);
          if (r.dado.sacadas > 0) sfx.play('vitrina');
          reiniciar();
          setFase('hecho');
        },
        (e) => {
          setError(errorCafe(e));
          reiniciar();
          setFase('recetario');
        },
      )
      .finally(() => setOcupado(false));
  };
  const aplicar = (s) => {
    setG(s);
    if (fin.current) return;
    for (const ev of s.eventos) {
      if (SONIDO[ev]) sfx.play(SONIDO[ev]);
      else if (CONTADOS[ev]) sfx.play(CONTADOS[ev], s.progreso * 24);
      else if (ev === 'pellizco') sfx.play('pellizco', s.pose?.hechos?.filter(Boolean).length ?? 0);
      else if (ev === 'toca' && (s.tipo === 'meter' || s.tipo === 'sacar')) sfx.play(alFogon ? 'sarten' : 'pala');
    }
    if (!s.hecho) return;
    fin.current = true;
    if (s.tipo === 'meter') return alHorno();
    if (s.tipo === 'sacar') {
      sfx.play(alFogon ? 'sarten' : 'pala');
      return fuera();
    }
    // Un gesto de la receta: cómo ha quedado, y al siguiente (si lo hace Pilar, sin comentarios y enseguida)
    sfx.play('obradorHecho');
    const m = s.mimo ?? 2;
    mimo.current = [...mimo.current, m];
    // 1.145: el pan, amasado hoy, se queda a dormir en la bodega (se greña mañana)
    const siguiente = () => {
      if (paso === 0 && recetaObrador(receta)?.noche) return aLaBodega(m);
      reiniciar();
      if (paso === 0) setPaso(1);
      else setFase('meter');
    };
    if (pilarHace) {
      despues(siguiente, PAUSA_PILAR_MS);
      return;
    }
    const def = GESTO_OBRADOR[s.tipo];
    setComentario({ bien: m === 2, texto: m === 2 ? def.bien : def.mejor });
    despues(
      () => {
        setComentario(null);
        siguiente();
      },
      reduced() ? 400 : PAUSA_MS,
    );
  };
  const reconocedor = () => {
    if (!rec.current && tipo) {
      const ancho = zona.current?.getBoundingClientRect().width || 390;
      rec.current = crearGestoObrador(tipo, { escala: Math.min(ancho, 600) / 390, ...medida.current });
    }
    return rec.current;
  };
  const completar = () => {
    if (!tipo || fin.current || ocupado || pilarHace) return;
    const r = reconocedor();
    if (r) aplicar(r.completar());
  };
  const onDown = (e) => {
    if (!tipo || fin.current || ocupado || pilarHace) return;
    e.preventDefault();
    if (reduced()) return completar();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const r = reconocedor();
    if (r) aplicar(r.abajo(e.clientX, e.clientY));
  };
  const onMove = (e) => {
    const r = rec.current;
    if (!r || !r.estado.pulsado) return;
    aplicar(r.mover(e.clientX, e.clientY));
  };
  const onUp = () => {
    const r = rec.current;
    if (!r || !r.estado.pulsado) return;
    aplicar(r.arriba());
  };

  // El recetario
  const libre = bandejaLibre(obrador);
  const tope = (obrador?.hornadasHoy ?? 0) >= TOPE_HORNADAS;
  /** 1.145: el pan, según su masa: sin masa, se amasa (no hace falta horno); dormida, a esperar; subida, se greña y al horno. */
  const masa = obrador?.masa ?? null;
  const fasePan = !masa ? 'amasar' : masa.lista ? 'grenar' : 'reposa';
  const puedeElegir = (id) => {
    if (!recetaAbierta(id, nivel) || ocupado) return false;
    if (recetaObrador(id)?.noche && fasePan === 'amasar') return true;
    if (recetaObrador(id)?.noche && fasePan === 'reposa') return false;
    return Boolean(libre) && !tope;
  };
  const elegir = (id, conPilar = false) => {
    if (!puedeElegir(id)) return;
    sfx.play('fichaReceta');
    setError('');
    setDicho(null);
    setPilarHace(conPilar);
    setReceta(id);
    const grena = Boolean(recetaObrador(id)?.noche) && fasePan === 'grenar';
    setPaso(grena ? 1 : 0);
    // Del pan, el amasado ya está guardado con la masa (el servidor usa el suyo)
    mimo.current = grena ? [2] : [];
    setComentario(null);
    setDado(null);
    setSacado(null);
    reiniciar();
    // Pilar con movimiento reducido: de una vez, sin gestos
    if (conPilar && reduced()) return recetaObrador(id)?.noche && !grena ? aLaBodega(2) : alHorno(id, true);
    setFase('gesto');
  };
  const abrirRecetario = () => {
    sfx.play('recetario');
    setError('');
    setPilarHace(false);
    reiniciar();
    setFase('recetario');
  };
  const hojear = (k) => {
    const el = hojas.current;
    const n = Math.max(0, Math.min(paginasDe(obrador) - 1, k));
    if (!el) return;
    el.scrollTo({ left: n * el.clientWidth, behavior: reduced() ? 'auto' : 'smooth' });
  };
  const alHojear = () => {
    const el = hojas.current;
    if (!el || !el.clientWidth) return;
    const k = Math.round(el.scrollLeft / el.clientWidth);
    if (k !== pagina) {
      setPagina(k);
      sfx.play('fichaReceta');
    }
  };
  // Al abrir el recetario, por la primera página que se puede hornear (1.145: si la masa del pan ha subido, por el pan). Solo al
  // cambiar de fase
  useEffect(() => {
    if (fase !== 'recetario') return;
    const k = obrador?.masa?.lista && recetaAbierta('pan', nivel) ? RECETAS_OBRADOR.findIndex((r) => r.id === 'pan') : Math.max(0, RECETAS_OBRADOR.findIndex((r) => HORNABLES.includes(r.id)));
    const el = hojas.current;
    if (el) el.scrollLeft = k * el.clientWidth;
    setPagina(k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  const enElHorno = horneando.find((h) => h.bandeja === bandeja) ?? horneando[0] ?? null;
  const hornoAhora = enElHorno ? estadoHorno(enElHorno, ahora) : null;
  const vitrina = enVitrina(obrador);
  const PAGINAS = paginasDe(obrador);
  const recetaInfo = (id) => obrador?.recetas?.[id] ?? { buenas: 0, maestria: 0 };
  /** Comprar el grado siguiente del horno o de la vitrina (con granos, una vez). */
  const mejorar = (m) => {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    mejorarObrador(m, dia)
      .then(
        (r) => {
          onObrador?.(r.obrador);
          onCafe?.(r.cafe, r.cobrado);
          sfx.play('mejora');
          setDicho(r.cobrado?.piezas > 0 ? `${PILAR_MEJORAS[m]} ${fraseMostrador(r.cobrado.vendidas)}` : PILAR_MEJORAS[m]);
        },
        (e) => setError(errorCafe(e)),
      )
      .finally(() => setOcupado(false));
  };

  if (fase === 'recetario') {
    const cabecera = dicho
      ? dicho
      : tope
      ? PILAR_OBRADOR.tope
      : listo
        ? PILAR_OBRADOR.listo
        : enElHorno
          ? `${recetaObrador(enElHorno.receta)?.fogon ? 'En el fogón' : 'En el horno'}, ${recetaObrador(enElHorno.receta)?.nombre.toLowerCase()}: ${fraseHorno(hornoAhora.t).replace(/[«»]/g, '')}`
          : obrador?.masa?.lista && recetaAbierta('pan', nivel)
            ? MASA.recetario
            : 'El horno está encendido y la mesa, recogida.';
    return (
      <div className="cf3-balda cf3-recetario" role="region" aria-label="El recetario de doña Amparo">
        <div className="cf3-recetario__cabeza">
          <span className="cf3-recetario__tapa" aria-hidden="true" />
          <div className="cf3-recetario__titulos">
            <h2 className="cf3-recetario__titulo">El recetario de doña Amparo</h2>
            <p className="cf3-recetario__estado" aria-live="polite">
              {cabecera}
            </p>
            <p className="cf3-recetario__vitrina">
              En la vitrina: {vitrina} de {obrador?.cabe ?? 12}
            </p>
          </div>
        </div>
        <ol className="cf3-recetario__hojas" ref={hojas} onScroll={alHojear} aria-label="Las recetas">
          {RECETAS_OBRADOR.map((r, k) => {
            const abierta = recetaAbierta(r.id, nivel);
            const pronto = !abierta && nivel >= r.nivel;
            const { buenas, maestria } = recetaInfo(r.id);
            const faltan = faltanMaestria(buenas);
            const esp = especialidad === r.id;
            return (
              <li
                key={r.id}
                className="cf3-papeleta"
                data-abierta={abierta ? 'true' : undefined}
                data-tipo={r.tipo}
                data-especialidad={abierta && esp ? 'true' : undefined}
                data-maestria={abierta ? maestria : undefined}
                aria-label={`Página ${k + 1} de ${PAGINAS}: ${r.nombre}`}
              >
                <span className="cf3-papeleta__pinza" aria-hidden="true" />
                <div className="cf3-papeleta__arriba">
                  <p className="cf3-papeleta__tipo">{r.tipo === 'dulce' ? 'Dulce' : 'Salado'}</p>
                  {abierta && esp && <p className="cf3-papeleta__especial">Especialidad de hoy</p>}
                </div>
                <h3 className="cf3-papeleta__nombre">{r.nombre}</h3>
                {abierta ? (
                  <>
                    <p className="cf3-papeleta__nota">«{r.nota}»</p>
                    <ul className="cf3-papeleta__datos">
                      <li>
                        Salen de {piezasDe(r.id, 1, buenas)} a {nombrePiezas(r.id, piezasDe(r.id, 3, buenas))}
                      </li>
                      <li>{precioMesa(r.id, { especialidad, buenas })} granos cada una en la mesa</li>
                      <li>{(r.gestos ?? []).map((x, k) => (k ? GESTO_OBRADOR[x]?.atajo.toLowerCase() : GESTO_OBRADOR[x]?.atajo)).join(' y ')}</li>
                      <li>{COMO[r.id] ?? HORNO[r.segundos] ?? 'Al horno'}</li>
                    </ul>
                    {r.noche && masa && (
                      <p className="cf3-papeleta__masa" data-lista={masa.lista ? 'true' : undefined}>
                        {masa.lista ? MASA.lista : MASA.esperando}
                      </p>
                    )}
                    <div className="cf3-papeleta__maestria">
                      <Maestria n={maestria} />
                      <span>{faltan == null ? 'Pilar la hace de memoria.' : `${faltan === 1 ? 'Una hornada buena más' : `${faltan} hornadas buenas más`}: ${PREMIO_MAESTRIA[maestria].toLowerCase()}.`}</span>
                    </div>
                    <div className="cf3-papeleta__botones">
                      {maestria >= 3 && !(r.noche && fasePan === 'reposa') && (
                        <button type="button" className="cf3-btn cf3-btn--suave cf3-papeleta__pilar" disabled={!puedeElegir(r.id)} onClick={() => elegir(r.id, true)}>
                          {r.noche && fasePan === 'amasar' ? 'Que lo amase Pilar' : 'Que lo hornee Pilar'}
                        </button>
                      )}
                      <button type="button" className="cf3-btn cf3-btn--verde cf3-papeleta__hornear" disabled={!puedeElegir(r.id)} onClick={() => elegir(r.id)}>
                        {r.noche && fasePan === 'amasar'
                          ? 'Amasar'
                          : r.noche && fasePan === 'reposa'
                            ? MASA.boton
                            : tope
                              ? 'Mañana, más'
                              : !libre
                                ? 'El horno está ocupado'
                                : r.noche
                                  ? 'Greñar y hornear'
                                  : r.fogon
                                    ? 'Al fogón'
                                    : 'Hornear'}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="cf3-papeleta__cerrada">{pronto ? 'Doña Amparo la dejó a medio escribir.' : `Se abre en el nivel ${r.nivel}.`}</p>
                )}
              </li>
            );
          })}
          {obrador?.conMejoras && (
          <li className="cf3-papeleta cf3-papeleta--obrador" data-abierta="true" aria-label={`Página ${PAGINAS} de ${PAGINAS}: el obrador`}>
            <span className="cf3-papeleta__pinza" aria-hidden="true" />
            <div className="cf3-papeleta__arriba">
              <p className="cf3-papeleta__tipo">El obrador</p>
              <p className="cf3-papeleta__granos">{granos} granos</p>
            </div>
            <h3 className="cf3-papeleta__nombre">Mejoras de la tahona</h3>
            {['horno', 'vitrina'].map((m) => {
              const grado = obrador?.[m] ?? 1;
              const ahoraM = MEJORAS_OBRADOR[m].find((x) => x.grado === grado) ?? MEJORAS_OBRADOR[m][0];
              const sig = siguienteMejora(m, grado);
              const falta = sig ? sig.precio - granos : 0;
              return (
                <div key={m} className="cf3-mejora" data-mejora={m}>
                  <span className="cf3-mejora__icono" aria-hidden="true" />
                  <div className="cf3-mejora__texto">
                    <p className="cf3-mejora__ahora">
                      {m === 'horno' ? 'El horno' : 'La vitrina'}: <b>{ahoraM.nombre}</b>
                      <span className="cf3-mejora__grados" role="img" aria-label={`Grado ${grado} de ${MEJORAS_OBRADOR[m].length}`}>
                        {MEJORAS_OBRADOR[m].map((x) => (
                          <span key={x.grado} data-hecho={x.grado <= grado ? 'true' : undefined} aria-hidden="true" />
                        ))}
                      </span>
                    </p>
                    <p className="cf3-mejora__se">{ahoraM.se}</p>
                    {sig ? (
                      <p className="cf3-mejora__sig">
                        Después, <b>{sig.nombre.toLowerCase()}</b>: {sig.se.charAt(0).toLowerCase() + sig.se.slice(1)}.
                      </p>
                    ) : (
                      <p className="cf3-mejora__sig">Ya no se puede mejorar más.</p>
                    )}
                  </div>
                  {sig && (
                    <button type="button" className="cf3-btn cf3-btn--verde cf3-mejora__btn" disabled={ocupado || nivel < sig.nivel || falta > 0} onClick={() => mejorar(m)}>
                      {nivel < sig.nivel ? `En el nivel ${sig.nivel}` : falta > 0 ? `Faltan ${falta} granos` : `Mejorar · ${sig.precio} granos`}
                    </button>
                  )}
                </div>
              );
            })}
            <p className="cf3-papeleta__nota">
              {(obrador?.tartas ?? 0) > 0
                ? `Vitrinas de tartas en el café: ${obrador.tartas} de ${TARTAS.max} (+${TARTAS.huecos} huecos cada una).`
                : `Cada vitrina de tartas que pongas en el café (en Decorar) suma ${TARTAS.huecos} huecos, hasta ${TARTAS.max}.`}
            </p>
            {/* 1.145: los hitos del obrador, por piezas vendidas en total, con su adorno */}
            <div className="cf3-hitos" aria-label="Los hitos del obrador">
              <p className="cf3-hitos__titulo">
                Vendidas: <b>{obrador?.vendidasTotal ?? 0}</b>
                {faltanHito(obrador?.vendidasTotal ?? 0) != null && <span> · faltan {faltanHito(obrador?.vendidasTotal ?? 0)} para el siguiente</span>}
              </p>
              <ol className="cf3-hitos__lista">
                {HITOS_OBRADOR.cifras.map((n, k) => (
                  <li key={n} className="cf3-hito" data-hecho={(obrador?.hitos ?? 0) > k ? 'true' : undefined}>
                    <span className="cf3-hito__marca" aria-hidden="true" />
                    <span className="cf3-hito__cifra">{n.toLocaleString('es-ES')}</span>
                    <span className="cf3-hito__adorno">{HITOS_OBRADOR.adornos[k]}</span>
                    <span className="cf3-hito__granos">+{HITOS_OBRADOR.granos}</span>
                    <span className="px-sr">{(obrador?.hitos ?? 0) > k ? ', conseguido' : ', por conseguir'}</span>
                  </li>
                ))}
              </ol>
            </div>
            <ul className="cf3-papeleta__datos cf3-papeleta__dado" aria-label="Lo que te ha dado">
              <li>En la vitrina caben {obrador?.cabe ?? 12}</li>
              <li>Pilar vende {obrador?.cupo ?? 4} al día en el mostrador</li>
              {(obrador?.mostrador?.piezas ?? 0) > 0 && (
                <li>
                  Ha vendido {obrador.mostrador.piezas} por {obrador.mostrador.granos} granos
                </li>
              )}
              {(obrador?.dado?.horno ?? 0) > 0 && <li>{obrador.dado.horno} hornadas a la vez gracias al horno</li>}
              {(obrador?.dado?.pilar ?? 0) > 0 && <li>{obrador.dado.pilar} hornadas de Pilar</li>}
            </ul>
          </li>
          )}
        </ol>
        <div className="cf3-recetario__pie">
          <button type="button" className="cf3-btn cf3-btn--suave cf3-recetario__flecha" onClick={() => hojear(pagina - 1)} disabled={pagina <= 0} aria-label="Página anterior">
            ‹
          </button>
          <span className="cf3-recetario__pagina" aria-hidden="true">
            {pagina + 1} / {PAGINAS}
          </span>
          <button type="button" className="cf3-btn cf3-btn--suave cf3-recetario__flecha" onClick={() => hojear(pagina + 1)} disabled={pagina >= PAGINAS - 1} aria-label="Página siguiente">
            ›
          </button>
          <span className="cf3-recetario__hueco" />
          {listo && (
            <button
              type="button"
              className="cf3-btn cf3-btn--verde"
              onClick={() => {
                const h = horneando.find((x) => estadoHorno(x, Date.now()).listo);
                if (!h) return;
                setBandeja(h.bandeja);
                reiniciar();
                setFase('sacar');
              }}
            >
              Sacar la hornada
            </button>
          )}
          {!listo && enElHorno && (
            <button
              type="button"
              className="cf3-btn cf3-btn--suave"
              onClick={() => {
                setBandeja(enElHorno.bandeja);
                setFase('horneando');
              }}
            >
              Mirar el horno
            </button>
          )}
          <button type="button" className="cf3-btn cf3-btn--suave" onClick={onCerrar} data-atras>
            Volver
          </button>
        </div>
        {error && (
          <p className="cf3-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  const def = tipo === 'meter' || tipo === 'sacar' ? palaDe(recetaAhora)[tipo] : tipo ? GESTO_OBRADOR[tipo] : null;
  const progreso = Math.round((g?.progreso ?? 0) * 100);
  const r = recetaObrador(fase === 'sacar' || fase === 'horneando' ? (enElHorno?.receta ?? receta) : receta);
  const conGesto = Boolean(tipo) && !comentario && !pilarHace;
  let texto;
  if (fase === 'abriendo') texto = error || '«Espera, que esta pared suena a hueco…»';
  else if (fase === 'descubre') texto = PILAR_OBRADOR.descubre[linea];
  else if (comentario) texto = comentario.texto;
  else if (pilarHace && (fase === 'gesto' || fase === 'meter')) texto = fase === 'meter' ? PILAR_MEJORAS.horneaHecho : PILAR_MEJORAS.hornea;
  else if (fase === 'reposa') texto = MASA.reposa;
  else if (fase === 'horneando') texto = dado?.pilar && (hornoAhora?.t ?? 1) < 0.34 ? PILAR_MEJORAS.horneaHecho : hornoAhora ? fraseHorno(hornoAhora.t) : '';
  else if (fase === 'hecho')
    texto = sacado
      ? sacado.quedan > 0
        ? `${sacado.sacadas ? PILAR_OBRADOR.alVitrina(sacado.sacadas) + ' ' : ''}${PILAR_OBRADOR.vitrinaLlena}`
        : PILAR_OBRADOR.alVitrina(sacado.sacadas)
      : '';
  else if (fase === 'sacar' && !g?.progreso) texto = `${PILAR_OBRADOR.listo} ${def.orden}.`;
  else if (def) texto = reduced() ? `${def.orden}. Un toque basta.` : `${def.orden}.`;
  const quien =
    pilarHace && (fase === 'gesto' || fase === 'meter')
      ? 'Pilar'
      : fase === 'gesto'
        ? r?.nombre
        : fase === 'meter' || fase === 'horneando' || fase === 'sacar'
          ? alFogon
            ? 'El fogón'
            : 'El horno'
          : 'Pilar';
  const dicePilar = !conGesto;

  return (
    <>
      <div
        ref={zona}
        className="cf3-gesto"
        data-activo={conGesto ? 'true' : undefined}
        data-gesto={conGesto ? tipo : undefined}
        role={conGesto ? 'button' : undefined}
        tabIndex={conGesto ? 0 : -1}
        aria-hidden={conGesto ? undefined : 'true'}
        aria-label={conGesto ? `${def.orden}. Con el teclado, Intro lo hace de una vez.` : undefined}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onLostPointerCapture={onUp}
        onKeyDown={(e) => {
          if (conGesto && (e.key === 'Enter' || e.key === ' ') && !e.repeat) {
            e.preventDefault();
            completar();
          }
        }}
      >
        {ayuda && conGesto && pista && !(g?.progreso > 0) && <span className="cf3-ayuda cf3-ayuda--gesto" data-para={MARCA[tipo]} style={{ left: `${pista.x}px`, top: `${pista.y}px` }} aria-hidden="true" />}
        {conGesto && pista && !(g?.progreso > 0) && (
          <span className="cf3-gesto__pista" style={{ left: `${pista.x}px`, top: `${pista.y}px` }}>
            <Pista trazo={PISTA[tipo]} />
          </span>
        )}
        {conGesto && pista && !(g?.progreso > 0) && !reduced() && (
          <span className="cf3-gesto__nota" data-lado={ladoNota(pista.x, zona.current?.clientWidth ?? 390)} style={{ left: `${pista.x}px`, top: `${pista.y}px` }} aria-hidden="true">
            {def.ayuda}
          </span>
        )}
        {comentario && (
          <span className="cf3-gesto__hecho" data-mimo={comentario.bien ? 'bien' : 'mejor'} aria-hidden="true">
            {comentario.bien ? '¡Bien!' : 'Hecho'}
          </span>
        )}
        {fase === 'hecho' && sacado?.sacadas > 0 && (
          <span className="cf3-gesto__hecho" aria-hidden="true">
            +{sacado.sacadas} a la vitrina
          </span>
        )}
      </div>
      <div
        className="cf3-franja cf3-franja--atender cf3-franja--barra cf3-franja--obrador"
        role="region"
        aria-label="El obrador"
        data-fase={fase}
        data-gesto={tipo ?? undefined}
        data-progreso={conGesto ? progreso : undefined}
        data-ayuda={ayuda ? 'true' : undefined}
      >
        <span className="cf3-quien" aria-hidden="true">
          {quien}
        </span>
        <div className="cf3-caja">
          <span className="cf3-retrato">
            <PixelArt icono={PILAR} />
          </span>
          <p className="cf3-dice" aria-live="polite">
            {dicePilar && <span className="px-sr">Pilar: </span>}
            {texto}
            {conGesto && <span className="px-sr"> {def.ayuda}</span>}
          </p>
          {fase === 'gesto' && r && (
            <p className="cf3-obrador__paso" aria-hidden="true">
              {r.nombre} · {r.noche ? (paso === 0 ? 'hoy, amasar' : 'hoy, greñar') : `${paso + 1} de 2`}
            </p>
          )}
          {(fase === 'horneando' || fase === 'hecho') && (dado || sacado) && (
            <div className="cf3-obrador__hornada">
              <Estrellas n={(fase === 'hecho' ? sacado?.estrellas : dado?.estrellas) ?? 1} />
              <span>
                {fase === 'hecho' && sacado
                  ? sacado.quedan > 0
                    ? `${nombrePiezas(sacado.receta, sacado.quedan)} esperan en la bandeja`
                    : `${nombrePiezas(sacado.receta, sacado.sacadas)}, a la vitrina`
                  : `Saldrán ${nombrePiezas(receta, dado?.piezas ?? piezasDe(receta, dado?.estrellas ?? 1))}`}
              </span>
            </div>
          )}
          {conGesto && (
            <div className="cf3-extra">
              <div className="cf3-medidor" role="progressbar" aria-label={def.orden} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progreso}>
                <span className="cf3-medidor__lleno" style={{ width: `${progreso}%` }} />
              </div>
            </div>
          )}
          {error && fase !== 'abriendo' && (
            <p className="cf3-error" role="alert">
              {error}
            </p>
          )}
          <div className="cf3-botones">
            {fase === 'abriendo' && error && (
              <button type="button" className="cf3-btn cf3-btn--suave" onClick={onCerrar} data-atras>
                Volver
              </button>
            )}
            {fase === 'descubre' && linea === 0 && (
              <button type="button" className="cf3-btn cf3-btn--verde" onClick={() => setLinea(1)}>
                Seguir
              </button>
            )}
            {fase === 'descubre' && linea === 1 && (
              <button type="button" className="cf3-btn cf3-btn--verde" onClick={abrirRecetario}>
                Abrir el recetario
              </button>
            )}
            {(fase === 'gesto' || fase === 'meter') && !comentario && !ocupado && !pilarHace && (
              <button type="button" className="cf3-btn cf3-btn--suave" onClick={abrirRecetario}>
                Otra receta
              </button>
            )}
            {fase === 'reposa' && (
              <>
                <button type="button" className="cf3-btn cf3-btn--suave" onClick={abrirRecetario}>
                  Al recetario
                </button>
                <button type="button" className="cf3-btn cf3-btn--verde" onClick={onCerrar} data-atras>
                  Volver al café
                </button>
              </>
            )}
            {fase === 'horneando' && (
              <>
                <button type="button" className="cf3-btn cf3-btn--suave" onClick={abrirRecetario}>
                  Al recetario
                </button>
                <button type="button" className="cf3-btn cf3-btn--verde" onClick={onCerrar} data-atras>
                  Volver al café
                </button>
              </>
            )}
            {fase === 'sacar' && !ocupado && (
              <button type="button" className="cf3-btn cf3-btn--suave" onClick={onCerrar} data-atras>
                Luego
              </button>
            )}
            {fase === 'hecho' && (
              <>
                <button type="button" className="cf3-btn cf3-btn--suave" onClick={onCerrar} data-atras>
                  Volver
                </button>
                <button type="button" className="cf3-btn cf3-btn--verde" onClick={abrirRecetario}>
                  Otra hornada
                </button>
              </>
            )}
            {conGesto && reduced() && (
              <button type="button" className="cf3-btn cf3-btn--verde" onClick={completar} disabled={ocupado}>
                {def.atajo}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
