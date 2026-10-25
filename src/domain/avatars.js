// Catálogo de los seis avatares Gouache (SPEC §25.3), el mismo que `public/avatars/catalog.json` y que la
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
];

export const avatarById = (id) => AVATARS.find((a) => a.id === id) ?? null;
export const isAvatarId = (id) => AVATARS.some((a) => a.id === id);
