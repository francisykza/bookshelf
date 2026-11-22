// 1.141 (§141): el café de otro lector, para pasear y mirar (Francisco, 16-11-2026, «Pasear y mirar»). La misma escena 3D que
// el tuyo, en solo lectura: su decoración, su nivel, su escaparate, la estantería con sus secciones (de sus leídos, solo lomos sin
// título) y las fotos de sus influencers. Se anda tocando el suelo y se baja a la bodega; nada se puede tocar ni comprar.
import { useEffect, useMemo, useRef, useState } from 'react';
import { FOGON_NIVEL } from './cafeObrador';
import { cargarVisitaCafe } from './cafeService';
import { baldaDeVisita } from './cafeSocial';
import { usePortadasBalda } from './usePortadasBalda';
import { crearCafeMusica } from './cafeMusica';
import { crearSfxBarra } from './cafeSfx';
import { sceneMusicOut, setMusicBlocked } from '../../../audio/audioController';
import { PantallaCarga } from '../../../ui/PantallaCarga';
import './cafe.css';
import './cafeSocial.css';

export default function VisitaCafe({ visita, soundOn = false }) {
  const host = useRef(null);
  const api = useRef(null);
  const [ready, setReady] = useState(false);
  const [sin3d, setSin3d] = useState(false);
  // undefined: cargando; null: no se puede ver (ya no es vecino, bloqueo, comunidad apagada…)
  const [cafe, setCafe] = useState(undefined);
  const [sfx] = useState(() => crearSfxBarra());
  useEffect(() => sfx.setActivo(soundOn), [sfx, soundOn]);

  useEffect(() => {
    let vivo = true;
    cargarVisitaCafe(visita.userId).then(
      (c) => vivo && setCafe(c),
      () => vivo && setCafe(null),
    );
    return () => {
      vivo = false;
    };
  }, [visita.userId]);

  // La música del café, como en el tuyo (nunca antes de un gesto)
  useEffect(() => {
    if (!soundOn) return undefined;
    setMusicBlocked('cafe', true);
    const m = crearCafeMusica(sceneMusicOut);
    const intentar = () => {
      if (m.arrancar()) window.removeEventListener('pointerdown', intentar, true);
    };
    if (!m.arrancar()) window.addEventListener('pointerdown', intentar, true);
    return () => {
      window.removeEventListener('pointerdown', intentar, true);
      m.parar();
      setMusicBlocked('cafe', false);
    };
  }, [soundOn]);

  useEffect(() => {
    let alive = true;
    let mounted = null;
    import('./cafe3d')
      .then(({ mountCafe }) => {
        if (!alive || !host.current) return;
        try {
          mounted = mountCafe(host.current, {
            // Solo se puede bajar a la bodega y subir: lo demás es de su dueño
            onPick: (id) => {
              if (id === 'trampilla' || id === 'subir') mounted?.go(id);
            },
            onLost: () => alive && setSin3d(true),
            onSonido: (nombre, datos) => sfx.play(nombre, datos),
          });
        } catch {
          setSin3d(true);
          return;
        }
        api.current = mounted;
        if (import.meta.env.DEV) window.__cafe3d = mounted;
        setReady(true);
      })
      .catch(() => alive && setSin3d(true));
    return () => {
      alive = false;
      mounted?.destroy();
      api.current = null;
      if (import.meta.env.DEV && window.__cafe3d === mounted) window.__cafe3d = null;
    };
  }, [sfx]);

  const balda = useMemo(() => baldaDeVisita(cafe?.libros ?? []), [cafe]);
  const portadasBalda = usePortadasBalda(balda);
  useEffect(() => {
    if (!ready || !cafe) return;
    api.current?.setLocal({
      inaugurado: true,
      nombre: cafe.nombre,
      plano: cafe.plano,
      libros: [],
      cajas: 0,
      vacias: true,
      nivel: cafe.nivel,
      escaparate: cafe.escaparate.map((b) => b.titulo),
      portadas: [],
      balda,
      decor: balda.filter((b) => !b.tuyo).map((b) => b.title),
      portadasBalda,
    });
    api.current?.setFotos(cafe.fotos);
    // 1.145: su obrador, para mirarlo (solo mirar): el horno con su grado, la vitrina con lo que haya y los adornos de los hitos
    if (cafe.obrador) {
      api.current?.setObrador?.({ abierto: true, horneando: [], listo: false, horno: cafe.obrador.horno, hitos: cafe.obrador.hitos, fogon: cafe.nivel >= FOGON_NIVEL });
      api.current?.setVitrina?.({ piezas: cafe.obrador.piezas, grado: cafe.obrador.vitrina, hitos: cafe.obrador.hitos });
    }
  }, [ready, cafe, balda, portadasBalda]);

  if (cafe === null)
    return (
      <div className="cf3" data-ready="true" data-visita="true">
        <p className="cf3-visita__pie" role="alert">
          Ahora no se puede visitar el café de {visita.alias}. Puede que ya no viváis en el mismo edificio o que haya cerrado la comunidad.
        </p>
      </div>
    );

  return (
    <div className="cf3" data-ready={(ready || sin3d) && cafe ? 'true' : undefined} data-visita="true" data-abierto="true">
      <div className="cf3-stage" ref={host} />
      {(!cafe || !(ready || sin3d)) && <PantallaCarga mensaje={`Entrando en ${visita.cafe}…`} />}
      {cafe && (
        <>
          <p className="cf3-visita__placa" aria-label={`${cafe.nombre}, el café de ${cafe.alias}: nivel ${cafe.nivel}, ${cafe.reputacion} de reputación`}>
            <span className="cf3-visita__nv" aria-hidden="true">
              <span>
                <small>NV</small>
                {cafe.nivel}
              </span>
            </span>
            <span className="cf3-visita__texto" aria-hidden="true">
              <span className="cf3-visita__nombre">{cafe.nombre}</span>
              <span className="cf3-visita__de">El café de {cafe.alias}</span>
            </span>
          </p>
          <p className="cf3-visita__pie">
            {sin3d
              ? `No se puede dibujar el café en este dispositivo. ${cafe.nombre} está en el nivel ${cafe.nivel}.`
              : `Estás de visita: pasea tocando el suelo y mira su estantería. Aquí no se toca nada.`}
          </p>
        </>
      )}
    </div>
  );
}
