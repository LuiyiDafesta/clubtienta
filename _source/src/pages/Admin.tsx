import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  Settings, Gift, Percent, ShieldCheck, Plus, Trash2, 
  Calendar, RefreshCw, Layers, Edit, BarChart3
} from 'lucide-react'

// Interfaces
interface Premio {
  id?: string
  nombre: string
  descripcion: string
  puntos_requeridos: number
  imagen_url: string
  stock: number
  activo: boolean
  niveles_aplicables?: string[]
}

interface Promocion {
  id?: string
  titulo: string
  descripcion: string
  descuento_porcentaje: number | null
  dias_vigencia: string[]
  niveles_aplicables: string[] | null
  imagen_url: string
  activo: boolean
}

interface TransaccionAuditoria {
  id: string
  tipo: string
  importe: number | null
  puntos: number
  ticket_factura: string | null
  detalle: string
  created_at: string
  cliente: {
    nombre: string
    apellido: string
    dni: string
  }
  creador?: {
    nombre: string
    apellido: string
    email: string
  } | null
}

const compressImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.8): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(file)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              resolve(file)
            }
          },
          'image/jpeg',
          quality
        )
      }
      img.onerror = (err) => reject(err)
    }
    reader.onerror = (err) => reject(err)
  })
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'config' | 'premios' | 'promos' | 'auditoria' | 'staff' | 'metricas'>('config')

  // --- CONFIGURACIÓN ESTADOS ---
  const [valorPunto, setValorPunto] = useState('200')
  const [expiracionMeses, setExpiracionMeses] = useState('0')
  const [puntosBienvenida, setPuntosBienvenida] = useState('50')
  const [puntosReferido, setPuntosReferido] = useState('100')
  const [webhookN8n, setWebhookN8n] = useState('')
  const [limiteGold, setLimiteGold] = useState('0')
  const [limitePlatinum, setLimitePlatinum] = useState('20000')
  const [bonoGold, setBonoGold] = useState('0')
  const [bonoPlatinum, setBonoPlatinum] = useState('20')
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [successConfig, setSuccessConfig] = useState(false)

  // --- STAFF ESTADOS ---
  interface StaffMember {
    id: string
    nombre: string
    apellido: string
    email: string
    rol: 'admin' | 'cajero'
    created_at: string
  }
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [staffNombre, setStaffNombre] = useState('')
  const [staffApellido, setStaffApellido] = useState('')
  const [staffEmail, setStaffEmail] = useState('')
  const [staffPassword, setStaffPassword] = useState('')
  const [staffRol, setStaffRol] = useState<'cajero' | 'admin'>('cajero')
  const [loadingCreateStaff, setLoadingCreateStaff] = useState(false)
  const [successCreateStaff, setSuccessCreateStaff] = useState(false)
  const [errorCreateStaff, setErrorCreateStaff] = useState<string | null>(null)
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null)

  // --- PREMIOS ESTADOS ---
  const [premios, setPremios] = useState<Premio[]>([])
  const [loadingPremios, setLoadingPremios] = useState(false)
  const [nuevoPremio, setNuevoPremio] = useState<Premio>({
    nombre: '', descripcion: '', puntos_requeridos: 100, imagen_url: '', stock: -1, activo: true, niveles_aplicables: ['Gold', 'Platinum']
  })
  const [editingPremioId, setEditingPremioId] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  // --- PROMOS ESTADOS ---
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [loadingPromos, setLoadingPromos] = useState(false)
  const [nuevaPromo, setNuevaPromo] = useState<Promocion>({
    titulo: '', descripcion: '', descuento_porcentaje: null, dias_vigencia: [], niveles_aplicables: [], imagen_url: '', activo: true
  })
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null)

  // --- AUDITORÍA ESTADOS ---
  const [auditorias, setAuditorias] = useState<TransaccionAuditoria[]>([])
  const [loadingAuditoria, setLoadingAuditoria] = useState(false)
  const [filtroDni, setFiltroDni] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroTicket, setFiltroTicket] = useState('')

  // --- METRICAS ESTADOS ---
  interface CajeroMetrica {
    id: string
    nombre: string
    apellido: string
    email: string
    rol: string
    totalVentas: number
    totalPuntos: number
    totalCanjes: number
    totalVentasHoy: number
  }
  const [metricasCajeros, setMetricasCajeros] = useState<CajeroMetrica[]>([])
  const [globalStats, setGlobalStats] = useState({ totalVentas: 0, totalPuntos: 0, totalCanjes: 0, totalVentasHoy: 0 })
  const [loadingMetricas, setLoadingMetricas] = useState(false)

  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  const nivelesClub = ['Gold', 'Platinum']

  useEffect(() => {
    fetchConfiguraciones()
    fetchPremios()
    fetchPromociones()
    fetchAuditoria()
  }, [])

  useEffect(() => {
    if (activeTab === 'staff') {
      fetchStaff()
    } else if (activeTab === 'metricas') {
      fetchMetricas()
    }
  }, [activeTab])

  const fetchMetricas = async () => {
    setLoadingMetricas(true)
    try {
      const { data: staffData } = await supabase
        .from('profiles')
        .select('id, nombre, apellido, email, rol')
        .in('rol', ['admin', 'cajero'])

      const { data: txData } = await supabase
        .from('transacciones')
        .select('tipo, importe, puntos, creado_por, created_at')

      if (staffData && txData) {
        const hoy = new Date()
        // Principio del día comercial flotante (5:00 AM) en hora local
        let startOfTodayDate: Date
        if (hoy.getHours() < 5) {
          const ayer = new Date(hoy)
          ayer.setDate(hoy.getDate() - 1)
          startOfTodayDate = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate(), 5, 0, 0)
        } else {
          startOfTodayDate = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 5, 0, 0)
        }
        const startOfToday = startOfTodayDate.getTime()

        let totalVentas = 0
        let totalPuntos = 0
        let totalCanjes = 0
        let totalVentasHoy = 0

        // Calcular globales
        txData.forEach(tx => {
          const txTime = new Date(tx.created_at).getTime()
          const esHoy = txTime >= startOfToday

          if (tx.tipo === 'carga_compra') {
            const imp = Number(tx.importe) || 0
            totalVentas += imp
            if (esHoy) totalVentasHoy += imp
          }
          if (tx.puntos > 0) {
            totalPuntos += tx.puntos
          }
          if (tx.tipo === 'canje_premio') {
            totalCanjes += 1
          }
        })

        setGlobalStats({ totalVentas, totalPuntos, totalCanjes, totalVentasHoy })

        // Calcular por operador
        const met: CajeroMetrica[] = staffData.map(m => {
          let cVentas = 0
          let cPuntos = 0
          let cCanjes = 0
          let cVentasHoy = 0

          txData.forEach(tx => {
            if (tx.creado_por === m.id) {
              const txTime = new Date(tx.created_at).getTime()
              const esHoy = txTime >= startOfToday

              if (tx.tipo === 'carga_compra') {
                const imp = Number(tx.importe) || 0
                cVentas += imp
                if (esHoy) cVentasHoy += imp
              }
              if (tx.puntos > 0) {
                cPuntos += tx.puntos
              }
              if (tx.tipo === 'canje_premio') {
                cCanjes += 1
              }
            }
          })

          return {
            id: m.id,
            nombre: m.nombre,
            apellido: m.apellido,
            email: m.email,
            rol: m.rol,
            totalVentas: cVentas,
            totalPuntos: cPuntos,
            totalCanjes: cCanjes,
            totalVentasHoy: cVentasHoy
          }
        })

        setMetricasCajeros(met)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingMetricas(false)
    }
  }

  // --- 1. CONFIGURACIÓN LOGICA ---
  const fetchConfiguraciones = async () => {
    const { data } = await supabase.from('configuraciones').select('*')
    if (data) {
      const p = data.find(c => c.clave === 'valor_punto')
      const e = data.find(c => c.clave === 'expiracion_meses')
      const pb = data.find(c => c.clave === 'puntos_bienvenida')
      const pr = data.find(c => c.clave === 'puntos_referido')
      const wh = data.find(c => c.clave === 'webhook_n8n')
      const lg = data.find(c => c.clave === 'limite_consumo_gold')
      const lp = data.find(c => c.clave === 'limite_consumo_platinum')
      const bg = data.find(c => c.clave === 'bono_puntos_gold')
      const bp = data.find(c => c.clave === 'bono_puntos_platinum')
      
      if (p) setValorPunto(p.valor)
      if (e) setExpiracionMeses(e.valor)
      if (pb) setPuntosBienvenida(pb.valor)
      if (pr) setPuntosReferido(pr.valor)
      if (wh) setWebhookN8n(wh.valor)
      if (lg) setLimiteGold(lg.valor)
      if (lp) setLimitePlatinum(lp.valor)
      if (bg) setBonoGold(bg.valor)
      if (bp) setBonoPlatinum(bp.valor)
    }
  }

  const handleGuardarConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingConfig(true)
    setSuccessConfig(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const keys = [
        { clave: 'valor_punto', valor: valorPunto },
        { clave: 'expiracion_meses', valor: expiracionMeses },
        { clave: 'puntos_bienvenida', valor: puntosBienvenida },
        { clave: 'puntos_referido', valor: puntosReferido },
        { clave: 'webhook_n8n', valor: webhookN8n },
        { clave: 'limite_consumo_gold', valor: limiteGold },
        { clave: 'limite_consumo_platinum', valor: limitePlatinum },
        { clave: 'bono_puntos_gold', valor: bonoGold },
        { clave: 'bono_puntos_platinum', valor: bonoPlatinum }
      ]

      for (const item of keys) {
        const { error } = await supabase.from('configuraciones').upsert({
          clave: item.clave,
          valor: item.valor,
          updated_by: session?.user?.id
        }, { onConflict: 'clave' })
        
        if (error) throw error
      }

      setSuccessConfig(true)
      setTimeout(() => setSuccessConfig(false), 3000)
    } catch (err: any) {
      console.error(err)
      alert('Error al guardar configuraciones: ' + err.message)
    } finally {
      setLoadingConfig(false)
    }
  }

  // --- 2. PREMIOS LOGICA ---
  const fetchPremios = async () => {
    setLoadingPremios(true)
    const { data } = await supabase.from('premios').select('*').order('created_at', { ascending: false })
    if (data) setPremios(data)
    setLoadingPremios(false)
  }

  const handleCrearPremio = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingPremioId) {
        const { error } = await supabase
          .from('premios')
          .update(nuevoPremio)
          .eq('id', editingPremioId)
        if (error) throw error
        setEditingPremioId(null)
      } else {
        const { error } = await supabase.from('premios').insert(nuevoPremio)
        if (error) throw error
      }
      
      setNuevoPremio({ nombre: '', descripcion: '', puntos_requeridos: 100, imagen_url: '', stock: -1, activo: true, niveles_aplicables: ['Gold', 'Platinum'] })
      fetchPremios()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleIniciarEditarPremio = (premio: Premio) => {
    setEditingPremioId(premio.id || null)
    setNuevoPremio({
      nombre: premio.nombre,
      descripcion: premio.descripcion,
      puntos_requeridos: premio.puntos_requeridos,
      imagen_url: premio.imagen_url || '',
      stock: premio.stock,
      activo: premio.activo,
      niveles_aplicables: premio.niveles_aplicables || ['Gold', 'Platinum']
    })
  }

  const handleCancelarEditarPremio = () => {
    setEditingPremioId(null)
    setNuevoPremio({ nombre: '', descripcion: '', puntos_requeridos: 100, imagen_url: '', stock: -1, activo: true, niveles_aplicables: ['Gold', 'Platinum'] })
  }

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const compressedBlob = await compressImage(file, 800, 800, 0.8)
      const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' })

      const fileExt = 'jpg'
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
      
      const { error } = await supabase.storage
        .from('premios')
        .upload(fileName, compressedFile, {
          contentType: 'image/jpeg',
          upsert: true
        })

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('premios')
        .getPublicUrl(fileName)

      setNuevoPremio(prev => ({ ...prev, imagen_url: publicUrl }))
    } catch (err: any) {
      console.error(err)
      alert('Error al subir imagen: ' + err.message)
    } finally {
      setUploadingImage(false)
    }
  }

  const toggleNivelAplicablePremio = (nivel: string) => {
    const current = nuevoPremio.niveles_aplicables || []
    if (current.includes(nivel)) {
      setNuevoPremio({ ...nuevoPremio, niveles_aplicables: current.filter(n => n !== nivel) })
    } else {
      setNuevoPremio({ ...nuevoPremio, niveles_aplicables: [...current, nivel] })
    }
  }

  const handleEliminarPremio = async (id: string) => {
    if (!window.confirm('¿Desea eliminar o desactivar este premio?')) return
    await supabase.from('premios').delete().eq('id', id)
    fetchPremios()
  }

  const handleActivarPremio = async (id: string, activo: boolean) => {
    await supabase.from('premios').update({ activo }).eq('id', id)
    fetchPremios()
  }

  // --- 3. PROMOS LOGICA ---
  const fetchPromociones = async () => {
    setLoadingPromos(true)
    const { data } = await supabase.from('promociones').select('*').order('created_at', { ascending: false })
    if (data) setPromociones(data)
    setLoadingPromos(false)
  }

  const handleCrearPromo = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingPromoId) {
        const { error } = await supabase
          .from('promociones')
          .update(nuevaPromo)
          .eq('id', editingPromoId)
        if (error) throw error
        setEditingPromoId(null)
      } else {
        const { error } = await supabase.from('promociones').insert(nuevaPromo)
        if (error) throw error
      }

      setNuevaPromo({ titulo: '', descripcion: '', descuento_porcentaje: null, dias_vigencia: [], niveles_aplicables: [], imagen_url: '', activo: true })
      fetchPromociones()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleIniciarEditarPromo = (promo: Promocion) => {
    setEditingPromoId(promo.id || null)
    setNuevaPromo({
      titulo: promo.titulo,
      descripcion: promo.descripcion,
      descuento_porcentaje: promo.descuento_porcentaje,
      dias_vigencia: promo.dias_vigencia || [],
      niveles_aplicables: promo.niveles_aplicables || [],
      imagen_url: promo.imagen_url || '',
      activo: promo.activo
    })
  }

  const handleCancelarEditarPromo = () => {
    setEditingPromoId(null)
    setNuevaPromo({ titulo: '', descripcion: '', descuento_porcentaje: null, dias_vigencia: [], niveles_aplicables: [], imagen_url: '', activo: true })
  }

  const handleEliminarPromo = async (id: string) => {
    if (!window.confirm('¿Desea eliminar esta promoción?')) return
    await supabase.from('promociones').delete().eq('id', id)
    fetchPromociones()
  }

  const handleActivarPromo = async (id: string, activo: boolean) => {
    await supabase.from('promociones').update({ activo }).eq('id', id)
    fetchPromociones()
  }

  const toggleDiaVigencia = (dia: string) => {
    const current = [...nuevaPromo.dias_vigencia]
    if (current.includes(dia)) {
      setNuevaPromo({ ...nuevaPromo, dias_vigencia: current.filter(d => d !== dia) })
    } else {
      setNuevaPromo({ ...nuevaPromo, dias_vigencia: [...current, dia] })
    }
  }

  const toggleNivelAplicable = (nivel: string) => {
    const current = nuevaPromo.niveles_aplicables || []
    if (current.includes(nivel)) {
      setNuevaPromo({ ...nuevaPromo, niveles_aplicables: current.filter(n => n !== nivel) })
    } else {
      setNuevaPromo({ ...nuevaPromo, niveles_aplicables: [...current, nivel] })
    }
  }

  // --- 5. STAFF LOGICA ---
  const fetchStaff = async () => {
    setLoadingStaff(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nombre, apellido, email, rol, created_at')
        .in('rol', ['cajero', 'admin'])
        .order('created_at', { ascending: false })
      if (error) throw error
      if (data) setStaff(data as any)
    } catch (err) {
      console.error('Error fetching staff members:', err)
    } finally {
      setLoadingStaff(false)
    }
  }

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingCreateStaff(true)
    setErrorCreateStaff(null)
    setSuccessCreateStaff(false)

    try {
      if (editingStaffId) {
        // --- MODO EDICIÓN ---
        const { error: updateError } = await supabase.rpc('actualizar_operador_por_admin', {
          p_usuario_id: editingStaffId,
          p_nombre: staffNombre,
          p_apellido: staffApellido,
          p_email: staffEmail,
          p_rol: staffRol
        })

        if (updateError) throw updateError

        setSuccessCreateStaff(true)
        setEditingStaffId(null)
        setStaffNombre('')
        setStaffApellido('')
        setStaffEmail('')
        setStaffPassword('')
        setStaffRol('cajero')
        fetchStaff()
      } else {
        // --- MODO CREACIÓN ---
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error('Variables de entorno de Supabase no configuradas.')
        }

        // Crear cliente temporal para no desloguear al admin
        const { createClient } = await import('@supabase/supabase-js')
        const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        })

        // Registrar usuario en auth
        const { data: authData, error: authError } = await tempClient.auth.signUp({
          email: staffEmail,
          password: staffPassword,
          options: {
            data: {
              nombre: staffNombre,
              apellido: staffApellido
            }
          }
        })

        if (authError) throw authError
        if (!authData?.user) {
          throw new Error('No se pudo crear el usuario en auth.')
        }

        const newUserId = authData.user.id

        // Crear perfil en public.profiles sin DNI (null)
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: newUserId,
            dni: null,
            nombre: staffNombre,
            apellido: staffApellido,
            email: staffEmail,
            rol: staffRol,
            puntos_actuales: 0,
            nivel: 'Gold'
          })

        if (profileError) throw profileError

        // Invocar RPC para asignar el rol en auth.users
        const { error: rpcError } = await supabase.rpc('establecer_rol_usuario', {
          p_usuario_id: newUserId,
          p_rol: staffRol
        })

        if (rpcError) throw rpcError

        setSuccessCreateStaff(true)
        setStaffNombre('')
        setStaffApellido('')
        setStaffEmail('')
        setStaffPassword('')
        fetchStaff()
      }
    } catch (err: any) {
      console.error(err)
      setErrorCreateStaff(err.message || 'Error al procesar la solicitud.')
    } finally {
      setLoadingCreateStaff(false)
    }
  }

  const handleIniciarEditarStaff = (member: StaffMember) => {
    setEditingStaffId(member.id)
    setStaffNombre(member.nombre)
    setStaffApellido(member.apellido)
    setStaffEmail(member.email)
    setStaffRol(member.rol)
    setStaffPassword('') // Opcional / No requerido durante edición
    setErrorCreateStaff(null)
    setSuccessCreateStaff(false)
  }

  const handleCancelarEditarStaff = () => {
    setEditingStaffId(null)
    setStaffNombre('')
    setStaffApellido('')
    setStaffEmail('')
    setStaffPassword('')
    setStaffRol('cajero')
    setErrorCreateStaff(null)
    setSuccessCreateStaff(false)
  }

  const handleEliminarOperador = async (userId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este operador? Se eliminará por completo del sistema.')) return
    try {
      const { error } = await supabase.rpc('eliminar_operador_por_admin', {
        p_usuario_id: userId
      })
      if (error) throw error
      fetchStaff()
    } catch (err: any) {
      console.error(err)
      alert('Error al eliminar operador: ' + err.message)
    }
  }

  // --- 4. AUDITORÍA LOGICA ---
  const fetchAuditoria = async () => {
    setLoadingAuditoria(true)
    try {
      let queryBuilder = supabase
        .from('transacciones')
        .select(`
          id, tipo, importe, puntos, ticket_factura, detalle, created_at,
          cliente:profiles!cliente_id(nombre, apellido, dni),
          creador:profiles!creado_por(nombre, apellido, email)
        `)
        .order('created_at', { ascending: false })

      if (filtroTipo) {
        queryBuilder = queryBuilder.eq('tipo', filtroTipo)
      }
      if (filtroTicket) {
        queryBuilder = queryBuilder.ilike('ticket_factura', `%${filtroTicket}%`)
      }

      const { data, error } = await queryBuilder

      if (error) throw error

      let filtrados = (data as any) || []
      
      // Filtro de DNI manual por el lado de cliente (Supabase FKey nested search)
      if (filtroDni.trim()) {
        const cleanDni = filtroDni.replace(/\D/g, '')
        filtrados = filtrados.filter((t: any) => t.cliente?.dni.includes(cleanDni))
      }

      setAuditorias(filtrados)
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoadingAuditoria(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-left">
      
      <div className="mb-8">
        <h1 className="text-3xl font-montserrat font-extrabold text-tienta-teal uppercase tracking-wider">
          Panel de Administración
        </h1>
        <p className="text-sm text-black/75 font-lato mt-1.5 font-medium">
          Configurá los parámetros, premios, promociones y auditá las transacciones del Club.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-black/10 mb-8 space-x-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('config')}
          className={`pb-4 text-sm font-montserrat uppercase tracking-wider font-bold cursor-pointer transition-all shrink-0 ${
            activeTab === 'config' ? 'border-b-2 border-tienta-gold text-tienta-teal' : 'text-black/60 hover:text-black/90'
          }`}
        >
          <span className="flex items-center gap-2"><Settings size={16} /> Configuración</span>
        </button>
        <button
          onClick={() => setActiveTab('premios')}
          className={`pb-4 text-sm font-montserrat uppercase tracking-wider font-bold cursor-pointer transition-all shrink-0 ${
            activeTab === 'premios' ? 'border-b-2 border-tienta-gold text-tienta-teal' : 'text-black/60 hover:text-black/90'
          }`}
        >
          <span className="flex items-center gap-2"><Gift size={16} /> Catálogo de Premios</span>
        </button>
        <button
          onClick={() => setActiveTab('promos')}
          className={`pb-4 text-sm font-montserrat uppercase tracking-wider font-bold cursor-pointer transition-all shrink-0 ${
            activeTab === 'promos' ? 'border-b-2 border-tienta-gold text-tienta-teal' : 'text-black/60 hover:text-black/90'
          }`}
        >
          <span className="flex items-center gap-2"><Percent size={16} /> Promociones</span>
        </button>
        <button
          onClick={() => setActiveTab('auditoria')}
          className={`pb-4 text-sm font-montserrat uppercase tracking-wider font-bold cursor-pointer transition-all shrink-0 ${
            activeTab === 'auditoria' ? 'border-b-2 border-tienta-gold text-tienta-teal' : 'text-black/60 hover:text-black/90'
          }`}
        >
          <span className="flex items-center gap-2"><ShieldCheck size={16} /> Auditoría General</span>
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`pb-4 text-sm font-montserrat uppercase tracking-wider font-bold cursor-pointer transition-all shrink-0 ${
            activeTab === 'staff' ? 'border-b-2 border-tienta-gold text-tienta-teal' : 'text-black/60 hover:text-black/90'
          }`}
        >
          <span className="flex items-center gap-2"><Layers size={16} /> Operadores y Staff</span>
        </button>
        <button
          onClick={() => setActiveTab('metricas')}
          className={`pb-4 text-sm font-montserrat uppercase tracking-wider font-bold cursor-pointer transition-all shrink-0 ${
            activeTab === 'metricas' ? 'border-b-2 border-tienta-gold text-tienta-teal' : 'text-black/60 hover:text-black/90'
          }`}
        >
          <span className="flex items-center gap-2"><BarChart3 size={16} /> Estadísticas de Caja</span>
        </button>
      </div>

      {/* TAB CONTENT: CONFIGURACIÓN */}
      {activeTab === 'config' && (
        <div className="bg-white border border-black/5 rounded-3xl p-6 sm:p-8 shadow-sm max-w-2xl">
          <h2 className="text-lg font-montserrat font-bold tracking-wider text-tienta-teal uppercase mb-6 flex items-center gap-2">
            <Settings size={18} /> Parámetros del Club
          </h2>

          {successConfig && (
            <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-100 text-green-600 text-xs flex items-center gap-2">
              <ShieldCheck size={16} />
              <span>Configuración guardada correctamente en Supabase.</span>
            </div>
          )}

          <form onSubmit={handleGuardarConfig} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-montserrat uppercase tracking-wider font-bold text-tienta-teal mb-2">
                  Valor de 1 Punto ($)
                </label>
                <input
                  type="number"
                  required
                  value={valorPunto}
                  onChange={(e) => setValorPunto(e.target.value)}
                  className="input-tienta text-black py-3 text-base font-semibold"
                />
                <span className="text-xs text-black/65 mt-1.5 block leading-relaxed font-medium">
                  Cantidad de pesos consumidos para sumar 1 punto en sucursal.
                </span>
              </div>

              <div>
                <label className="block text-sm font-montserrat uppercase tracking-wider font-bold text-tienta-teal mb-2">
                  Expiración de Puntos (Meses)
                </label>
                <input
                  type="number"
                  required
                  value={expiracionMeses}
                  onChange={(e) => setExpiracionMeses(e.target.value)}
                  className="input-tienta text-black py-3 text-base font-semibold"
                />
                <span className="text-xs text-black/65 mt-1.5 block leading-relaxed font-medium">
                  Ingresá 0 para que los puntos nunca expiren (vencimiento desactivado).
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-black/5">
              <div>
                <label className="block text-sm font-montserrat uppercase tracking-wider font-bold text-tienta-teal mb-2">
                  Puntos de Bienvenida 🎁
                </label>
                <input
                  type="number"
                  required
                  value={puntosBienvenida}
                  onChange={(e) => setPuntosBienvenida(e.target.value)}
                  className="input-tienta text-black py-3 text-base font-semibold"
                />
                <span className="text-xs text-black/65 mt-1.5 block leading-relaxed font-medium">
                  Puntos acreditados automáticamente al registrarse en el Club.
                </span>
              </div>

              <div>
                <label className="block text-sm font-montserrat uppercase tracking-wider font-bold text-tienta-teal mb-2">
                  Puntos por Referir Amigos ⭐
                </label>
                <input
                  type="number"
                  required
                  value={puntosReferido}
                  onChange={(e) => setPuntosReferido(e.target.value)}
                  className="input-tienta text-black py-3 text-base font-semibold"
                />
                <span className="text-xs text-black/65 mt-1.5 block leading-relaxed font-medium">
                  Bono acreditado al socio que recomendó cuando el amigo se asocia.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-black/5">
              <div>
                <label className="block text-sm font-montserrat uppercase tracking-wider font-bold text-tienta-teal mb-2">
                  Límite de Consumo - Gold ($) 🏆
                </label>
                <input
                  type="number"
                  required
                  value={limiteGold}
                  onChange={(e) => setLimiteGold(e.target.value)}
                  className="input-tienta text-black py-3 text-base font-semibold"
                />
                <span className="text-xs text-black/65 mt-1.5 block leading-relaxed font-medium">
                  Pesos consumidos acumulados necesarios para la membresía Gold (inicial).
                </span>
              </div>

              <div>
                <label className="block text-sm font-montserrat uppercase tracking-wider font-bold text-tienta-teal mb-2">
                  Límite de Consumo - Platinum ($) 💎
                </label>
                <input
                  type="number"
                  required
                  value={limitePlatinum}
                  onChange={(e) => setLimitePlatinum(e.target.value)}
                  className="input-tienta text-black py-3 text-base font-semibold"
                />
                <span className="text-xs text-black/65 mt-1.5 block leading-relaxed font-medium">
                  Pesos consumidos acumulados necesarios para ascender a Platinum.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-black/5">
              <div>
                <label className="block text-sm font-montserrat uppercase tracking-wider font-bold text-tienta-teal mb-2">
                  Bono de Puntos Extra - Gold (%) ⚡
                </label>
                <input
                  type="number"
                  required
                  value={bonoGold}
                  onChange={(e) => setBonoGold(e.target.value)}
                  className="input-tienta text-black py-3 text-base font-semibold"
                />
                <span className="text-xs text-black/65 mt-1.5 block leading-relaxed font-medium">
                  Porcentaje de puntos adicionales sumados en compras de socios Gold (ej. 0 = 0% extra).
                </span>
              </div>

              <div>
                <label className="block text-sm font-montserrat uppercase tracking-wider font-bold text-tienta-teal mb-2">
                  Bono de Puntos Extra - Platinum (%) ✨
                </label>
                <input
                  type="number"
                  required
                  value={bonoPlatinum}
                  onChange={(e) => setBonoPlatinum(e.target.value)}
                  className="input-tienta text-black py-3 text-base font-semibold"
                />
                <span className="text-xs text-black/65 mt-1.5 block leading-relaxed font-medium">
                  Porcentaje de puntos adicionales sumados en compras de socios Platinum (ej. 20 = 20% extra).
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-black/5">
              <label className="block text-sm font-montserrat uppercase tracking-wider font-bold text-tienta-teal mb-2">
                URL de Webhook CRM Externo (n8n / make)
              </label>
              <input
                type="url"
                placeholder="https://tu-instancia-n8n.com/g/webhook/..."
                value={webhookN8n}
                onChange={(e) => setWebhookN8n(e.target.value)}
                className="input-tienta text-black py-3 text-base font-semibold w-full"
              />
              <span className="text-xs text-black/65 mt-1.5 block leading-relaxed font-medium">
                URL de webhook a la que se enviará automáticamente un POST JSON cada vez que un cliente se asocie.
              </span>
            </div>

            <div className="pt-6 border-t border-black/5">
              <button
                type="submit"
                disabled={loadingConfig}
                className="btn-tienta-teal px-8 py-3.5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
              >
                {loadingConfig ? 'Guardando...' : 'Guardar Parámetros'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB CONTENT: CATÁLOGO DE PREMIOS */}
      {activeTab === 'premios' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Creador de Premios */}
          <div className="lg:col-span-1 bg-white border border-black/5 rounded-3xl p-6 shadow-sm h-fit">
            <h3 className="text-base font-montserrat font-extrabold tracking-wider text-tienta-teal uppercase mb-4 flex items-center gap-2">
              <Plus size={18} /> {editingPremioId ? 'Editar Premio' : 'Crear Nuevo Premio'}
            </h3>
            <form onSubmit={handleCrearPremio} className="space-y-4">
              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                  Nombre del Premio
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Pote 1/2 Kg"
                  value={nuevoPremio.nombre}
                  onChange={(e) => setNuevoPremio({ ...nuevoPremio, nombre: e.target.value })}
                  className="input-tienta py-2.5 text-black font-semibold text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                  Descripción / Sabores elegibles
                </label>
                <textarea
                  placeholder="Detallá qué sabores o condiciones incluye..."
                  value={nuevoPremio.descripcion}
                  onChange={(e) => setNuevoPremio({ ...nuevoPremio, descripcion: e.target.value })}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:border-tienta-gold focus:outline-none focus:ring-1 focus:ring-tienta-gold transition-all duration-300 placeholder:text-black/50 text-black h-24 resize-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                    Puntos Requeridos
                  </label>
                  <input
                    type="number"
                    required
                    value={nuevoPremio.puntos_requeridos}
                    onChange={(e) => setNuevoPremio({ ...nuevoPremio, puntos_requeridos: Number(e.target.value) })}
                    className="input-tienta py-2.5 text-black font-semibold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                    Stock (-1 ilimitado)
                  </label>
                  <input
                    type="number"
                    required
                    value={nuevoPremio.stock}
                    onChange={(e) => setNuevoPremio({ ...nuevoPremio, stock: Number(e.target.value) })}
                    className="input-tienta py-2.5 text-black font-semibold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                  Membresías que pueden canjearlo
                </label>
                <div className="flex items-center gap-6 mt-2 bg-tienta-crema/20 border border-black/5 p-3 rounded-2xl">
                  <label className="flex items-center gap-2 text-xs font-semibold text-black/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={nuevoPremio.niveles_aplicables?.includes('Gold')}
                      onChange={() => toggleNivelAplicablePremio('Gold')}
                      className="rounded text-tienta-teal focus:ring-tienta-teal cursor-pointer"
                    />
                    <span>Gold 🏆</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-black/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={nuevoPremio.niveles_aplicables?.includes('Platinum')}
                      onChange={() => toggleNivelAplicablePremio('Platinum')}
                      className="rounded text-tienta-teal focus:ring-tienta-teal cursor-pointer"
                    />
                    <span>Platinum 💎</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                  Foto del Premio (Catálogo) 🍦
                </label>
                <div className="mt-2 space-y-3">
                  {nuevoPremio.imagen_url ? (
                    <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-black/10 bg-black/5 flex items-center justify-center">
                      <img
                        src={nuevoPremio.imagen_url}
                        alt="Vista previa"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setNuevoPremio({ ...nuevoPremio, imagen_url: '' })}
                        className="absolute top-2 right-2 bg-red-600 text-white px-2.5 py-1 rounded-full shadow hover:bg-red-700 transition-colors cursor-pointer text-[9px] font-bold font-montserrat uppercase tracking-wider"
                      >
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-black/15 rounded-2xl cursor-pointer bg-tienta-crema/20 hover:bg-tienta-crema/40 hover:border-tienta-gold/45 transition-all duration-300">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                        <span className="text-tienta-goldDark font-extrabold text-[10px] font-montserrat uppercase tracking-wider block mb-1">
                          {uploadingImage ? 'Comprimiendo y Subiendo...' : 'Seleccionar Foto'}
                        </span>
                        <span className="text-[9px] text-black/55 font-bold">
                          JPG o PNG (Se optimizará a menos de 100KB)
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingImage}
                        onChange={handleUploadImage}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 btn-tienta-teal py-3 text-sm font-bold tracking-wider cursor-pointer"
                >
                  {editingPremioId ? 'Guardar Cambios' : 'Agregar al Catálogo'}
                </button>
                {editingPremioId && (
                  <button
                    type="button"
                    onClick={handleCancelarEditarPremio}
                    className="btn-tienta-outline py-3 px-4 text-xs font-bold tracking-wider cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Listado de Premios */}
          <div className="lg:col-span-2 bg-white border border-black/5 rounded-3xl p-6 sm:p-8 shadow-sm">
            <h3 className="text-base font-montserrat font-extrabold tracking-wider text-tienta-teal uppercase mb-6">
              Catálogo Cargado
            </h3>

            {loadingPremios ? (
              <p className="text-xs text-black/40 py-8 text-center animate-pulse">Cargando premios...</p>
            ) : premios.length === 0 ? (
              <p className="text-xs text-black/40 py-8 text-center">No hay premios creados.</p>
            ) : (
              <div className="divide-y divide-black/5">
                {premios.map((pr) => (
                  <div key={pr.id} className="py-4 flex justify-between items-center gap-4 hover:bg-tienta-crema/10 px-2 rounded-xl transition-all">
                    <div>
                      <h4 className="font-montserrat font-bold text-sm uppercase tracking-wide text-tienta-teal">
                        {pr.nombre}
                      </h4>
                      <p className="text-xs text-black/70 font-lato leading-relaxed mt-1 max-w-lg font-medium">
                        {pr.descripcion || 'Sin descripción'}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5">
                        <span className="text-xs text-tienta-goldDark font-extrabold">
                          💰 {pr.puntos_requeridos} Puntos
                        </span>
                        <span className="text-xs text-black/55 font-bold">
                          📦 Stock: {pr.stock === -1 ? 'Ilimitado' : pr.stock}
                        </span>
                        <span className="text-[10px] bg-tienta-teal/5 text-tienta-teal border border-tienta-teal/15 px-2 py-0.5 rounded font-montserrat uppercase font-extrabold tracking-wider">
                          🎯 {pr.niveles_aplicables?.join(', ') || 'Gold, Platinum'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => handleActivarPremio(pr.id!, !pr.activo)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-montserrat uppercase tracking-wider font-bold cursor-pointer border transition-all ${
                          pr.activo 
                            ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
                            : 'bg-black/5 border-black/10 text-black/60 hover:bg-black/10'
                        }`}
                      >
                        {pr.activo ? 'Activo' : 'Pausado'}
                      </button>
                      <button
                        onClick={() => handleIniciarEditarPremio(pr)}
                        className="text-tienta-teal hover:text-tienta-tealDark hover:bg-tienta-teal/5 border border-tienta-teal/20 px-3 py-1.5 rounded-full text-[10px] font-montserrat uppercase font-bold tracking-wider transition-all cursor-pointer"
                        title="Editar"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleEliminarPremio(pr.id!)}
                        className="text-black/50 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: PROMOCIONES */}
      {activeTab === 'promos' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Creador de Promos */}
          <div className="lg:col-span-1 bg-white border border-black/5 rounded-3xl p-6 shadow-sm h-fit">
            <h3 className="text-base font-montserrat font-extrabold tracking-wider text-tienta-teal uppercase mb-4 flex items-center gap-2">
              <Plus size={18} /> {editingPromoId ? 'Editar Promoción' : 'Nueva Promoción'}
            </h3>
            <form onSubmit={handleCrearPromo} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                  Título de la Promoción
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Miércoles de 2x1"
                  value={nuevaPromo.titulo}
                  onChange={(e) => setNuevaPromo({ ...nuevaPromo, titulo: e.target.value })}
                  className="input-tienta py-2.5 text-black font-semibold text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                  Descripción
                </label>
                <textarea
                  required
                  placeholder="Describí los beneficios y cómo se aplica..."
                  value={nuevaPromo.descripcion}
                  onChange={(e) => setNuevaPromo({ ...nuevaPromo, descripcion: e.target.value })}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:border-tienta-gold focus:outline-none focus:ring-1 focus:ring-tienta-gold transition-all duration-300 placeholder:text-black/50 text-black h-24 resize-none font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                  % Descuento Directo (Opcional)
                </label>
                <input
                  type="number"
                  placeholder="Ej. 20 (opcional)"
                  value={nuevaPromo.descuento_porcentaje || ''}
                  onChange={(e) => setNuevaPromo({ ...nuevaPromo, descuento_porcentaje: e.target.value ? Number(e.target.value) : null })}
                  className="input-tienta py-2.5 text-black font-semibold text-sm"
                />
              </div>

              {/* Días de Vigencia */}
              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-2 flex items-center gap-1.5">
                  <Calendar size={12} /> Días de Vigencia
                </label>
                <div className="flex flex-wrap gap-2">
                  {diasSemana.map((d) => {
                    const selected = nuevaPromo.dias_vigencia.includes(d)
                    return (
                      <button
                        type="button"
                        key={d}
                        onClick={() => toggleDiaVigencia(d)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                          selected
                            ? 'bg-tienta-gold border-tienta-gold text-white'
                            : 'bg-white border-black/10 text-black/60 hover:text-black/90'
                        }`}
                      >
                        {d.substring(0, 2)}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Niveles Aplicables */}
              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-2 flex items-center gap-1.5">
                  <Layers size={12} /> Niveles aplicables (Vacío = Todos)
                </label>
                <div className="flex flex-wrap gap-2">
                  {nivelesClub.map((n) => {
                    const selected = (nuevaPromo.niveles_aplicables || []).includes(n)
                    return (
                      <button
                        type="button"
                        key={n}
                        onClick={() => toggleNivelAplicable(n)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                          selected
                            ? 'bg-tienta-teal border-tienta-teal text-white'
                            : 'bg-white border-black/10 text-black/60 hover:text-black/90'
                        }`}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 btn-tienta-teal py-3 text-sm font-bold tracking-wider cursor-pointer"
                >
                  {editingPromoId ? 'Guardar Cambios' : 'Publicar Promoción'}
                </button>
                {editingPromoId && (
                  <button
                    type="button"
                    onClick={handleCancelarEditarPromo}
                    className="btn-tienta-outline py-3 px-4 text-xs font-bold tracking-wider cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Listado de Promos */}
          <div className="lg:col-span-2 bg-white border border-black/5 rounded-3xl p-6 sm:p-8 shadow-sm">
            <h3 className="text-base font-montserrat font-extrabold tracking-wider text-tienta-teal uppercase mb-6">
              Promociones Publicadas
            </h3>

            {loadingPromos ? (
              <p className="text-xs text-black/40 py-8 text-center animate-pulse">Cargando promociones...</p>
            ) : promociones.length === 0 ? (
              <p className="text-xs text-black/40 py-8 text-center">No hay promociones cargadas.</p>
            ) : (
              <div className="divide-y divide-black/5">
                {promociones.map((pr) => (
                  <div key={pr.id} className="py-4 flex justify-between items-center gap-4 hover:bg-tienta-crema/10 px-2 rounded-xl transition-all">
                    <div>
                      <h4 className="font-montserrat font-bold text-sm uppercase tracking-wide text-tienta-teal">
                        {pr.titulo}
                      </h4>
                      <p className="text-xs text-black/70 font-lato leading-relaxed mt-1 max-w-lg font-medium">
                        {pr.descripcion}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        {pr.descuento_porcentaje && (
                          <span className="bg-red-50 text-red-600 px-2.5 py-0.5 rounded text-[10px] font-bold border border-red-100">
                            🏷 {pr.descuento_porcentaje}% OFF
                          </span>
                        )}
                        <span className="bg-tienta-crema text-tienta-goldDark px-2.5 py-0.5 rounded text-[10px] font-bold border border-tienta-gold/20">
                          📅 {pr.dias_vigencia.join(', ')}
                        </span>
                        <span className="bg-tienta-teal/5 text-tienta-teal px-2.5 py-0.5 rounded text-[10px] font-bold border border-tienta-teal/10">
                          👥 Niveles: {pr.niveles_aplicables && pr.niveles_aplicables.length > 0 ? pr.niveles_aplicables.join(', ') : 'Todos'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => handleActivarPromo(pr.id!, !pr.activo)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-montserrat uppercase tracking-wider font-bold cursor-pointer border transition-all ${
                          pr.activo 
                            ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
                            : 'bg-black/5 border-black/10 text-black/60 hover:bg-black/10'
                        }`}
                      >
                        {pr.activo ? 'Activa' : 'Pausada'}
                      </button>
                      <button
                        onClick={() => handleIniciarEditarPromo(pr)}
                        className="text-tienta-teal hover:text-tienta-tealDark hover:bg-tienta-teal/5 border border-tienta-teal/20 px-3 py-1.5 rounded-full text-[10px] font-montserrat uppercase font-bold tracking-wider transition-all cursor-pointer"
                        title="Editar"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleEliminarPromo(pr.id!)}
                        className="text-black/50 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: AUDITORÍA GENERAL */}
      {activeTab === 'auditoria' && (
        <div className="bg-white border border-black/5 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className="text-lg font-montserrat font-bold tracking-wider text-tienta-teal uppercase flex items-center gap-2">
              <ShieldCheck size={18} /> Auditoría e Historial de Caja
            </h2>
            
            <button
              onClick={fetchAuditoria}
              className="flex items-center gap-1.5 text-xs text-tienta-goldDark font-semibold hover:text-tienta-teal tracking-wider uppercase font-montserrat cursor-pointer"
            >
              <RefreshCw size={12} className={loadingAuditoria ? 'animate-spin' : ''} /> Actualizar Reporte
            </button>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                Filtrar DNI del Socio
              </label>
              <input
                type="text"
                placeholder="DNI del socio..."
                value={filtroDni}
                onChange={(e) => setFiltroDni(e.target.value)}
                className="input-tienta py-2 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                Filtrar por Tipo
              </label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold focus:border-tienta-gold focus:outline-none focus:ring-1 focus:ring-tienta-gold transition-all duration-300 text-black h-[42px]"
              >
                <option value="">Todos los movimientos</option>
                <option value="carga_compra">Compras en Local</option>
                <option value="carga_manual">Cargas Manuales / Ajustes</option>
                <option value="canje_premio">Canje de Premios</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                Buscar Ticket / Factura
              </label>
              <input
                type="text"
                placeholder="Nro de ticket..."
                value={filtroTicket}
                onChange={(e) => setFiltroTicket(e.target.value)}
                className="input-tienta py-2 text-sm font-semibold"
              />
            </div>
          </div>

          <div className="flex justify-end mb-6">
            <button
              onClick={fetchAuditoria}
              className="btn-tienta-teal px-6 py-2.5 text-xs font-bold tracking-wider cursor-pointer"
            >
              Aplicar Filtros
            </button>
          </div>

          {/* Reporte Tabla */}
          {loadingAuditoria ? (
            <div className="flex justify-center items-center py-16 gap-2 text-black/60 text-sm">
              <RefreshCw size={16} className="animate-spin" /> Consolidando reporte de auditoría...
            </div>
          ) : auditorias.length === 0 ? (
            <p className="text-sm text-black/50 py-16 text-center">No se encontraron movimientos que coincidan con los filtros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-lato text-left border-collapse">
                <thead>
                  <tr className="border-b border-black/10 text-black/70 font-montserrat uppercase text-xs tracking-wider">
                    <th className="pb-3 font-extrabold">Fecha y Hora</th>
                    <th className="pb-3 font-extrabold">Socio (DNI)</th>
                    <th className="pb-3 font-extrabold">Tipo</th>
                    <th className="pb-3 font-extrabold">Ticket/Ref</th>
                    <th className="pb-3 font-extrabold">Operador</th>
                    <th className="pb-3 font-extrabold">Detalle del Movimiento</th>
                    <th className="pb-3 font-extrabold text-right">Importe</th>
                    <th className="pb-3 font-extrabold text-right">Puntos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 font-semibold text-black/85">
                  {auditorias.map((tr) => (
                    <tr key={tr.id} className="hover:bg-tienta-crema/20">
                      <td className="py-3.5 text-black/70">
                        {new Date(tr.created_at).toLocaleString('es-AR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3.5">
                        <span className="font-bold block text-black text-sm">
                          {tr.cliente?.nombre} {tr.cliente?.apellido}
                        </span>
                        <span className="text-xs text-black/60 block mt-0.5">DNI: {tr.cliente?.dni}</span>
                      </td>
                      <td className="py-3.5">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                          tr.tipo === 'carga_compra' 
                            ? 'bg-green-50 text-green-700 border border-green-100' 
                            : tr.tipo === 'carga_manual' 
                              ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' 
                              : 'bg-red-50 text-red-700 border border-red-100'
                        }`}>
                          {tr.tipo === 'carga_compra' ? 'Compra' : tr.tipo === 'carga_manual' ? 'Manual' : 'Canje'}
                        </span>
                      </td>
                      <td className="py-3.5 text-black/60 font-bold">
                        {tr.ticket_factura || '-'}
                      </td>
                      <td className="py-3.5 text-xs text-black/70">
                        {tr.creador ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-black">{tr.creador.nombre} {tr.creador.apellido}</span>
                            <span className="text-[10px] text-tienta-teal font-bold font-mono">{tr.creador.email.split('@')[0]}</span>
                          </div>
                        ) : (
                          <span className="text-black/45 italic font-medium">Autocarga / Registro</span>
                        )}
                      </td>
                      <td className="py-3.5 text-black/70 max-w-xs truncate" title={tr.detalle}>
                        {tr.detalle}
                      </td>
                      <td className="py-3.5 text-right font-extrabold text-black/80">
                        {tr.importe ? `$${Number(tr.importe).toLocaleString('es-AR')}` : '-'}
                      </td>
                      <td className={`py-3.5 text-right font-bold font-montserrat text-sm ${
                        tr.puntos > 0 ? 'text-green-600' : 'text-red-500'
                      }`}>
                        {tr.puntos > 0 ? `+${tr.puntos}` : tr.puntos}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: OPERADORES Y STAFF */}
      {activeTab === 'staff' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Formulario de Alta */}
          <div className="lg:col-span-1 bg-white border border-black/5 rounded-3xl p-6 shadow-sm text-left h-fit">
            <h2 className="text-lg font-montserrat font-bold tracking-wider text-tienta-teal uppercase mb-6 flex items-center gap-2">
              <Layers size={18} /> {editingStaffId ? 'Editar Personal (Staff)' : 'Alta de Personal (Staff)'}
            </h2>

            {successCreateStaff && (
              <div className="mb-6 p-4 rounded-2xl bg-green-50 border border-green-100 text-green-600 text-sm flex items-center gap-2 font-semibold">
                <span>¡Operación realizada con éxito!</span>
              </div>
            )}

            {errorCreateStaff && (
              <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm font-bold">
                {errorCreateStaff}
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Martín"
                  value={staffNombre}
                  onChange={(e) => setStaffNombre(e.target.value)}
                  className="input-tienta py-2 text-sm font-semibold text-black font-lato"
                />
              </div>

              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                  Apellido
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. González"
                  value={staffApellido}
                  onChange={(e) => setStaffApellido(e.target.value)}
                  className="input-tienta py-2 text-sm font-semibold text-black font-lato"
                />
              </div>

              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  placeholder="ejemplo@tienta.ar"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  className="input-tienta py-2 text-sm font-semibold text-black font-lato"
                />
              </div>

              {!editingStaffId && (
                <div>
                  <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                    Contraseña de Acceso
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                    className="input-tienta py-2 text-sm font-semibold text-black font-lato"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                  Rol de Trabajo
                </label>
                <select
                  value={staffRol}
                  onChange={(e: any) => setStaffRol(e.target.value)}
                  className="w-full rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold focus:border-tienta-gold focus:outline-none focus:ring-1 focus:ring-tienta-gold transition-all duration-300 text-black h-[42px] font-lato"
                >
                  <option value="cajero">Cajero / Operador (Solo Caja y CRM)</option>
                  <option value="admin">Administrador (Control Total)</option>
                </select>
              </div>

              {editingStaffId ? (
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={loadingCreateStaff}
                    className="flex-1 btn-tienta-teal py-3 text-xs font-bold tracking-wider cursor-pointer uppercase font-montserrat"
                  >
                    {loadingCreateStaff ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelarEditarStaff}
                    className="px-4 py-3 rounded-full border border-black/15 text-[10px] font-montserrat uppercase tracking-wider font-extrabold hover:bg-black/5 cursor-pointer text-black"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={loadingCreateStaff}
                  className="w-full btn-tienta-teal py-3 text-sm font-bold tracking-wider cursor-pointer mt-4 uppercase font-montserrat"
                >
                  {loadingCreateStaff ? 'Registrando...' : 'Dar de Alta Personal'}
                </button>
              )}
            </form>
          </div>

          {/* Listado de Personal */}
          <div className="lg:col-span-2 bg-white border border-black/5 rounded-3xl p-6 sm:p-8 shadow-sm text-left">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-montserrat font-bold tracking-wider text-tienta-teal uppercase">
                Personal Activo del Club
              </h2>
              <span className="text-xs text-black/55 font-bold tracking-wide font-montserrat">
                Total de Staff: <span className="text-tienta-teal font-extrabold">{staff.length}</span>
              </span>
            </div>

            {loadingStaff ? (
              <div className="flex justify-center items-center py-16 gap-2 text-black/60 text-sm">
                <RefreshCw size={16} className="animate-spin" /> Cargando listado de personal...
              </div>
            ) : staff.length === 0 ? (
              <p className="text-sm text-black/50 py-16 text-center">No hay personal cargado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-lato text-left border-collapse">
                  <thead>
                    <tr className="border-b border-black/10 text-black/70 font-montserrat uppercase text-xs tracking-wider">
                      <th className="pb-3 font-extrabold">Nombre y Apellido</th>
                      <th className="pb-3 font-extrabold">Email</th>
                      <th className="pb-3 font-extrabold">Rol</th>
                      <th className="pb-3 font-extrabold">Fecha Reg.</th>
                      <th className="pb-3 font-extrabold text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 font-semibold text-black/85">
                    {staff.map((member) => (
                      <tr key={member.id} className="hover:bg-tienta-crema/20">
                        <td className="py-4">
                          <span className="font-bold text-black text-sm block">
                            {member.nombre} {member.apellido}
                          </span>
                        </td>
                        <td className="py-4 text-black/70 text-sm font-medium">
                          {member.email}
                        </td>
                        <td className="py-4">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                            member.rol === 'admin' 
                              ? 'bg-tienta-teal/15 text-tienta-teal border border-tienta-teal/20' 
                              : 'bg-tienta-gold/15 text-tienta-goldDark border border-tienta-gold/25'
                          }`}>
                            {member.rol === 'admin' ? 'Administrador' : 'Cajero / Operador'}
                          </span>
                        </td>
                        <td className="py-4 text-black/60 text-xs font-mono">
                          {new Date(member.created_at).toLocaleDateString('es-AR')}
                        </td>
                        <td className="py-4 text-center">
                          {/* No permitir que el admin se borre a sí mismo */}
                          {member.email !== 'lsnetinformatica2024@gmail.com' ? (
                            <div className="flex justify-center items-center gap-1">
                              <button
                                onClick={() => handleIniciarEditarStaff(member)}
                                className="text-tienta-teal hover:text-tienta-tealDark hover:bg-tienta-teal/5 p-2 rounded-full transition-all cursor-pointer"
                                title="Editar Personal"
                              >
                                <Edit size={15} />
                              </button>
                              <button
                                onClick={() => handleEliminarOperador(member.id)}
                                className="text-black/40 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors cursor-pointer"
                                title="Baja de Personal"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-black/35 font-bold italic">Propietario</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB CONTENT: ESTADÍSTICAS Y MÉTRICAS DE CAJA */}
      {activeTab === 'metricas' && (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-lg font-montserrat font-bold tracking-wider text-tienta-teal uppercase flex items-center gap-2">
              <BarChart3 size={18} /> Estadísticas y Rendimiento de Caja
            </h2>
            
            <button
              onClick={fetchMetricas}
              className="flex items-center gap-1.5 text-xs text-tienta-goldDark font-semibold hover:text-tienta-teal tracking-wider uppercase font-montserrat cursor-pointer"
            >
              <RefreshCw size={12} className={loadingMetricas ? 'animate-spin' : ''} /> Actualizar Datos
            </button>
          </div>

          {loadingMetricas ? (
            <div className="flex justify-center items-center py-24 gap-2 text-black/60 text-sm font-semibold">
              <RefreshCw size={18} className="animate-spin" /> Consolidando estadísticas del staff...
            </div>
          ) : (
            <>
              {/* Resumen Global Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Venta Global */}
                <div className="bg-tienta-teal text-white border border-white/5 rounded-3xl p-6 shadow-md relative overflow-hidden">
                  <div className="absolute -bottom-10 -right-10 w-28 h-28 rounded-full bg-white/5 blur-xl"></div>
                  <span className="text-[10px] font-montserrat uppercase tracking-[0.2em] text-tienta-gold font-extrabold">
                    Ventas Totales
                  </span>
                  <span className="text-3xl font-montserrat font-extrabold block mt-2 tracking-tight">
                    ${globalStats.totalVentas.toLocaleString('es-AR')}
                  </span>
                  <span className="text-[10px] text-white/70 block mt-2 font-bold uppercase tracking-wider font-montserrat">
                    Monto Histórico Acumulado
                  </span>
                </div>

                {/* Ventas de Hoy */}
                <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm relative overflow-hidden">
                  <span className="text-[10px] font-montserrat uppercase tracking-[0.2em] text-tienta-teal font-extrabold">
                    Ventas de Hoy 🍦
                  </span>
                  <span className="text-3xl font-montserrat font-extrabold block mt-2 tracking-tight text-tienta-goldDark">
                    ${globalStats.totalVentasHoy.toLocaleString('es-AR')}
                  </span>
                  <span className="text-[10px] text-black/50 block mt-2 font-bold uppercase tracking-wider font-montserrat">
                    Turno Diario en Curso
                  </span>
                </div>

                {/* Puntos Otorgados */}
                <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm relative overflow-hidden">
                  <span className="text-[10px] font-montserrat uppercase tracking-[0.2em] text-black/60 font-extrabold">
                    Puntos Emitidos
                  </span>
                  <span className="text-3xl font-montserrat font-extrabold block mt-2 tracking-tight text-tienta-teal">
                    +{globalStats.totalPuntos.toLocaleString('es-AR')}
                  </span>
                  <span className="text-[10px] text-black/50 block mt-2 font-bold uppercase tracking-wider font-montserrat">
                    Fidelización Entregada
                  </span>
                </div>

                {/* Canjes Totales */}
                <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm relative overflow-hidden">
                  <span className="text-[10px] font-montserrat uppercase tracking-[0.2em] text-black/60 font-extrabold">
                    Premios Canjeados
                  </span>
                  <span className="text-3xl font-montserrat font-extrabold block mt-2 tracking-tight text-tienta-goldDark">
                    {globalStats.totalCanjes.toLocaleString('es-AR')}
                  </span>
                  <span className="text-[10px] text-black/50 block mt-2 font-bold uppercase tracking-wider font-montserrat">
                    Helados y Premios Entregados
                  </span>
                </div>

              </div>

              {/* Comparativa de Operadores (Staff) */}
              <div className="bg-white border border-black/5 rounded-3xl p-6 sm:p-8 shadow-sm text-left">
                <h3 className="text-base font-montserrat font-extrabold tracking-wider text-tienta-teal uppercase mb-6">
                  Rendimiento y Balance por Operador de Caja
                </h3>

                {metricasCajeros.length === 0 ? (
                  <p className="text-sm text-black/50 py-16 text-center">No hay operadores registrados.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-lato text-left border-collapse">
                      <thead>
                        <tr className="border-b border-black/10 text-black/70 font-montserrat uppercase text-xs tracking-wider">
                          <th className="pb-3 font-extrabold">Operador / Personal</th>
                          <th className="pb-3 font-extrabold">Rol</th>
                          <th className="pb-3 font-extrabold text-right">Venta Hoy</th>
                          <th className="pb-3 font-extrabold text-right">Venta Histórica</th>
                          <th className="pb-3 font-extrabold text-right">Puntos Cargados</th>
                          <th className="pb-3 font-extrabold text-right">Canjes Realizados</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5 font-semibold text-black/85">
                        {metricasCajeros.map((m) => (
                          <tr key={m.id} className="hover:bg-tienta-crema/20">
                            <td className="py-4">
                              <span className="font-bold text-black text-sm block">
                                {m.nombre} {m.apellido}
                              </span>
                              <span className="text-[10px] text-black/50 font-mono block mt-0.5">{m.email}</span>
                            </td>
                            <td className="py-4">
                              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                                m.rol === 'admin' 
                                  ? 'bg-tienta-teal/15 text-tienta-teal border border-tienta-teal/20' 
                                  : 'bg-tienta-gold/15 text-tienta-goldDark border border-tienta-gold/25'
                              }`}>
                                {m.rol === 'admin' ? 'Administrador' : 'Cajero / Operador'}
                              </span>
                            </td>
                            <td className="py-4 text-right text-tienta-goldDark font-extrabold text-sm">
                              ${m.totalVentasHoy.toLocaleString('es-AR')}
                            </td>
                            <td className="py-4 text-right text-black/70 font-bold">
                              ${m.totalVentas.toLocaleString('es-AR')}
                            </td>
                            <td className="py-4 text-right text-green-600 font-bold text-sm">
                              +{m.totalPuntos.toLocaleString('es-AR')}
                            </td>
                            <td className="py-4 text-right text-black/80 font-bold">
                              {m.totalCanjes}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

    </div>
  )
}
