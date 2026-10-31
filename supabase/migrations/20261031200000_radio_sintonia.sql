-- 1.62 (SPEC §62.3), preparada y SIN aplicar: «Mostrar mi sintonía en mi perfil» (opcional). Solo guarda el id público de
-- una sintonía del catálogo de la radio (nada de historial ni de lo que suena en cada momento). La escribe la propia
-- persona con la política de actualización de su perfil que ya existe; quien vea su perfil puede elegir reproducirla.
-- La opción no se enseña en la app hasta que esta migración esté aplicada en producción.
alter table public.profiles add column if not exists radio_station text;
alter table public.profiles drop constraint if exists profiles_radio_station_check;
alter table public.profiles add constraint profiles_radio_station_check check (radio_station is null or radio_station ~ '^[a-z0-9-]{1,40}$');
