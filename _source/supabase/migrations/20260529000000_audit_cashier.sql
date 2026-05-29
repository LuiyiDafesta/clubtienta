-- =====================================================================
-- CLUBTIENTA - MIGRACIÓN: AUDITORÍA Y REGISTRO DE OPERADORES
-- =====================================================================

-- 1. Añadir restricción de llave foránea para que PostgREST pueda relacionar creado_por con profiles
alter table public.transacciones
  drop constraint if exists fk_transacciones_creado_por_profiles;

alter table public.transacciones
  add constraint fk_transacciones_creado_por_profiles
  foreign key (creado_por) references public.profiles(id) on delete set null;

-- 2. Hacer que el DNI sea nullable en profiles (para administradores y operadores/cajeros)
alter table public.profiles alter column dni drop not null;

-- 3. Agregar columna rol a profiles
alter table public.profiles add column if not exists rol text not null default 'client' check (rol in ('client', 'cajero', 'admin'));

-- 4. Sincronizar roles existentes en la tabla profiles
update public.profiles set rol = 'admin' where email = 'lsnetinformatica2024@gmail.com';
update public.profiles set rol = 'client' where email = 'sturzels00@gmail.com';

-- 5. Crear políticas explícitas de inserción de perfiles para administradores
drop policy if exists "Admins pueden insertar perfiles" on public.profiles;
create policy "Admins pueden insertar perfiles"
    on public.profiles for insert
    with check (
        auth.jwt()->'app_metadata'->>'role' = 'admin'
    );

-- 6. Función segura para que administradores eleven roles de otros usuarios en Supabase Auth
create or replace function public.establecer_rol_usuario(
    p_usuario_id uuid,
    p_rol text
)
returns void as $$
begin
    -- Validar que el llamador sea administrador en auth.users
    if coalesce((auth.jwt()->'app_metadata'->>'role'), '') <> 'admin' then
        raise exception 'No autorizado. Solo administradores pueden cambiar roles.';
    end if;

    -- Validar rol
    if p_rol not in ('cajero', 'admin', 'client') then
        raise exception 'Rol no válido: %', p_rol;
    end if;

    -- Actualizar app_metadata en auth.users
    update auth.users
    set app_metadata = jsonb_set(coalesce(app_metadata, '{}'::jsonb), '{role}', to_jsonb(p_rol))
    where id = p_usuario_id;
    
    -- Sincronizar columna rol en profiles
    update public.profiles
    set rol = p_rol
    where id = p_usuario_id;
end;
$$ language plpgsql security definer;
