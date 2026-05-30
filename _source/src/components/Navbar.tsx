import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogOut, LayoutDashboard, Award, ClipboardList, Layers } from 'lucide-react'

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
        setUserRole(session.user.app_metadata?.role || 'client')
      }
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email || null)
        setUserRole(session.user.app_metadata?.role || 'client')
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
              <span className="font-montserrat text-[10px] font-extrabold tracking-[0.35em] text-tienta-goldLight uppercase -mt-0.5">
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
                  className={`font-montserrat text-sm tracking-widest font-extrabold uppercase hover:text-tienta-goldLight transition-colors duration-200 py-2 flex items-center gap-2 ${
                    location.pathname === '/caja' ? 'text-tienta-goldLight border-b-2 border-tienta-goldLight' : 'text-white/80'
                  }`}
                >
                  <Award size={16} /> Línea de Caja
                </button>
                {userRole === 'admin' && (
                  <>
                    <button
                      onClick={() => navigate('/crm')}
                      className={`font-montserrat text-sm tracking-widest font-extrabold uppercase hover:text-tienta-goldLight transition-colors duration-200 py-2 flex items-center gap-2 ${
                        location.pathname === '/crm' ? 'text-tienta-goldLight border-b-2 border-tienta-goldLight' : 'text-white/80'
                      }`}
                    >
                      <Layers size={16} /> Clientes (CRM)
                    </button>
                    <button
                      onClick={() => navigate('/admin')}
                      className={`font-montserrat text-sm tracking-widest font-extrabold uppercase hover:text-tienta-goldLight transition-colors duration-200 py-2 flex items-center gap-2 ${
                        location.pathname === '/admin' ? 'text-tienta-goldLight border-b-2 border-tienta-goldLight' : 'text-white/80'
                      }`}
                    >
                      <ClipboardList size={16} /> Panel Administrador
                    </button>
                  </>
                )}
              </>
            )}

            {userRole === 'client' && (
              <>
                <button
                  onClick={() => navigate('/dashboard')}
                  className={`font-montserrat text-sm tracking-widest font-extrabold uppercase hover:text-tienta-goldLight transition-colors duration-200 py-2 flex items-center gap-2 ${
                    location.pathname === '/dashboard' ? 'text-tienta-goldLight border-b-2 border-tienta-goldLight' : 'text-white/80'
                  }`}
                >
                  <LayoutDashboard size={16} /> Mi Tarjeta
                </button>
                <button
                  onClick={() => navigate('/movimientos')}
                  className={`font-montserrat text-sm tracking-widest font-extrabold uppercase hover:text-tienta-goldLight transition-colors duration-200 py-2 flex items-center gap-2 ${
                    location.pathname === '/movimientos' ? 'text-tienta-goldLight border-b-2 border-tienta-goldLight' : 'text-white/80'
                  }`}
                >
                  <ClipboardList size={16} /> Mis Movimientos
                </button>
              </>
            )}
          </div>

          {/* Perfil de Usuario y Logout Manual */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold tracking-wider text-white/95">
                {userEmail?.split('@')[0]}
              </span>
              <span className="text-xs font-montserrat font-bold uppercase tracking-wider text-tienta-goldLight">
                {userRole === 'admin' ? 'Administrador' : userRole === 'cajero' ? 'Cajero' : 'Socio'}
              </span>
            </div>
            
            <div className="h-8 w-px bg-white/20 hidden sm:block"></div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-tienta-goldLight text-tienta-teal px-5 py-2.5 rounded-full font-montserrat uppercase tracking-[0.12em] text-xs font-extrabold hover:bg-white hover:text-tienta-teal transition-all duration-300 shadow-md active:scale-95 cursor-pointer"
              title="Cerrar turno / sesión"
            >
              <LogOut size={14} />
              <span className="hidden md:inline">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>

      {/* Barra de navegación inferior premium para móviles (Solo para pantallas chicas < md) */}
      {userRole && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-tienta-teal text-white border-t border-white/10 z-45 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] flex justify-around items-center py-2.5 px-4 backdrop-blur-md bg-tienta-teal/95 safe-bottom">
          {userRole === 'client' && (
            <>
              <button
                onClick={() => navigate('/dashboard')}
                className={`flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors duration-200 py-1 px-3 ${
                  location.pathname === '/dashboard' ? 'text-tienta-goldLight font-bold scale-105' : 'text-white/70 hover:text-white'
                }`}
              >
                <LayoutDashboard size={20} />
                <span className="text-[9px] font-montserrat uppercase tracking-wider font-extrabold">Mi Tarjeta</span>
              </button>
              <button
                onClick={() => navigate('/movimientos')}
                className={`flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors duration-200 py-1 px-3 ${
                  location.pathname === '/movimientos' ? 'text-tienta-goldLight font-bold scale-105' : 'text-white/70 hover:text-white'
                }`}
              >
                <ClipboardList size={20} />
                <span className="text-[9px] font-montserrat uppercase tracking-wider font-extrabold">Movimientos</span>
              </button>
            </>
          )}

          {(userRole === 'admin' || userRole === 'cajero') && (
            <>
              <button
                onClick={() => navigate('/caja')}
                className={`flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors duration-200 py-1 px-3 ${
                  location.pathname === '/caja' ? 'text-tienta-goldLight font-bold scale-105' : 'text-white/70 hover:text-white'
                }`}
              >
                <Award size={20} />
                <span className="text-[9px] font-montserrat uppercase tracking-wider font-extrabold">Caja</span>
              </button>
              {userRole === 'admin' && (
                <>
                  <button
                    onClick={() => navigate('/crm')}
                    className={`flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors duration-200 py-1 px-3 ${
                      location.pathname === '/crm' ? 'text-tienta-goldLight font-bold scale-105' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    <Layers size={20} />
                    <span className="text-[9px] font-montserrat uppercase tracking-wider font-extrabold">CRM</span>
                  </button>
                  <button
                    onClick={() => navigate('/admin')}
                    className={`flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors duration-200 py-1 px-3 ${
                      location.pathname === '/admin' ? 'text-tienta-goldLight font-bold scale-105' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    <ClipboardList size={20} />
                    <span className="text-[9px] font-montserrat uppercase tracking-wider font-extrabold">Panel</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </nav>
  )
}
