import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Registro from './pages/Registro'
import Recuperar from './pages/Recuperar'
import Caja from './pages/Caja'
import Admin from './pages/Admin'
import Crm from './pages/Crm'
import Dashboard from './pages/Dashboard'
import Movimientos from './pages/Movimientos'
import { RefreshCw } from 'lucide-react'

// Componente para proteger rutas según Autenticación y Rol
interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: string[]
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setAuthenticated(true)
        setUserRole(session.user.app_metadata?.role || 'client')
      } else {
        setAuthenticated(false)
        setUserRole(null)
      }
      setLoading(false)
    }
    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-tienta-crema">
        <div className="flex items-center gap-2 text-tienta-teal text-sm font-semibold tracking-wider font-montserrat">
          <RefreshCw className="animate-spin" size={16} /> Verificando accesos...
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return <Navigate to="/" replace />
  }

  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    // Si no tiene permiso para esta ruta, redirigir a su portal correspondiente
    if (userRole === 'admin' || userRole === 'cajero') {
      return <Navigate to="/caja" replace />
    } else {
      return <Navigate to="/dashboard" replace />
    }
  }

  return <>{children}</>
}

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-tienta-crema">
        {/* Barra de Navegación común */}
        <Navbar />
        
        {/* Vistas Principales */}
        <main className="flex-1">
          <Routes>
            {/* Rutas Públicas */}
            <Route path="/" element={<Login />} />
            <Route path="/registro" element={<Registro />} />
            <Route path="/recuperar" element={<Recuperar />} />

            {/* Rutas Protegidas - Línea de Caja (Cajeros y Admins) */}
            <Route
              path="/caja"
              element={
                <ProtectedRoute allowedRoles={['admin', 'cajero']}>
                  <Caja />
                </ProtectedRoute>
              }
            />

            {/* Rutas Protegidas - Panel de Administración (Solo Admins) */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Admin />
                </ProtectedRoute>
              }
            />

            {/* Rutas Protegidas - CRM Clientes (Admins y Cajeros) */}
            <Route
              path="/crm"
              element={
                <ProtectedRoute allowedRoles={['admin', 'cajero']}>
                  <Crm />
                </ProtectedRoute>
              }
            />

            {/* Rutas Protegidas - Portal de Cliente (Socio) */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['client']}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/movimientos"
              element={
                <ProtectedRoute allowedRoles={['client']}>
                  <Movimientos />
                </ProtectedRoute>
              }
            />

            {/* Redirección por defecto */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
