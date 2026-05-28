import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rijplpbtbdtydrifzylr.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpanBscGJ0YmR0eWRyaWZ6eWxyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTk4OTU0MywiZXhwIjoyMDk1NTY1NTQzfQ.4hbZbAfmbHBpLTQC8CKoZzMsluBqSC123OX__edvk1Y'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function run() {
  console.log('--- CREANDO USUARIOS EN SUPABASE AUTH Y PUBLIC.PROFILES ---')

  // 1. Datos del Administrador
  const adminEmail = 'lsnetinformatica2024@gmail.com'
  const adminPassword = 'Luiyi260879@'
  
  // 2. Datos del Cliente de Prueba
  const clientEmail = 'sturzels00@gmail.com'
  const clientPassword = 'Luiyi260879@'
  const clientDni = '27398890'

  try {
    // --- 1. CREAR ADMINISTRADOR ---
    console.log(`\nCreando administrador: ${adminEmail}...`)
    
    // Primero, verificar si el usuario ya existe en auth
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) throw listError

    let adminUser = usersData.users.find(u => u.email === adminEmail)
    
    if (!adminUser) {
      const { data: newAdmin, error: createAdminError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: { nombre: 'Luiyi', apellido: 'Dafesta' },
        app_metadata: { role: 'admin' } // Rol de admin en Supabase
      })
      if (createAdminError) throw createAdminError
      adminUser = newAdmin.user
      console.log(`✓ Administrador creado en auth con ID: ${adminUser.id}`)
    } else {
      console.log(`ℹ El administrador ya existía en auth con ID: ${adminUser.id}. Actualizando metadatos...`)
      const { error: updateError } = await supabase.auth.admin.updateUserById(adminUser.id, {
        app_metadata: { role: 'admin' }
      })
      if (updateError) throw updateError
    }

    // Insertar/actualizar su perfil en public.profiles
    const { error: profileAdminError } = await supabase
      .from('profiles')
      .upsert({
        id: adminUser.id,
        dni: '11111111', // DNI genérico para el admin
        nombre: 'Luiyi',
        apellido: 'Dafesta',
        telefono: '3411234567',
        email: adminEmail,
        puntos_actuales: 0,
        nivel: 'Standard'
      }, { onConflict: 'id' })

    if (profileAdminError) {
      console.error('⚠ Error al guardar el perfil del admin en public.profiles:', profileAdminError.message)
    } else {
      console.log('✓ Perfil del administrador guardado en public.profiles.')
    }


    // --- 2. CREAR CLIENTE DE PRUEBA ---
    console.log(`\nCreando cliente de prueba: ${clientEmail}...`)
    
    let clientUser = usersData.users.find(u => u.email === clientEmail)

    if (!clientUser) {
      const { data: newClient, error: createClientError } = await supabase.auth.admin.createUser({
        email: clientEmail,
        password: clientPassword,
        email_confirm: true,
        user_metadata: { nombre: 'Usuario', apellido: 'Prueba' },
        app_metadata: { role: 'client' }
      })
      if (createClientError) throw createClientError
      clientUser = newClient.user
      console.log(`✓ Cliente de prueba creado en auth con ID: ${clientUser.id}`)
    } else {
      console.log(`ℹ El cliente de prueba ya existía en auth con ID: ${clientUser.id}`)
    }

    // Insertar/actualizar su perfil en public.profiles
    // Le asignamos 500 puntos iniciales para que el usuario pueda hacer pruebas de canje de premios
    const { error: profileClientError } = await supabase
      .from('profiles')
      .upsert({
        id: clientUser.id,
        dni: clientDni,
        nombre: 'Usuario',
        apellido: 'Prueba',
        telefono: '3417654321',
        email: clientEmail,
        puntos_actuales: 500, // 500 puntos de regalo para pruebas
        nivel: 'Standard'
      }, { onConflict: 'id' })

    if (profileClientError) {
      console.error('⚠ Error al guardar el perfil del cliente de prueba en public.profiles:', profileClientError.message)
    } else {
      console.log('✓ Perfil del cliente de prueba guardado en public.profiles (con 500 puntos iniciales).')
    }

    console.log('\n--- PROCESO TERMINADO CON ÉXITO ---')

  } catch (error) {
    console.error('\n✖ Ocurrió un error en el script:')
    console.error(error.message || error)
  }
}

run()
