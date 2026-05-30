-- =====================================================================
-- CLUBTIENTA - MIGRACIÓN: REGISTRO Y AUDITORÍA DE REFERIDOS (CRM ADMIN)
-- =====================================================================

-- 1. Crear la tabla de referidos
create table if not exists public.referidos (
    id uuid primary key default gen_random_uuid(),
    referente_id uuid not null references public.profiles(id) on delete cascade,
    referido_id uuid not null unique references public.profiles(id) on delete cascade,
    puntos_referente integer not null,
    puntos_referido integer not null,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Crear índices de optimización para búsquedas y joins
create index if not exists idx_referidos_referente_id on public.referidos(referente_id);
create index if not exists idx_referidos_referido_id on public.referidos(referido_id);

-- 3. Habilitar seguridad a nivel de filas (RLS)
alter table public.referidos enable row level security;

-- 4. Crear políticas RLS: Solo administradores pueden ver los registros
drop policy if exists "Solo admins leen referidos" on public.referidos;
create policy "Solo admins leen referidos"
    on public.referidos for select
    using (
        auth.jwt()->'app_metadata'->>'role' = 'admin' 
        or auth.jwt()->>'role' = 'service_role'
    );

-- 5. Redefinir la función stored procedure atómica de registro de referidos
create or replace function public.procesar_registro_referido(
    p_cliente_id uuid,
    p_dni_referido text
)
returns void as $$
declare
    v_referente_id uuid;
    v_referente_nombre text;
    v_referente_apellido text;
    v_puntos_bienvenida integer;
    v_puntos_referido integer;
    v_nuevo_nombre text;
    v_nuevo_apellido text;
    v_nuevo_dni text;
begin
    -- 1. Obtener puntos configurados o usar valores por defecto
    select coalesce((select valor::integer from public.configuraciones where clave = 'puntos_bienvenida'), 50) into v_puntos_bienvenida;
    select coalesce((select valor::integer from public.configuraciones where clave = 'puntos_referido'), 100) into v_puntos_referido;

    -- 2. Insertar transacción de bienvenida para el nuevo cliente
    insert into public.transacciones (cliente_id, tipo, puntos, detalle)
    values (p_cliente_id, 'carga_manual', v_puntos_bienvenida, 'Regalo de Bienvenida al ClubTienta');

    -- 3. Si se especificó un DNI de referido válido, buscar al referente
    if p_dni_referido is not null and trim(p_dni_referido) <> '' then
        select id, nombre, apellido into v_referente_id, v_referente_nombre, v_referente_apellido
        from public.profiles
        where dni = trim(p_dni_referido)
        limit 1;

        -- Validar que el referente exista y no sea el mismo cliente que se registra
        if v_referente_id is not null and v_referente_id <> p_cliente_id then
            -- Obtener datos del nuevo cliente para el detalle de la auditoría y log
            select nombre, apellido, dni into v_nuevo_nombre, v_nuevo_apellido, v_nuevo_dni
            from public.profiles
            where id = p_cliente_id;

            -- Insertar transacción de puntos extras para el referente que recomendó
            insert into public.transacciones (cliente_id, tipo, puntos, detalle)
            values (
                v_referente_id, 
                'carga_manual', 
                v_puntos_referido, 
                'Bono por referir a ' || v_nuevo_nombre || ' ' || v_nuevo_apellido || ' (DNI ' || v_nuevo_dni || ')'
            );

            -- REGISTRO AUDITABLE: Insertar relación de referidos en la tabla para control de admin
            insert into public.referidos (referente_id, referido_id, puntos_referente, puntos_referido)
            values (v_referente_id, p_cliente_id, v_puntos_referido, v_puntos_bienvenida);
        end if;
    end if;
end;
$$ language plpgsql security definer;
