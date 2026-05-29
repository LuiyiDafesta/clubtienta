-- =====================================================================
-- CLUBTIENTA - MIGRACIÓN: SEGMENTACIÓN DE PREMIOS POR NIVEL
-- =====================================================================

-- 1. Agregar columna de niveles aplicables a la tabla premios
alter table public.premios 
add column if not exists niveles_aplicables text[] default array['Gold', 'Platinum'];

-- 2. Asegurar que todos los premios existentes tengan configurado ambos niveles por defecto
update public.premios
set niveles_aplicables = array['Gold', 'Platinum']
where niveles_aplicables is null;
