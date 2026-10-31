-- 1.60 (SPEC §60): seis avatares nuevos (retratos mediterráneos). El perfil sigue guardando solo el `id` de un catálogo
-- cerrado: se amplía la lista admitida, nada más. No toca filas ni permisos (RLS sin cambios).
-- La restricción original es la de la columna (`profiles_avatar_id_check`, nombre por defecto de Postgres).
alter table public.profiles drop constraint if exists profiles_avatar_id_check;
alter table public.profiles add constraint profiles_avatar_id_check check (
  avatar_id in (
    'lectora-cafe', 'lector-chaleco', 'viajera-pelirroja', 'lector-farol', 'gato-lector', 'vidente-estrellas',
    'guardiana-farol', 'lectora-botanica', 'encuadernador-bruma', 'lectora-mapas', 'zorro-lector', 'lectora-marina'
  )
);
