-- =====================================================================
-- CLUBTIENTA - MIGRACIÓN: CONFIGURACIÓN DE MEMBRESÍAS MANUALES (CRM)
-- =====================================================================

-- 1. Agregar columna nivel_manual a public.profiles
alter table public.profiles add column if not exists nivel_manual boolean default false;

-- 2. Reescribir el trigger de transacciones para respetar la membresía manual
create or replace function public.actualizar_puntos_y_nivel_cliente()
returns trigger as $$
declare
    v_total_pesos_consumidos numeric(12,2);
    v_nuevo_nivel text;
    v_puntos_acumulados integer;
    v_limite_gold numeric(12,2);
    v_limite_platinum numeric(12,2);
    v_es_manual boolean;
begin
    -- 1. Obtener los puntos actuales del cliente
    select puntos_actuales into v_puntos_acumulados
    from public.profiles
    where id = new.cliente_id;

    -- 2. Validar que el cliente tenga saldo suficiente para un canje (puntos negativos)
    if new.puntos < 0 and (v_puntos_acumulados + new.puntos) < 0 then
        raise exception 'Saldo insuficiente de puntos. Puntos disponibles: %, Canje solicitado: %', 
            v_puntos_acumulados, abs(new.puntos);
    end if;

    -- 3. Actualizar puntos actuales en el perfil del cliente
    update public.profiles
    set puntos_actuales = puntos_actuales + new.puntos
    where id = new.cliente_id;

    -- 4. Verificar si el nivel se administra de forma manual
    select coalesce(nivel_manual, false) into v_es_manual
    from public.profiles
    where id = new.cliente_id;

    -- Solo recalcular y actualizar el nivel si NO está configurado como manual
    if not v_es_manual then
        -- Obtener límites de consumo configurados
        select coalesce((select valor::numeric from public.configuraciones where clave = 'limite_consumo_gold'), 0) into v_limite_gold;
        select coalesce((select valor::numeric from public.configuraciones where clave = 'limite_consumo_platinum'), 20000) into v_limite_platinum;

        -- Calcular el consumo acumulado histórico en pesos (suma de importe de compras reales)
        select coalesce(sum(importe), 0) into v_total_pesos_consumidos
        from public.transacciones
        where cliente_id = new.cliente_id and tipo = 'carga_compra';

        -- Calcular el nivel correspondiente
        if v_total_pesos_consumidos >= v_limite_platinum then
            v_nuevo_nivel := 'Platinum';
        else
            v_nuevo_nivel := 'Gold';
        end if;

        -- Actualizar el nivel en public.profiles
        update public.profiles
        set nivel = v_nuevo_nivel
        where id = new.cliente_id;
    end if;

    return new;
end;
$$ language plpgsql security definer;

-- 3. Crear trigger para recalcular el nivel de forma automática cuando el administrador desactive el modo manual
create or replace function public.actualizar_nivel_manual_perfil()
returns trigger as $$
declare
    v_total_pesos_consumidos numeric(12,2);
    v_limite_platinum numeric(12,2);
begin
    -- Si se cambia de manual a automático (nivel_manual se pone en false)
    if new.nivel_manual = false and (old.nivel_manual = true or old.nivel_manual is null) then
        -- Obtener límite de consumo configurado para Platino
        select coalesce((select valor::numeric from public.configuraciones where clave = 'limite_consumo_platinum'), 20000) into v_limite_platinum;

        -- Calcular el consumo acumulado histórico en pesos
        select coalesce(sum(importe), 0) into v_total_pesos_consumidos
        from public.transacciones
        where cliente_id = new.id and tipo = 'carga_compra';

        -- Asignar el nivel correspondiente
        if v_total_pesos_consumidos >= v_limite_platinum then
            new.nivel := 'Platinum';
        else
            new.nivel := 'Gold';
        end if;
    end if;
    return new;
end;
$$ language plpgsql security definer;

-- 4. Asociar el trigger AFTER UPDATE a la tabla profiles
drop trigger if exists tr_actualizar_nivel_manual_perfil on public.profiles;
create trigger tr_actualizar_nivel_manual_perfil
    before update on public.profiles
    for each row
    execute function public.actualizar_nivel_manual_perfil();
