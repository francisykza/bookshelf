// El escritorio del ordenador en el piso. Delante, lo que más se usa; el resto, por secciones. Están todas las funciones del
// inventario (docs/qa/piso-funciones.md). Las pantallas son las de siempre: aquí solo se elige cuál abrir.
import { useLayoutEffect, useRef } from 'react';
import { SectionIcon } from '../../components/SectionIcon';

const MAIN = (open) => [
  { name: 'Calendario', hint: 'Tus días de lectura', icon: 'diario', run: () => open('calendar', 'calendar') },
  { name: 'Mi diario', hint: 'Lo de hoy', icon: 'notas', run: () => open('calendar', 'today') },
  { name: 'Estadísticas', hint: 'Cuánto llevas', icon: 'datos', run: () => open('stats') },
];

const GROUPS = (open, tool, go) => [
  {
    title: 'Mi lectura',
    items: [
      { name: 'Notas', icon: 'notas', run: () => open('calendar', 'notes') },
      { name: 'Sesiones', icon: 'sesiones', run: () => open('sessions') },
      { name: 'Temporizador', icon: 'sesiones', run: () => tool('tray') },
    ],
  },
  {
    title: 'Mi progreso',
    items: [
      { name: 'Reto anual', icon: 'reto', run: () => open('goal') },
      { name: 'Misiones', icon: 'misiones', run: () => open('missions') },
      { name: 'Citas', icon: 'citas', run: () => open('quote') },
    ],
  },
  {
    title: 'Mis libros',
    items: [
      { name: 'Toda la biblioteca', icon: 'biblioteca', run: () => go.library() },
      { name: 'Añadir un libro', run: () => tool('add') },
      { name: 'Importar biblioteca', run: () => tool('import') },
      { name: 'Pedir recomendación', run: () => tool('librarian') },
      { name: 'Mapa de sagas', icon: 'sagas', run: () => tool('atlas') },
    ],
  },
  {
    title: 'Fuera del piso',
    items: [
      { name: 'Radio', run: () => tool('radio') },
      { name: 'Comunidad', icon: 'comunidad', run: () => go.community() },
      { name: 'Cuenta y copias', run: () => tool('account') },
    ],
  },
];

// Al cerrar una herramienta se vuelve a esta pantalla, que se ha desmontado: se recuerda por dónde ibas
const place = { scroll: 0, name: null };

export function PisoDesktop({ open, tool, go }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    el.scrollTop = place.scroll;
    if (place.name) [...el.querySelectorAll('button')].find((b) => b.dataset.name === place.name)?.focus({ preventScroll: true });
  }, []);
  const choose = (item) => {
    place.scroll = ref.current.scrollTop;
    place.name = item.name;
    item.run();
  };
  return (
    <div ref={ref} className="plab-desktop">
      <section className="plab-desktop__main" aria-label="Lo principal">
        <ul>
          {MAIN(open).map((item) => (
            <li key={item.name}>
              <button type="button" data-name={item.name} onClick={() => choose(item)}>
                <SectionIcon name={item.icon} size={40} />
                <strong>{item.name}</strong>
                <small>{item.hint}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {GROUPS(open, tool, go).map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h3>{group.title}</h3>
          <ul>
            {group.items.map((item) => (
              <li key={item.name}>
                <button type="button" data-name={item.name} onClick={() => choose(item)}>
                  {item.icon && <SectionIcon name={item.icon} size={24} />}
                  <span>{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
