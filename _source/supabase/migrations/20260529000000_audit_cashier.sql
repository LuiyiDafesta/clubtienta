-- =====================================================================
-- CLUBTIENTA - MIGRACIÓN: AGREGAR RELACIÓN DE CAJERO A TRANSACCIONES
-- =====================================================================

-- Añadir restricción de llave foránea para que PostgREST pueda relacionar creado_por con profiles
alter table public.transacciones
  drop constraint if exists fk_transacciones_creado_por_profiles;

alter table public.transacciones
  add constraint fk_transacciones_creado_por_profiles
  foreign key (creado_por) references public.profiles(id) on delete set null;
