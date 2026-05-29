import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Mail, Lock, ArrowRight } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [vista, setVista] = useState<'login' | 'recuperar'>('login')
  const [emailRecuperar, setEmailRecuperar] = useState('')
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      if (data?.user) {
        // Verificar si el perfil está activo
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('rol, activo')
          .eq('id', data.user.id)
          .maybeSingle()

        if (profileError) throw profileError

        if (profile && profile.activo === false) {
          // Cerrar sesión en auth inmediatamente y dar mensaje de error
          await supabase.auth.signOut()
          throw new Error('Tu cuenta ha sido desactivada por políticas de seguridad (Derecho de Admisión). Por favor, contactá a la administración.')
        }

        const role = profile?.rol || 'client'
        
        if (role === 'admin' || role === 'cajero') {
          navigate('/caja')
        } else {
          navigate('/dashboard')
        }
      }
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'Error al iniciar sesión. Verifica tus credenciales.')
    } finally {
      setLoading(false)
    }
  }

  const handleRecuperar = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailRecuperar, {
        redirectTo: window.location.origin + '/recuperar'
      })

      if (error) throw error

      setSuccessMsg('Te enviamos un correo con las instrucciones para restablecer tu contraseña.')
      setEmailRecuperar('')
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'Error al enviar el correo de recuperación.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-tienta-crema">
      
      {/* Lateral Izquierdo: Branding Editorial (Oculto en móvil) */}
      <div className="hidden md:flex md:w-1/2 bg-tienta-teal relative items-center justify-center p-12 overflow-hidden">
        {/* Círculo dorado de fondo decorativo */}
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-tienta-gold/10 blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-tienta-gold/10 blur-3xl"></div>
        
        <div className="relative z-10 text-center max-w-lg flex flex-col items-center">
          <div className="mb-4">
            <span className="font-montserrat text-7xl font-black tracking-[0.25em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
              TIENTA
            </span>
            <div className="font-montserrat text-sm font-extrabold tracking-[0.35em] text-[#fad08c] uppercase mt-3">
              CLUB DE FIDELIDAD
            </div>
          </div>
          
          <div className="h-[2px] w-28 bg-[#fad08c]/40 my-8"></div>
          
          <p className="font-montserrat text-sm font-semibold tracking-wider text-white leading-relaxed uppercase max-w-md drop-shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            Disfrutá la cremosidad artesanal de nuestros sabores y sumá puntos con cada visita.
          </p>
        </div>
      </div>

      {/* Lateral Derecho: Formulario de Login */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-12">
        <div className="w-full max-w-md bg-white border border-black/5 rounded-3xl px-5 py-6 sm:p-10 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)]">
          
          {/* Cabecera Móvil del Logo */}
          <div className="text-center md:hidden mb-5">
            <span className="font-montserrat text-4xl font-extrabold tracking-[0.2em] text-tienta-teal">
              TIENTA
            </span>
            <div className="font-montserrat text-[10px] font-bold tracking-[0.3em] text-tienta-goldDark uppercase mt-1.5">
              CLUB DE FIDELIDAD
            </div>
          </div>

          {vista === 'login' ? (
            <div className="mb-5 hidden md:block">
              <h2 className="text-2xl font-montserrat font-extrabold tracking-wider text-tienta-teal uppercase">
                Ingresar al Club
              </h2>
              <p className="text-sm text-black/65 mt-1.5 font-semibold font-lato">
                Iniciá sesión para consultar tus puntos o registrar ventas.
              </p>
            </div>
          ) : (
            <div className="mb-5">
              <h2 className="text-2xl font-montserrat font-extrabold tracking-wider text-tienta-teal uppercase">
                Recuperar Clave
              </h2>
              <p className="text-sm text-black/65 mt-1.5 font-semibold font-lato">
                Ingresá tu correo electrónico para enviarte las instrucciones de restablecimiento.
              </p>
            </div>
          )}

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

          {vista === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal mb-2">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/50">
                    <Mail size={16} />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="ejemplo@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-tienta pl-11 py-3 text-black font-semibold text-sm"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setVista('recuperar')
                      setErrorMsg(null)
                      setSuccessMsg(null)
                    }}
                    className="text-[10px] text-tienta-goldDark hover:underline font-extrabold font-montserrat uppercase tracking-wider transition-colors duration-200 cursor-pointer"
                  >
                    ¿Olvidaste tu clave?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/50">
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-tienta pl-11 py-3 text-black font-semibold text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-tienta-gold py-3.5 flex items-center justify-center gap-2 mt-6 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>{loading ? 'Cargando...' : 'Iniciar Sesión'}</span>
                {!loading && <ArrowRight size={14} />}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRecuperar} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal mb-2">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/50">
                    <Mail size={16} />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="ejemplo@correo.com"
                    value={emailRecuperar}
                    onChange={(e) => setEmailRecuperar(e.target.value)}
                    className="input-tienta pl-11 py-3 text-black font-semibold text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-tienta-gold py-3.5 flex items-center justify-center gap-2 mt-6 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>{loading ? 'Enviando...' : 'Enviar Instrucciones'}</span>
                {!loading && <ArrowRight size={14} />}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setVista('login')
                    setErrorMsg(null)
                    setSuccessMsg(null)
                  }}
                  className="text-[10px] text-tienta-teal font-extrabold font-montserrat uppercase tracking-wider hover:underline transition-colors duration-200 cursor-pointer"
                >
                  Volver al Inicio de Sesión
                </button>
              </div>
            </form>
          )}

          {/* Registro Rápido */}
          {vista === 'login' && (
            <div className="mt-6 pt-4 border-t border-black/5 text-center">
              <p className="text-xs text-black/50">
                ¿Sos nuevo cliente?{' '}
                <Link
                  to="/registro"
                  className="text-tienta-goldDark font-semibold hover:underline tracking-wide"
                >
                  Registrate acá y sumá tus primeros puntos
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
