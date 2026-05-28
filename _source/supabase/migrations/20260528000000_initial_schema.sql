-- =====================================================================
-- CLUBTIENTA - ESQUEMA DE BASE DE DATOS INICIAL
-- =====================================================================

-- Habilitar extensiones necesarias si no lo están
create extension if not exists "uuid-ossp";

-- 1. TABLA profiles (Clientes/Socios del Club)
create table if not exists public.profiles (
    id uuid references auth.users on delete cascade primary key,
    dni text not null unique check (length(dni) >= 7 and length(dni) <= 10),
    nombre text not null,
    apellido text not null,
    telefono text,
    email text not null unique,
    puntos_actuales integer not null default 0 check (puntos_actuales >= 0),
    nivel text not null default 'Standard' check (nivel in ('Standard', 'Oro', 'Platino')),
    created_at timestamp with time zone default now()
);

-- Habilitar RLS en profiles
alter table public.profiles enable row level security;

-- 2. TABLA configuraciones (Parámetros globales)
create table if not exists public.configuraciones (
    id uuid default uuid_generate_v4() primary key,
    clave text not null unique,
    valor text not null,
    updated_at timestamp with time zone default now(),
    updated_by uuid references auth.users on delete set null
);

-- Habilitar RLS en configuraciones
alter table public.configuraciones enable row level security;

-- 3. TABLA premios (Catálogo de Premios canjeables)
create table if not exists public.premios (
    id uuid default uuid_generate_v4() primary key,
    nombre text not null,
    descripcion text,
    puntos_requeridos integer not null check (puntos_requeridos > 0),
    imagen_url text,
    stock integer not null default -1, -- -1 para stock ilimitado
    activo boolean not null default true,
    created_at timestamp with time zone default now()
);

-- Habilitar RLS en premios
alter table public.premios enable row level security;

-- 4. TABLA promociones (Promociones y beneficios)
create table if not exists public.promociones (
    id uuid default uuid_generate_v4() primary key,
    titulo text not null,
    descripcion text not null,
    descuento_porcentaje integer check (descuento_porcentaje > 0 and descuento_porcentaje <= 100),
    dias_vigencia text[] not null, -- Array de días de la semana: ['Lunes', 'Miércoles']
    niveles_aplicables text[], -- Array de niveles: ['Oro', 'Platino'] (si es null/vacío aplica a todos)
    imagen_url text,
    activo boolean not null default true,
    created_at timestamp with time zone default now()
);

-- Habilitar RLS en promociones
alter table public.promociones enable row level security;

-- 5. TABLA transacciones (Historial y Auditoría de Puntos)
create table if not exists public.transacciones (
    id uuid default uuid_generate_v4() primary key,
    cliente_id uuid references public.profiles(id) on delete cascade not null,
    tipo text not null check (tipo in ('carga_compra', 'carga_manual', 'canje_premio')),
    importe numeric(12,2) check (
        (tipo = 'carga_compra' and importe is not null and importe > 0) or
        (tipo <> 'carga_compra' and importe is null)
    ),
    puntos integer not null check (
        (tipo in ('carga_compra', 'carga_manual') and puntos > 0) or
        (tipo = 'canje_premio' and puntos < 0)
    ),
    ticket_factura text check (
        (tipo = 'carga_compra' and ticket_factura is not null and ticket_factura <> '') or
        (tipo <> 'carga_compra' and ticket_factura is null)
    ),
    detalle text not null,
    creado_por uuid references auth.users on delete set null, -- ID del cajero/administrador que operó
    created_at timestamp with time zone default now()
);

-- Habilitar RLS en transacciones
alter table public.transacciones enable row level security;

-- Indexar DNI, Email y tipo de transacciones para búsquedas instantáneas
create index if not exists idx_profiles_dni on public.profiles(dni);
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_transacciones_cliente_id on public.transacciones(cliente_id);
create index if not exists idx_transacciones_created_at on public.transacciones(created_at);

-- =====================================================================
-- PROCEDIMIENTOS ALMACENADOS Y TRIGGERS (LÓGICA AUTOMÁTICA)
-- =====================================================================

-- Función para actualizar automáticamente los puntos y el nivel del cliente tras una transacción
create or replace function public.actualizar_puntos_y_nivel_cliente()
returns trigger as $$
declare
    v_total_puntos_ganados integer;
    v_nuevo_nivel text;
    v_puntos_acumulados integer;
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

    -- 4. Calcular el nivel en base a puntos acumulados HISTÓRICOS (suma de todas las cargas positivas)
    select coalesce(sum(puntos), 0) into v_total_puntos_ganados
    from public.transacciones
    where cliente_id = new.cliente_id and puntos > 0;

    -- Lógica de categorías:
    -- Standard: < 5000 puntos
    -- Oro: >= 5000 puntos y < 10000 puntos
    -- Platino: >= 10000 puntos
    if v_total_puntos_ganados >= 10000 then
        v_nuevo_nivel := 'Platino';
    elseif v_total_puntos_ganados >= 5000 then
        v_nuevo_nivel := 'Oro';
    else
        v_nuevo_nivel := 'Standard';
    end if;

    -- Actualizar el nivel si ha cambiado
    update public.profiles
    set nivel = v_nuevo_nivel
    where id = new.cliente_id;

    return new;
end;
$$ language plpgsql security definer;

-- Crear trigger que se ejecuta tras insertar una transacción
create or replace trigger tr_transacciones_actualizar_puntos
after insert on public.transacciones
for each row
execute function public.actualizar_puntos_y_nivel_cliente();

-- =====================================================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- =====================================================================

-- A) POLÍTICAS DE PERFILES (profiles)
-- 1. Clientes pueden ver su propio perfil
create policy "Clientes pueden ver su propio perfil"
    on public.profiles for select
    using (auth.uid() = id);

-- 2. Administradores/Cajeros pueden ver todos los perfiles
create policy "Admins/Cajeros pueden ver todos los perfiles"
    on public.profiles for all
    using (
        exists (
            select 1 from public.configuraciones 
            where clave = 'admin_role' and valor like '%' || auth.uid()::text || '%'
        ) or 
        auth.jwt()->>'role' = 'service_role' or
        -- Permitir si la cuenta que consulta es parte del staff de Supabase / posee permisos elevados
        (auth.jwt()->'app_metadata'->>'role' = 'admin' or auth.jwt()->'app_metadata'->>'role' = 'cajero')
    );

-- B) POLÍTICAS DE CONFIGURACIONES (configuraciones)
-- 1. Lectura pública (para saber equivalencia de puntos y reglas)
create policy "Lectura pública de configuraciones"
    on public.configuraciones for select
    using (true);

-- 2. Escritura solo para administradores
create policy "Solo admins editan configuraciones"
    on public.configuraciones for all
    using (
        auth.jwt()->'app_metadata'->>'role' = 'admin' or
        auth.jwt()->>'role' = 'service_role'
    );

-- C) POLÍTICAS DE PREMIOS Y PROMOCIONES (premios / promociones)
-- 1. Lectura pública para todos (clientes y cajeros)
create policy "Lectura pública de premios" on public.premios for select using (true);
create policy "Lectura pública de promociones" on public.promociones for select using (true);

-- 2. Escritura reservada a administradores
create policy "Solo admins gestionan premios" on public.premios for all using (auth.jwt()->'app_metadata'->>'role' = 'admin' or auth.jwt()->>'role' = 'service_role');
create policy "Solo admins gestionan promociones" on public.promociones for all using (auth.jwt()->'app_metadata'->>'role' = 'admin' or auth.jwt()->>'role' = 'service_role');

-- D) POLÍTICAS DE TRANSACCIONES (transacciones)
-- 1. Clientes pueden ver su propio historial
create policy "Clientes ven sus transacciones"
    on public.transacciones for select
    using (cliente_id = auth.uid());

-- 2. Cajeros y administradores pueden crear y ver todas las transacciones
create policy "Admins/Cajeros gestionan transacciones"
    on public.transacciones for all
    using (
        auth.jwt()->'app_metadata'->>'role' = 'admin' or 
        auth.jwt()->'app_metadata'->>'role' = 'cajero' or
        auth.jwt()->>'role' = 'service_role'
    );

-- =====================================================================
-- DATOS SEMILLA (CONFIGURACIÓN Y CATÁLOGO INICIAL)
-- =====================================================================

-- Insertar configuración inicial del valor del punto: $200 = 1 punto
insert into public.configuraciones (clave, valor)
values 
    ('valor_punto', '200'),
    ('expiracion_meses', '0') -- 0 significa que no expiran
on conflict (clave) do nothing;

-- Insertar premios semilla del branding Tienta helados
insert into public.premios (nombre, descripcion, puntos_requeridos, stock, activo)
values
    ('Pote de 1/4 kg - Sabor a Elección', 'Disfruta de nuestros helados artesanales en presentación de 1/4 kg.', 150, -1, true),
    ('Pote de 1/2 kg - Sabor a Elección', 'Disfruta de nuestros helados artesanales en presentación de 1/2 kg.', 280, -1, true),
    ('Pote de 1 kg - Sabores Premium', 'Llevate 1 kg de la mejor cremosidad artesanal de Tienta.', 500, -1, true),
    ('Paleta Artesanal Bañada', 'Nuestra paleta premium con baño de chocolate crocante.', 80, 50, true),
    ('Café Espresso + Macaron', 'Una pausa elegante en nuestras cafeterías Tienta.', 100, -1, true)
on conflict do nothing;

-- Insertar promociones semilla del branding Tienta helados
insert into public.promociones (titulo, descripcion, descuento_porcentaje, dias_vigencia, niveles_aplicables, activo)
values
    ('Miércoles de Amigos - 2x1 en Paletas', 'Todos los miércoles comprando una paleta te llevas otra de regalo.', null, ARRAY['Miércoles'], null, true),
    ('Membresía Oro - 10% Extra en Puntos', 'Si sos socio nivel Oro, sumás 10% extra en puntos en todas tus cargas de compras.', null, ARRAY['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'], ARRAY['Oro', 'Platino'], true),
    ('Fin de Semana Premium', '20% de descuento en potes de 1kg pagando en efectivo los sábados y domingos.', 20, ARRAY['Sábado', 'Domingo'], null, true)
on conflict do nothing;
