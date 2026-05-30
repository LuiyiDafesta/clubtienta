import React, { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { User, Mail, Lock, CreditCard, ArrowRight, ArrowLeft, Calendar, MessageSquare } from 'lucide-react'
import { enviarEmailTransaccional } from '../lib/emails'

export default function Registro() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Parse query DNI ref
  const params = new URLSearchParams(location.search)
  const queryRef = params.get('ref') || ''
  
  // Estados del Formulario
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [email, setEmail] = useState('')
  const [dni, setDni] = useState('')
  const [telefono, setTelefono] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [password, setPassword] = useState('')
  const [referidoDni, setReferidoDni] = useState(queryRef)
  
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    // 1. Validar Correo Electrónico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setErrorMsg('Por favor ingresá un correo electrónico válido (ej. nombre@ejemplo.com).')
      setLoading(false)
      return
    }

    // 2. Validar DNI argentino (numérico) y normalizar rellenando ceros a la izquierda
    let cleanDni = dni.replace(/\D/g, '')
    if (cleanDni.length === 0) {
      setErrorMsg('Por favor ingresá tu número de DNI.')
      setLoading(false)
      return
    }
    // Rellenar con ceros a la izquierda para garantizar siempre 8 dígitos (ej. 4555555 -> 04555555)
    cleanDni = cleanDni.padStart(8, '0')
    if (cleanDni.length > 10) {
      setErrorMsg('El número de DNI no puede superar los 10 dígitos.')
      setLoading(false)
      return
    }

    // 3. Validar y Normalizar WhatsApp para Argentina (549 + 10 dígitos)
    let cleanWhatsapp = telefono.replace(/\D/g, '')
    if (!cleanWhatsapp) {
      setErrorMsg('El número de WhatsApp es obligatorio.')
      setLoading(false)
      return
    }

    // Si ingresó el número con el formato local, quitar cualquier prefijo sobrante
    if (cleanWhatsapp.startsWith('0')) {
      cleanWhatsapp = cleanWhatsapp.substring(1)
    }
    if (cleanWhatsapp.length === 12 && cleanWhatsapp.substring(3, 5) === '15') {
      cleanWhatsapp = cleanWhatsapp.substring(0, 3) + cleanWhatsapp.substring(5)
    }

    // Formatear al formato final internacional de WhatsApp de Argentina: 549 + 10 dígitos
    if (cleanWhatsapp.startsWith('549') && cleanWhatsapp.length === 13) {
      // Formato completo correcto
    } else if (cleanWhatsapp.startsWith('54') && cleanWhatsapp.length === 12) {
      // Agregar el 9 de móvil
      cleanWhatsapp = '549' + cleanWhatsapp.substring(2)
    } else if (cleanWhatsapp.length === 10) {
      // Agregar prefijo 549
      cleanWhatsapp = '549' + cleanWhatsapp
    } else {
      setErrorMsg('Por favor ingresá un número de WhatsApp válido de 10 dígitos (código de área + número, ej. 3416123456, sin el 0 y sin el 15).')
      setLoading(false)
      return
    }

    // 4. Validar Fecha de Nacimiento (Obligatoria)
    if (!fechaNacimiento) {
      setErrorMsg('La fecha de nacimiento es obligatoria.')
      setLoading(false)
      return
    }

    try {
      // 1. VALIDACIÓN PREVIA: Verificar si el DNI ya existe en profiles
      const { data: existingProfile, error: searchDniError } = await supabase
        .from('profiles')
        .select('dni')
        .eq('dni', cleanDni)
        .maybeSingle()

      if (searchDniError) throw searchDniError
      if (existingProfile) {
        throw new Error('El DNI ingresado ya se encuentra registrado en el sistema.')
      }

      // 2. REGISTRO EN SUPABASE AUTH
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nombre,
            apellido
          }
        }
      })

      if (authError) throw authError

      if (authData?.user) {
        // 3. REGISTRO EN LA TABLA profiles
        // Los puntos iniciales empiezan en 0 ya que se acreditarán por el Stored Procedure
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            dni: cleanDni,
            nombre,
            apellido,
            telefono: cleanWhatsapp,
            email,
            fecha_nacimiento: fechaNacimiento,
            puntos_actuales: 0,
            nivel: 'Gold'
          })

        if (profileError) {
          console.error(profileError)
          throw new Error('Hubo un error al registrar tus datos de perfil: ' + profileError.message)
        }

        // 4. LLAMAR AL RPC PARA PROCESAR PUNTOS DE BIENVENIDA Y REFERIDO
        const cleanReferidoDni = referidoDni.replace(/\D/g, '')
        const { error: rpcError } = await supabase.rpc('procesar_registro_referido', {
          p_cliente_id: authData.user.id,
          p_dni_referido: cleanReferidoDni || null
        })

        if (rpcError) {
          console.error('Error al procesar referido:', rpcError)
        }

        // Obtener el valor de puntos de bienvenida de configuraciones para reflejarlo en el email
        let welcomePts = 50
        try {
          const { data: configPts } = await supabase
            .from('configuraciones')
            .select('valor')
            .eq('clave', 'puntos_bienvenida')
            .maybeSingle()
          if (configPts && configPts.valor) welcomePts = Number(configPts.valor)
        } catch (e) {
          console.error(e)
        }

        // Enviar email transaccional de bienvenida
        enviarEmailTransaccional('registro_usuario', authData.user.id, {
          puntos_bienvenida: welcomePts
        })

        // 5. DISPARAR WEBHOOK SI ESTÁ CONFIGURADO
        try {
          const { data: webhookConfig } = await supabase
            .from('configuraciones')
            .select('valor')
            .eq('clave', 'webhook_n8n')
            .maybeSingle()

          if (webhookConfig && webhookConfig.valor) {
            fetch(webhookConfig.valor, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                evento: 'registro_cliente',
                id: authData.user.id,
                dni: cleanDni,
                nombre,
                apellido,
                telefono: cleanWhatsapp,
                email,
                fecha_nacimiento: fechaNacimiento,
                referido_por_dni: cleanReferidoDni || null,
                timestamp: new Date().toISOString()
              })
            }).catch(e => console.error('Error enviando webhook CRM:', e))
          }
        } catch (webhookErr) {
          console.error('Error al procesar webhook config:', webhookErr)
        }

        setSuccessMsg('¡Registro exitoso! Sumaste tus puntos de bienvenida de regalo. Redirigiendo...')
        
        // Loguear e ir al Dashboard en 2 segundos
        setTimeout(() => {
          navigate('/dashboard')
        }, 2000)
      } else {
        throw new Error('No se pudo completar el registro. Intentalo de nuevo.')
      }
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'Ocurrió un error al procesar el registro.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-tienta-crema">
      
      {/* Lateral Izquierdo: Branding Editorial */}
      <div className="hidden md:flex md:w-1/3 bg-tienta-teal relative items-center justify-center p-12 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-tienta-gold/10 blur-3xl"></div>
        
        <div className="relative z-10 text-center max-w-sm flex flex-col items-center">
          <Link to="/" className="text-white/80 hover:text-[#fad08c] mb-8 flex items-center gap-2 text-xs font-montserrat uppercase tracking-widest transition-colors duration-200 font-extrabold">
            <ArrowLeft size={12} /> Volver al Inicio
          </Link>
          
          <div className="mb-4">
            <span className="font-montserrat text-6xl font-black tracking-[0.25em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
              TIENTA
            </span>
            <div className="font-montserrat text-xs font-extrabold tracking-[0.35em] text-[#fad08c] uppercase mt-3">
              ASOCIATE AL CLUB
            </div>
          </div>
          
          <div className="h-[2px] w-24 bg-[#fad08c]/40 my-8"></div>
          
          <p className="font-montserrat text-xs font-semibold tracking-wider text-white leading-relaxed uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            Comenzá a sumar beneficios exclusivos y canjeá tus puntos por tus postres y helados artesanales favoritos.
          </p>
        </div>
      </div>

      {/* Lateral Derecho: Formulario de Registro */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-12">
        <div className="w-full max-w-lg bg-white border border-black/5 rounded-3xl px-5 py-6 sm:p-10 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)]">
          
          <div className="mb-5">
            <div className="md:hidden flex justify-start mb-4">
              <Link to="/" className="text-tienta-teal/60 hover:text-tienta-teal flex items-center gap-2 text-xs font-montserrat uppercase tracking-wider font-bold">
                <ArrowLeft size={12} /> Volver
              </Link>
            </div>
            
            <h2 className="text-2xl font-montserrat font-extrabold tracking-wider text-tienta-teal uppercase">
              Asociarse al Club
            </h2>
            <p className="text-sm text-black/65 mt-1.5 font-semibold font-lato">
              Completá tus datos para crear tu tarjeta de fidelidad virtual.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-bold text-left">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-100 text-green-600 text-sm font-bold text-left">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4 text-left">
            
            {/* Grid de Nombre y Apellido */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal mb-2">
                  Nombre
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/50">
                    <User size={14} />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juan"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="input-tienta pl-11 py-2.5 text-black font-semibold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal mb-2">
                  Apellido
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/50">
                    <User size={14} />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Pérez"
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                    className="input-tienta pl-11 py-2.5 text-black font-semibold text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Grid de DNI y WhatsApp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal mb-2">
                  DNI (Socio)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/50">
                    <CreditCard size={14} />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 45555555"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    className="input-tienta pl-11 py-2.5 text-black font-semibold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal mb-2">
                  WhatsApp (Formato de Mensaje)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/50">
                    <MessageSquare size={14} />
                  </span>
                  <input
                    type="tel"
                    required
                    placeholder="Ej. 3416123456 (cód. área)"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="input-tienta pl-11 py-2.5 text-black font-semibold text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Grid de Fecha de Nacimiento y Referido */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal mb-2">
                  Fecha de Nacimiento
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/50">
                    <Calendar size={14} />
                  </span>
                  <input
                    type="date"
                    required
                    value={fechaNacimiento}
                    onChange={(e) => setFechaNacimiento(e.target.value)}
                    className="input-tienta pl-11 py-2.5 text-black font-semibold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal mb-2">
                  ¿Quién te recomendó? (DNI Opcional)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/50">
                    <CreditCard size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="DNI de tu amigo"
                    value={referidoDni}
                    onChange={(e) => setReferidoDni(e.target.value)}
                    className="input-tienta pl-11 py-2.5 text-black font-semibold text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal mb-2">
                Correo Electrónico (Único para Login)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/50">
                  <Mail size={14} />
                </span>
                <input
                  type="email"
                  required
                  placeholder="juanperez@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-tienta pl-11 py-2.5 text-black font-semibold text-sm"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal mb-2">
                Contraseña
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/50">
                  <Lock size={14} />
                </span>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-tienta pl-11 py-2.5 text-black font-semibold text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-tienta-teal py-3.5 flex items-center justify-center gap-2 mt-6 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>{loading ? 'Procesando...' : 'Asociarse al Club'}</span>
              {!loading && <ArrowRight size={14} />}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-black/5 text-center">
            <p className="text-xs text-black/50">
              ¿Ya estás asociado?{' '}
              <Link
                to="/"
                className="text-tienta-teal font-semibold hover:underline tracking-wide"
              >
                Iniciá sesión acá
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
