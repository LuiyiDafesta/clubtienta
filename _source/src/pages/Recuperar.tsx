import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Lock, ArrowRight, CheckCircle2 } from 'lucide-react'
import { enviarEmailTransaccional } from '../lib/emails'

export default function Recuperar() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    // Verificar si hay una sesión activa (ya que Supabase inicia sesión automáticamente al hacer clic en el link de recuperación)
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setErrorMsg('El enlace de recuperación es inválido, ha expirado o ya fue utilizado.')
      }
    }
    checkSession()
  }, [])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const { error } = await supabase.auth.updateUser({ password: password })
      if (error) throw error

      // Enviar correo transaccional de cambio de clave
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          enviarEmailTransaccional('cambio_contrasena', user.id, {})
        }
      } catch (e) {
        console.error('Error al enviar email de cambio de contraseña:', e)
      }

      setSuccessMsg('¡Contraseña restablecida con éxito! Iniciando sesión...')
      setTimeout(() => {
        navigate('/dashboard')
      }, 2000)
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'Error al actualizar la contraseña.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-tienta-crema p-6">
      <div className="w-full max-w-md bg-white border border-black/5 rounded-3xl p-8 sm:p-10 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] text-left font-lato">
        <div className="mb-8">
          <h2 className="text-2xl font-montserrat font-extrabold tracking-wider text-tienta-teal uppercase">
            Nueva Contraseña
          </h2>
          <p className="text-sm text-black/65 mt-1.5 font-semibold">
            Ingresá tu nueva clave para restablecer el acceso a tu cuenta.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-bold">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-100 text-green-600 text-sm font-bold flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-5">
          <div>
            <label className="block text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal mb-2">
              Nueva Contraseña
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/50">
                <Lock size={16} />
              </span>
              <input
                type="password"
                required
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-tienta pl-11 py-3 text-black font-semibold text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal mb-2">
              Confirmar Nueva Contraseña
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/50">
                <Lock size={16} />
              </span>
              <input
                type="password"
                required
                placeholder="Repetir clave"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-tienta pl-11 py-3 text-black font-semibold text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !!successMsg}
            className="w-full btn-tienta-gold py-3.5 flex items-center justify-center gap-2 mt-8 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>{loading ? 'Guardando...' : 'Restablecer Clave'}</span>
            {!loading && <ArrowRight size={14} />}
          </button>
        </form>
      </div>
    </div>
  )
}
