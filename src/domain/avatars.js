// Catálogo de los avatares Gouache (SPEC §25.3; seis más en la 1.60, §60), el mismo que `public/avatars/catalog.json` y que la
// restricción `avatar_id` de `profiles`: el perfil guarda solo el `id`, nunca una imagen ni una URL del cliente.
import { asset } from '../scene/sceneMap';

const entry = (id, label, alt) => ({ id, label, image: asset(`avatars/${id}.webp`), alt });

export const AVATARS = [
  entry('lectora-cafe', 'Lectora con café', 'Retrato gouache de una lectora con gafas redondas y una taza humeante junto a la ventana'),
  entry('lector-chaleco', 'Lector del chaleco', 'Retrato gouache de un lector de pelo rizado con chaleco marrón y un libro abierto'),
  entry('viajera-pelirroja', 'Viajera pelirroja', 'Retrato gouache de una viajera pelirroja con trenza, pañuelo y auriculares'),
  entry('lector-farol', 'Lector del farol', 'Retrato gouache de un lector con barba y chaqueta de punto junto a un farol encendido'),
  entry('gato-lector', 'Gato lector', 'Retrato gouache de un gato atigrado con gafas apoyado sobre una pila de libros'),
  entry('vidente-estrellas', 'Vidente de las estrellas', 'Retrato gouache de una figura con capa azul estrellada que sostiene una carta con una luna'),
  // 1.60: segunda serie, retratos mediterráneos (necesitan la migración 20261031120000_avatares_nuevos.sql)
  entry('guardiana-farol', 'Guardiana del farol', 'Retrato gouache de una lectora de pelo rizado con bufanda mostaza y un farol encendido entre la bruma'),
  entry('lectora-botanica', 'Lectora botánica', 'Retrato gouache de una lectora de pelo rizado con un libro rojo y una rama de olivo; un dragón lejano sobre la bahía'),
  entry('encuadernador-bruma', 'Encuadernador de bruma', 'Retrato gouache de un encuadernador con barba, delantal de cuero y un libro verde junto al mar'),
  entry('lectora-mapas', 'Lectora de mapas', 'Retrato gouache de una persona con gafas redondas y chaleco que sostiene un mapa con la ruta de un dragón'),
  entry('zorro-lector', 'Zorro lector', 'Retrato gouache de un zorro con bufanda remendada que lee un libro abierto'),
  entry('lectora-marina', 'Lectora marina', 'Retrato gouache de una lectora de pelo gris con capa azul estrellada y un libro abierto entre la niebla'),
];

export const avatarById = (id) => AVATARS.find((a) => a.id === id) ?? null;
export const isAvatarId = (id) => AVATARS.some((a) => a.id === id);
