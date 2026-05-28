-- =====================================================================
-- CLUBTIENTA - FASE 2: CRM, REFERIDOS, WEBHOOKS Y MOVIMIENTOS
-- =====================================================================

-- 1. Nuevas configuraciones iniciales
insert into public.configuraciones (clave, valor)
values 
    ('puntos_bienvenida', '50'),
    ('puntos_referido', '100'),
    ('webhook_n8n', '')
on conflict (clave) do nothing;

-- 2. Habilitar políticas explícitas en public.profiles para registro de clientes
create policy "Permitir inserción de propio perfil"
    on public.profiles for insert
    with check (auth.uid() = id);

create policy "Permitir actualización de propio perfil"
    on public.profiles for update
    using (auth.uid() = id);

-- 3. Stored Procedure Seguro: Acreditación Atómica de Referidos
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
            -- Obtener datos del nuevo cliente para el detalle de la auditoría
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
        end if;
    end if;
end;
$$ language plpgsql security definer;
