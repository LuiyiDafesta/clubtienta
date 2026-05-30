-- =====================================================================
-- CLUBTIENTA - MIGRACIÓN: PROTECCIÓN DE COLUMNAS SENSIBLES EN PERFILES
-- =====================================================================

-- 1. Crear la función del trigger para validar actualizaciones
CREATE OR REPLACE FUNCTION public.proteger_columnas_sensibles_perfil()
RETURNS trigger AS $$
BEGIN
    -- Si la modificación proviene de una conexión de cliente común (API de Supabase)
    -- y el rol del JWT no es cajero o administrador autenticado
    IF (current_user <> 'postgres' AND current_user <> 'supabase_admin') AND
       (auth.jwt()->'app_metadata'->>'role' IS NULL OR auth.jwt()->'app_metadata'->>'role' = 'client') THEN
        
        -- Si intentan cambiar puntos, nivel o flags administrativos
        IF (NEW.puntos_actuales IS DISTINCT FROM OLD.puntos_actuales) OR
           (NEW.nivel IS DISTINCT FROM OLD.nivel) OR
           (NEW.nivel_manual IS DISTINCT FROM OLD.nivel_manual) OR
           (NEW.dni IS DISTINCT FROM OLD.DNI) OR
           (NEW.email IS DISTINCT FROM OLD.email) THEN
            RAISE EXCEPTION 'Acceso Denegado: No tenés permisos para modificar campos administrativos o sensibles de tu perfil.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Vincular el trigger BEFORE UPDATE a la tabla profiles
DROP TRIGGER IF EXISTS tr_proteger_columnas_sensibles_perfil ON public.profiles;
CREATE TRIGGER tr_proteger_columnas_sensibles_perfil
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.proteger_columnas_sensibles_perfil();
