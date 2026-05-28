import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogOut, LayoutDashboard, Award, ClipboardList } from 'lucide-react'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    async function getUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUserEmail(session.user.email || null)
        setUserRole(session.user.app_metadata?.role || null)
      }
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email || null)
        setUserRole(session.user.app_metadata?.role || null)
      } else {
        setUserEmail(null)
        setUserRole(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  // No mostrar navbar en login y registro
  if (location.pathname === '/' || location.pathname === '/registro') {
    return null
  }

  return (
    <nav className="bg-tienta-teal text-white border-b border-white/10 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo y Branding */}
          <div className="flex items-center cursor-pointer" onClick={() => {
            if (userRole === 'admin' || userRole === 'cajero') {
              navigate('/caja')
            } else {
              navigate('/dashboard')
            }
          }}>
            <div className="flex flex-col">
              <span className="font-montserrat text-2xl font-light tracking-[0.25em] text-white">
                TIENTA
              </span>
              <span className="font-montserrat text-[9px] font-semibold tracking-[0.35em] text-tienta-gold uppercase -mt-1">
                CLUB DE PUNTOS
              </span>
            </div>
          </div>

          {/* Menú de Navegación según Rol */}
          <div className="hidden md:flex items-center space-x-8">
            {(userRole === 'admin' || userRole === 'cajero') && (
              <>
                <button
                  onClick={() => navigate('/caja')}
                  className={`font-montserrat text-xs tracking-widest font-semibold uppercase hover:text-tienta-gold transition-colors duration-200 py-2 flex items-center gap-2 ${
                    location.pathname === '/caja' ? 'text-tienta-gold border-b border-tienta-gold' : 'text-white/80'
                  }`}
                >
                  <Award size={14} /> Línea de Caja
                </button>
                {userRole === 'admin' && (
                  <button
                    onClick={() => navigate('/admin')}
                    className={`font-montserrat text-xs tracking-widest font-semibold uppercase hover:text-tienta-gold transition-colors duration-200 py-2 flex items-center gap-2 ${
                      location.pathname === '/admin' ? 'text-tienta-gold border-b border-tienta-gold' : 'text-white/80'
                    }`}
                  >
                    <ClipboardList size={14} /> Panel Administrador
                  </button>
                )}
              </>
            )}

            {userRole === 'client' && (
              <>
                <button
                  onClick={() => navigate('/dashboard')}
                  className={`font-montserrat text-xs tracking-widest font-semibold uppercase hover:text-tienta-gold transition-colors duration-200 py-2 flex items-center gap-2 ${
                    location.pathname === '/dashboard' ? 'text-tienta-gold border-b border-tienta-gold' : 'text-white/80'
                  }`}
                >
                  <LayoutDashboard size={14} /> Mi Tarjeta
                </button>
              </>
            )}
          </div>

          {/* Perfil de Usuario y Logout Manual */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold tracking-wider text-white/90">
                {userEmail?.split('@')[0]}
              </span>
              <span className="text-[10px] font-montserrat uppercase tracking-widest text-tienta-gold">
                {userRole === 'admin' ? 'Administrador' : userRole === 'cajero' ? 'Cajero' : 'Socio'}
              </span>
            </div>
            
            <div className="h-8 w-px bg-white/20 hidden sm:block"></div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-tienta-gold text-white px-4 py-2 rounded-full font-montserrat uppercase tracking-[0.12em] text-[10px] font-semibold hover:bg-tienta-tealDark hover:border-tienta-gold hover:border transition-all duration-300 shadow-sm active:scale-95 cursor-pointer"
              title="Cerrar turno / sesión"
            >
              <LogOut size={12} />
              <span className="hidden md:inline">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
