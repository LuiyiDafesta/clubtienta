-- CLUBTIENTA - MIGRACIÓN: REGISTRO Y DECREMENTO AUTOMÁTICO DE STOCK DE PREMIOS
-- =====================================================================

-- 1. Agregar columna premio_id en la tabla transacciones para asociar la transacción al premio canjeado
ALTER TABLE public.transacciones 
ADD COLUMN IF NOT EXISTS premio_id uuid REFERENCES public.premios(id) ON DELETE SET NULL;

-- 2. Crear función para decrementar el stock del premio de manera atómica (Security Definer)
-- Esto permite que cualquier cajero realice la transacción y el stock se actualice de forma segura
CREATE OR REPLACE FUNCTION public.decrementar_stock_premio()
RETURNS trigger AS $$
BEGIN
    IF new.tipo = 'canje_premio' AND new.premio_id IS NOT NULL THEN
        -- Decrementar el stock si no es ilimitado (-1)
        UPDATE public.premios
        SET stock = CASE WHEN stock > 0 THEN stock - 1 ELSE 0 END
        WHERE id = new.premio_id AND stock <> -1;
    END IF;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear el trigger para que se ejecute después de insertar una transacción
DROP TRIGGER IF EXISTS tr_transacciones_decrementar_stock ON public.transacciones;
CREATE TRIGGER tr_transacciones_decrementar_stock
AFTER INSERT ON public.transacciones
FOR EACH ROW
EXECUTE FUNCTION public.decrementar_stock_premio();

-- 4. Notificar a PostgREST para recargar el esquema de manera inmediata
NOTIFY pgrst, 'reload schema';
