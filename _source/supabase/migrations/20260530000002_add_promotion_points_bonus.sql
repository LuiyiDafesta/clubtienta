-- =====================================================================
-- CLUBTIENTA - MIGRACIÓN: AGREGAR BONO DE PUNTOS EXTRA A PROMOCIONES
-- =====================================================================

-- 1. Agregar la columna bono_puntos_override a la tabla de promociones
alter table public.promociones 
    add column if not exists bono_puntos_override integer default null check (bono_puntos_override >= 0);

-- 2. Recargar el esquema de postgrest para aplicar cambios inmediatamente
NOTIFY pgrst, 'reload schema';
