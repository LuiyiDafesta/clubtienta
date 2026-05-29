-- =====================================================================
-- CLUBTIENTA - MIGRACIÓN: MEMBRESÍAS CONFIGURABLES (GOLD & PLATINUM)
-- =====================================================================

-- 1. Insertar configuraciones iniciales de límites y bonos de puntos
insert into public.configuraciones (clave, valor)
values 
    ('limite_consumo_gold', '0'),
    ('limite_consumo_platinum', '20000'),
    ('bono_puntos_gold', '0'),
    ('bono_puntos_platinum', '20')
on conflict (clave) do update 
set valor = excluded.valor;

-- 2. Migrar perfiles existentes al nuevo esquema de dos niveles ('Gold' y 'Platinum')
update public.profiles
set nivel = case 
    when nivel in ('Standard', 'Oro') then 'Gold'
    when nivel = 'Platino' then 'Platinum'
    else 'Gold'
end;

-- 3. Modificar la columna default y la restricción check de la tabla public.profiles
alter table public.profiles alter column nivel set default 'Gold';

alter table public.profiles drop constraint if exists profiles_nivel_check;
alter table public.profiles add constraint profiles_nivel_check check (nivel in ('Gold', 'Platinum'));

-- 4. Reescribir el trigger de puntos y niveles para usar consumo en pesos
create or replace function public.actualizar_puntos_y_nivel_cliente()
returns trigger as $$
declare
    v_total_pesos_consumidos numeric(12,2);
    v_nuevo_nivel text;
    v_puntos_acumulados integer;
    v_limite_gold numeric(12,2);
    v_limite_platinum numeric(12,2);
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

    -- 4. Obtener límites de consumo configurados
    select coalesce((select valor::numeric from public.configuraciones where clave = 'limite_consumo_gold'), 0) into v_limite_gold;
    select coalesce((select valor::numeric from public.configuraciones where clave = 'limite_consumo_platinum'), 20000) into v_limite_platinum;

    -- 5. Calcular el consumo acumulado histórico en pesos (suma de importe de compras reales)
    select coalesce(sum(importe), 0) into v_total_pesos_consumidos
    from public.transacciones
    where cliente_id = new.cliente_id and tipo = 'carga_compra';

    -- 6. Calcular el nivel correspondiente
    if v_total_pesos_consumidos >= v_limite_platinum then
        v_nuevo_nivel := 'Platinum';
    else
        v_nuevo_nivel := 'Gold';
    end if;

    -- 7. Actualizar el nivel si ha cambiado
    update public.profiles
    set nivel = v_nuevo_nivel
    where id = new.cliente_id;

    return new;
end;
$$ language plpgsql security definer;

-- 5. Actualizar niveles aplicables en promociones existentes para alinearlas al nuevo esquema
update public.promociones
set niveles_aplicables = case 
    when niveles_aplicables @> array['Oro'::text] or niveles_aplicables @> array['Platino'::text] then array['Gold', 'Platinum']
    else array['Gold', 'Platinum']
end
where niveles_aplicables is not null;
