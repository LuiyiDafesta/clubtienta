-- =====================================================================
-- CLUBTIENTA - MIGRACIÓN: DERECHO DE ADMISIÓN (SUSPENSIÓN DE SOCIOS)
-- =====================================================================

-- 1. Agregar columna activo a public.profiles
alter table public.profiles add column if not exists activo boolean default true;

-- 2. Modificar las políticas RLS de profiles para que los clientes suspendidos no puedan leer sus datos
-- Primero dropear la política antigua de clientes
drop policy if exists "Clientes pueden ver su propio perfil" on public.profiles;

-- Crear la política que restringe a clientes inactivos
create policy "Clientes activos ven su propio perfil"
    on public.profiles for select
    using (
        (auth.uid() = id and activo = true)
        or (auth.jwt()->'app_metadata'->>'role' in ('admin', 'cajero') or auth.jwt()->>'role' = 'service_role')
    );
