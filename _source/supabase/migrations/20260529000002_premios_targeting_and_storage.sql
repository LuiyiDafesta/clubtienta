-- =====================================================================
-- CLUBTIENTA - MIGRACIÓN: SEGMENTACIÓN DE PREMIOS Y BUCKET DE FOTOS
-- =====================================================================

-- 1. Agregar columna de niveles aplicables a la tabla premios si no existe
alter table public.premios 
add column if not exists niveles_aplicables text[] default array['Gold', 'Platinum'];

-- 2. Asegurar que todos los premios existentes tengan configurado ambos niveles por defecto
update public.premios
set niveles_aplicables = array['Gold', 'Platinum']
where niveles_aplicables is null;

-- 3. Crear el bucket premios en storage
insert into storage.buckets (id, name, public)
values ('premios', 'premios', true)
on conflict (id) do nothing;

-- 4. Habilitar políticas de seguridad RLS en storage.objects para el bucket premios
-- NOTA: Usamos una política 'for all' para evitar conflictos con 'upsert: true' que requiere permisos de inserción, lectura y actualización atómicos.

-- Permitir acceso total (Lectura, Carga, Edición, Eliminación) pública sobre el bucket premios
create policy "Acceso total bucket premios"
  on storage.objects for all
  using (bucket_id = 'premios')
  with check (bucket_id = 'premios');


