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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      if (data?.user) {
        const role = data.user.app_metadata?.role || 'client'
        
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-tienta-crema">
      
      {/* Lateral Izquierdo: Branding Editorial (Oculto en móvil) */}
      <div className="hidden md:flex md:w-1/2 bg-tienta-teal relative items-center justify-center p-12 overflow-hidden">
        {/* Círculo dorado de fondo decorativo */}
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-tienta-gold/10 blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-tienta-gold/10 blur-3xl"></div>
        
        <div className="relative z-10 text-center max-w-lg flex flex-col items-center">
          <div className="mb-4">
            <span className="font-montserrat text-6xl font-light tracking-[0.3em] text-white">
              TIENTA
            </span>
            <div className="font-montserrat text-xs font-semibold tracking-[0.4em] text-tienta-gold uppercase mt-2">
              CLUB DE FIDELIDAD
            </div>
          </div>
          
          <div className="h-[1px] w-24 bg-tienta-gold/30 my-8"></div>
          
          <p className="font-montserrat text-sm font-light tracking-widest text-white/80 leading-relaxed uppercase">
            Disfrutá la cremosidad artesanal de nuestros sabores y sumá puntos con cada visita.
          </p>
        </div>
      </div>

      {/* Lateral Derecho: Formulario de Login */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white border border-black/5 rounded-3xl p-8 sm:p-10 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)]">
          
          {/* Cabecera Móvil del Logo */}
          <div className="text-center md:hidden mb-8">
            <span className="font-montserrat text-4xl font-light tracking-[0.25em] text-tienta-teal">
              TIENTA
            </span>
            <div className="font-montserrat text-[9px] font-semibold tracking-[0.3em] text-tienta-gold uppercase mt-1">
              CLUB DE FIDELIDAD
            </div>
          </div>

          <div className="mb-8 hidden md:block">
            <h2 className="text-2xl font-montserrat font-extrabold tracking-wider text-tienta-teal uppercase">
              Ingresar al Club
            </h2>
            <p className="text-sm text-black/65 mt-1.5 font-semibold font-lato">
              Iniciá sesión para consultar tus puntos o registrar ventas.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-bold text-left">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5 text-left">
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
              <label className="block text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal mb-2">
                Contraseña
              </label>
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
              className="w-full btn-tienta-gold py-3.5 flex items-center justify-center gap-2 mt-8 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>{loading ? 'Cargando...' : 'Iniciar Sesión'}</span>
              {!loading && <ArrowRight size={14} />}
            </button>
          </form>

          {/* Registro Rápido */}
          <div className="mt-8 pt-6 border-t border-black/5 text-center">
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
        </div>
      </div>
    </div>
  )
}
