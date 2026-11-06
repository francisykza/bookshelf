// El escritorio del ordenador en el piso: los accesos ordenados como en el inventario de funciones
// (docs/qa/piso-funciones.md). Las pantallas son las de siempre; aquí solo se elige cuál abrir.
import { SectionIcon } from '../../components/SectionIcon';

const GROUPS = (open, tool, go) => [
  {
    title: 'Mi lectura',
    items: [
      { name: 'Mi diario', icon: 'diario', run: () => open('calendar', 'today') },
      { name: 'Calendario', icon: 'diario', run: () => open('calendar', 'calendar') },
      { name: 'Notas', icon: 'notas', run: () => open('calendar', 'notes') },
      { name: 'Sesiones', icon: 'sesiones', run: () => open('sessions') },
      { name: 'Temporizador', icon: 'sesiones', run: () => tool('tray') },
    ],
  },
  {
    title: 'Mi progreso',
    items: [
      { name: 'Estadísticas', icon: 'datos', run: () => open('stats') },
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

export function PisoDesktop({ open, tool, go }) {
  return (
    <div className="plab-desktop">
      {GROUPS(open, tool, go).map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h3>{group.title}</h3>
          <ul>
            {group.items.map((item) => (
              <li key={item.name}>
                <button type="button" onClick={item.run}>
                  {item.icon && <SectionIcon name={item.icon} size={28} />}
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
