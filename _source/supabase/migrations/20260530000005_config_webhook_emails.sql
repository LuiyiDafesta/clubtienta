-- =====================================================================
-- CLUBTIENTA - MIGRACIÓN: CONFIGURACIÓN DE WEBHOOK DE EMAILS TRANSACCIONALES
-- =====================================================================

-- 1. Insertar la configuración inicial para webhook_emails
insert into public.configuraciones (clave, valor)
values ('webhook_emails', '')
on conflict (clave) do nothing;
