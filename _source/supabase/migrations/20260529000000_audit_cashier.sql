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

    -- Actualizar raw_app_meta_data en auth.users
    update auth.users
    set raw_app_meta_data = jsonb_set(coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', to_jsonb(p_rol))
    where id = p_usuario_id;
    
    -- Sincronizar columna rol en profiles
    update public.profiles
    set rol = p_rol
    where id = p_usuario_id;
end;
$$ language plpgsql security definer;

-- 7. Función segura para que administradores editen los datos de otros operadores
create or replace function public.actualizar_operador_por_admin(
    p_usuario_id uuid,
    p_nombre text,
    p_apellido text,
    p_email text,
    p_rol text
)
returns void as $$
begin
    -- 1. Validar que el llamador sea administrador en auth.users
    if coalesce((auth.jwt()->'app_metadata'->>'role'), '') <> 'admin' then
        raise exception 'No autorizado. Solo administradores pueden modificar el staff.';
    end if;

    -- 2. Impedir modificar al administrador propietario
    if p_usuario_id = (select id from public.profiles where email = 'lsnetinformatica2024@gmail.com') then
        raise exception 'No está permitido modificar al administrador propietario.';
    end if;

    -- 3. Validar rol solicitado
    if p_rol not in ('cajero', 'admin') then
        raise exception 'Rol no válido. Debe ser cajero o admin.';
    end if;

    -- 4. Actualizar auth.users (email, metadatos y raw_app_meta_data)
    update auth.users
    set email = p_email,
        raw_user_meta_data = jsonb_set(
            coalesce(raw_user_meta_data, '{}'::jsonb), 
            '{nombre}', 
            to_jsonb(p_nombre)
        ),
        raw_app_meta_data = jsonb_set(
            coalesce(raw_app_meta_data, '{}'::jsonb), 
            '{role}', 
            to_jsonb(p_rol)
        )
    where id = p_usuario_id;
    
    update auth.users
    set raw_user_meta_data = jsonb_set(
            coalesce(raw_user_meta_data, '{}'::jsonb), 
            '{apellido}', 
            to_jsonb(p_apellido)
        )
    where id = p_usuario_id;

    -- 5. Actualizar public.profiles
    update public.profiles
    set nombre = p_nombre,
        apellido = p_apellido,
        email = p_email,
        rol = p_rol
    where id = p_usuario_id;
end;
$$ language plpgsql security definer;

-- 8. Función segura para que administradores eliminen por completo a otros operadores de auth.users y profiles
create or replace function public.eliminar_operador_por_admin(
    p_usuario_id uuid
)
returns void as $$
begin
    -- 1. Validar que el llamador sea administrador en auth.users
    if coalesce((auth.jwt()->'app_metadata'->>'role'), '') <> 'admin' then
        raise exception 'No autorizado. Solo administradores pueden eliminar el staff.';
    end if;

    -- 2. Impedir eliminar al administrador propietario
    if p_usuario_id = (select id from public.profiles where email = 'lsnetinformatica2024@gmail.com') then
        raise exception 'No está permitido eliminar al administrador propietario.';
    end if;

    -- 3. Eliminar de auth.users (esto provocará un cascade delete en public.profiles)
    delete from auth.users
    where id = p_usuario_id;
end;
$$ language plpgsql security definer;

-- 9. Políticas de seguridad estrictas en transacciones para impedir que cajeros/operadores inserten cargas manuales
drop policy if exists "Admins/Cajeros gestionan transacciones" on public.transacciones;

create policy "Admins/Cajeros ven todas las transacciones"
    on public.transacciones for select
    using (
        auth.jwt()->'app_metadata'->>'role' = 'admin' or 
        auth.jwt()->'app_metadata'->>'role' = 'cajero' or
        auth.jwt()->>'role' = 'service_role'
    );

create policy "Cajeros/Admins insertan compras y canjes"
    on public.transacciones for insert
    with check (
        (auth.jwt()->'app_metadata'->>'role' = 'admin' or auth.jwt()->'app_metadata'->>'role' = 'cajero' or auth.jwt()->>'role' = 'service_role')
        and tipo in ('carga_compra', 'canje_premio')
    );

create policy "Solo admins insertan cargas manuales"
    on public.transacciones for insert
    with check (
        (auth.jwt()->'app_metadata'->>'role' = 'admin' or auth.jwt()->>'role' = 'service_role')
        and tipo = 'carga_manual'
    );


