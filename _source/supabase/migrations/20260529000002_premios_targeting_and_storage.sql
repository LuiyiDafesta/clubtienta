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
-- NOTA: Aseguramos que solo puedan escribir los usuarios autenticados (staff de Tienta)

-- Permitir lectura pública a cualquier usuario de internet
create policy "Acceso público de lectura a fotos"
  on storage.objects for select
  using (bucket_id = 'premios');

-- Permitir inserción de nuevas fotos por personal autenticado
create policy "Permitir carga de fotos a usuarios autenticados"
  on storage.objects for insert
  with check (bucket_id = 'premios' and auth.role() = 'authenticated');

-- Permitir actualización de fotos por personal autenticado
create policy "Permitir actualización de fotos a usuarios autenticados"
  on storage.objects for update
  using (bucket_id = 'premios' and auth.role() = 'authenticated');

-- Permitir eliminación de fotos por personal autenticado
create policy "Permitir eliminación de fotos a usuarios autenticados"
  on storage.objects for delete
  using (bucket_id = 'premios' and auth.role() = 'authenticated');
