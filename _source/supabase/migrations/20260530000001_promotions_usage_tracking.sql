-- =====================================================================
-- CLUBTIENTA - MIGRACIÓN: REGISTRO Y AUDITORÍA DE PROMOCIONES APLICADAS
-- =====================================================================

-- 1. Modificar la tabla transacciones para incorporar la promoción y descuento vinculados
alter table public.transacciones 
    add column if not exists promocion_id uuid references public.promociones(id) on delete set null,
    add column if not exists descuento_aplicado numeric default 0 check (descuento_aplicado >= 0);

-- 2. Crear la tabla de registro de promociones para auditoría directa
create table if not exists public.registro_promociones (
    id uuid primary key default gen_random_uuid(),
    cliente_id uuid not null references public.profiles(id) on delete cascade,
    promocion_id uuid not null references public.promociones(id) on delete cascade,
    cajero_id uuid not null references public.profiles(id) on delete cascade,
    ticket_factura text not null,
    importe_compra numeric not null check (importe_compra >= 0),
    descuento_aplicado numeric not null default 0 check (descuento_aplicado >= 0),
    puntos_extra_otorgados integer not null default 0 check (puntos_extra_otorgados >= 0),
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Crear índices de optimización para velocidad de reportes y búsquedas
create index if not exists idx_registro_promociones_cliente_id on public.registro_promociones(cliente_id);
create index if not exists idx_registro_promociones_promocion_id on public.registro_promociones(promocion_id);
create index if not exists idx_registro_promociones_cajero_id on public.registro_promociones(cajero_id);
create index if not exists idx_registro_promociones_created_at on public.registro_promociones(created_at);

-- 4. Habilitar seguridad a nivel de filas (RLS)
alter table public.registro_promociones enable row level security;

-- 5. Crear políticas RLS: Solo administradores pueden consultar el registro global de promociones
drop policy if exists "Solo admins leen auditoria de promos" on public.registro_promociones;
create policy "Solo admins leen auditoria de promos"
    on public.registro_promociones for select
    using (
        auth.jwt()->'app_metadata'->>'role' = 'admin' 
        or auth.jwt()->>'role' = 'service_role'
    );

-- 6. Crear políticas RLS: Operadores y Admins pueden registrar el uso de promociones
drop policy if exists "Operadores insertan registros de promos" on public.registro_promociones;
create policy "Operadores insertan registros de promos"
    on public.registro_promociones for insert
    with check (
        auth.jwt()->'app_metadata'->>'role' in ('admin', 'cajero')
        or auth.jwt()->>'role' = 'service_role'
    );
