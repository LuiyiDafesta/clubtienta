import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  Settings, Gift, Percent, ShieldCheck, Plus, Trash2, 
  Calendar, RefreshCw, Layers, Mail, MessageSquare, Search, ChevronLeft, ChevronRight
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
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'config' | 'premios' | 'promos' | 'auditoria' | 'crm'>('config')

  // --- CONFIGURACIÓN ESTADOS ---
  const [valorPunto, setValorPunto] = useState('200')
  const [expiracionMeses, setExpiracionMeses] = useState('0')
  const [puntosBienvenida, setPuntosBienvenida] = useState('50')
  const [puntosReferido, setPuntosReferido] = useState('100')
  const [webhookN8n, setWebhookN8n] = useState('')
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [successConfig, setSuccessConfig] = useState(false)

  // --- CRM ESTADOS ---
  interface ClienteCRM {
    id: string
    dni: string
    nombre: string
    apellido: string
    telefono: string
    email: string
    nivel: string
    puntos_actuales: number
    created_at: string
  }

  const [clientes, setClientes] = useState<ClienteCRM[]>([])
  const [loadingCRM, setLoadingCRM] = useState(false)
  const [crmBusqueda, setCrmBusqueda] = useState('')
  const [crmPagina, setCrmPagina] = useState(0)
  const [crmTotalFilas, setCrmTotalFilas] = useState(0)
  const itemsPorPagina = 15

  // --- PREMIOS ESTADOS ---
  const [premios, setPremios] = useState<Premio[]>([])
  const [loadingPremios, setLoadingPremios] = useState(false)
  const [nuevoPremio, setNuevoPremio] = useState<Premio>({
    nombre: '', descripcion: '', puntos_requeridos: 100, imagen_url: '', stock: -1, activo: true
  })
  const [editingPremioId, setEditingPremioId] = useState<string | null>(null)

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

  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  const nivelesClub = ['Standard', 'Oro', 'Platino']

  useEffect(() => {
    fetchConfiguraciones()
    fetchPremios()
    fetchPromociones()
    fetchAuditoria()
  }, [])

  // --- 1. CONFIGURACIÓN LOGICA ---
  const fetchConfiguraciones = async () => {
    const { data } = await supabase.from('configuraciones').select('*')
    if (data) {
      const p = data.find(c => c.clave === 'valor_punto')
      const e = data.find(c => c.clave === 'expiracion_meses')
      const pb = data.find(c => c.clave === 'puntos_bienvenida')
      const pr = data.find(c => c.clave === 'puntos_referido')
      const wh = data.find(c => c.clave === 'webhook_n8n')
      
      if (p) setValorPunto(p.valor)
      if (e) setExpiracionMeses(e.valor)
      if (pb) setPuntosBienvenida(pb.valor)
      if (pr) setPuntosReferido(pr.valor)
      if (wh) setWebhookN8n(wh.valor)
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
        { clave: 'webhook_n8n', valor: webhookN8n }
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
      
      setNuevoPremio({ nombre: '', descripcion: '', puntos_requeridos: 100, imagen_url: '', stock: -1, activo: true })
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
      activo: premio.activo
    })
  }

  const handleCancelarEditarPremio = () => {
    setEditingPremioId(null)
    setNuevoPremio({ nombre: '', descripcion: '', puntos_requeridos: 100, imagen_url: '', stock: -1, activo: true })
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

  // --- 4. AUDITORÍA LOGICA ---
  const fetchAuditoria = async () => {
    setLoadingAuditoria(true)
    try {
      let queryBuilder = supabase
        .from('transacciones')
        .select(`
          id, tipo, importe, puntos, ticket_factura, detalle, created_at,
          cliente:profiles(nombre, apellido, dni)
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

  // --- 5. CRM CLIENTES LOGICA ---
  const fetchClientesCRM = async () => {
    setLoadingCRM(true)
    try {
      let queryBuilder = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        
      if (crmBusqueda.trim()) {
        const searchVal = crmBusqueda.trim()
        queryBuilder = queryBuilder.or(
          `dni.ilike.%${searchVal}%,nombre.ilike.%${searchVal}%,apellido.ilike.%${searchVal}%,email.ilike.%${searchVal}%`
        )
      }

      const start = crmPagina * itemsPorPagina
      const end = start + itemsPorPagina - 1
      
      const { data, count, error } = await queryBuilder
        .order('created_at', { ascending: false })
        .range(start, end)

      if (error) throw error
      if (data) setClientes(data)
      if (count !== null) setCrmTotalFilas(count)
    } catch (err) {
      console.error('Error fetching CRM clients:', err)
    } finally {
      setLoadingCRM(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'crm') {
      fetchClientesCRM()
    }
  }, [activeTab, crmPagina])

  const handleBuscarCRM = (e: React.FormEvent) => {
    e.preventDefault()
    setCrmPagina(0)
    fetchClientesCRM()
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
          onClick={() => setActiveTab('crm')}
          className={`pb-4 text-sm font-montserrat uppercase tracking-wider font-bold cursor-pointer transition-all shrink-0 ${
            activeTab === 'crm' ? 'border-b-2 border-tienta-gold text-tienta-teal' : 'text-black/60 hover:text-black/90'
          }`}
        >
          <span className="flex items-center gap-2"><Layers size={16} /> Clientes (CRM)</span>
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
                      <div className="flex gap-4 mt-2.5">
                        <span className="text-xs text-tienta-goldDark font-extrabold">
                          💰 {pr.puntos_requeridos} Puntos
                        </span>
                        <span className="text-xs text-black/55 font-bold">
                          📦 Stock: {pr.stock === -1 ? 'Ilimitado' : pr.stock}
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

      {/* TAB CONTENT: CLIENTES (CRM) */}
      {activeTab === 'crm' && (
        <div className="bg-white border border-black/5 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-montserrat font-bold tracking-wider text-tienta-teal uppercase flex items-center gap-2">
                <Layers size={18} /> Mini-CRM de Clientes del Club
              </h2>
              <p className="text-xs text-black/65 font-semibold font-lato mt-0.5">
                Total de socios registrados: {crmTotalFilas}
              </p>
            </div>
            
            <button
              onClick={fetchClientesCRM}
              className="flex items-center gap-1.5 text-xs text-tienta-goldDark font-semibold hover:text-tienta-teal tracking-wider uppercase font-montserrat cursor-pointer border border-tienta-gold/20 px-3.5 py-1.5 rounded-full hover:bg-tienta-gold/5"
            >
              <RefreshCw size={12} className={loadingCRM ? 'animate-spin' : ''} /> Actualizar CRM
            </button>
          </div>

          {/* Buscador */}
          <form onSubmit={handleBuscarCRM} className="flex gap-2 max-w-md mb-6">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/50">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Buscar por DNI, Nombre, Apellido, Email..."
                value={crmBusqueda}
                onChange={(e) => setCrmBusqueda(e.target.value)}
                className="input-tienta pl-11 py-2 text-sm font-semibold w-full"
              />
            </div>
            <button
              type="submit"
              className="btn-tienta-teal px-5 py-2 text-xs font-bold font-montserrat uppercase tracking-wider cursor-pointer"
            >
              Buscar
            </button>
          </form>

          {/* Tabla CRM */}
          {loadingCRM ? (
            <div className="flex justify-center items-center py-16 gap-2 text-black/60 text-sm">
              <RefreshCw size={16} className="animate-spin" /> Cargando listado de clientes...
            </div>
          ) : clientes.length === 0 ? (
            <p className="text-sm text-black/50 py-16 text-center">No se encontraron clientes registrados.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-lato text-left border-collapse">
                  <thead>
                    <tr className="border-b border-black/10 text-black/70 font-montserrat uppercase text-xs tracking-wider">
                      <th className="pb-3 font-extrabold">Fecha Reg.</th>
                      <th className="pb-3 font-extrabold">DNI / Socio</th>
                      <th className="pb-3 font-extrabold">Contacto</th>
                      <th className="pb-3 font-extrabold">Nivel</th>
                      <th className="pb-3 font-extrabold text-right">Puntos Disponibles</th>
                      <th className="pb-3 font-extrabold text-center">Acciones Comerciales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 font-semibold text-black/85">
                    {clientes.map((c) => (
                      <tr key={c.id} className="hover:bg-tienta-crema/20">
                        <td className="py-3.5 text-black/70 text-xs font-mono">
                          {new Date(c.created_at).toLocaleDateString('es-AR')}
                        </td>
                        <td className="py-3.5">
                          <span className="font-bold block text-black text-sm">
                            {c.nombre} {c.apellido}
                          </span>
                          <span className="text-xs text-black/60 block mt-0.5">DNI: {c.dni}</span>
                        </td>
                        <td className="py-3.5 text-xs">
                          <div className="text-black">{c.email}</div>
                          <div className="text-black/60 mt-0.5">{c.telefono || 'Sin teléfono'}</div>
                        </td>
                        <td className="py-3.5">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                            c.nivel === 'Standard' 
                              ? 'bg-black/5 text-black/75 border border-black/10' 
                              : c.nivel === 'Oro' 
                                ? 'bg-tienta-gold/15 text-tienta-goldDark border border-tienta-gold/25' 
                                : 'bg-tienta-teal/10 text-tienta-teal border border-tienta-teal/20'
                          }`}>
                            {c.nivel}
                          </span>
                        </td>
                        <td className="py-3.5 text-right font-extrabold text-tienta-teal text-base">
                          {c.puntos_actuales} <span className="text-[10px] font-bold text-black/65">pts</span>
                        </td>
                        <td className="py-3.5">
                          <div className="flex justify-center items-center gap-2">
                            {/* Correo mailto */}
                            <a
                              href={`mailto:${c.email}?subject=ClubTienta%20-%20Novedades%20y%20Beneficios&body=Hola%20${c.nombre},%20te%20escribimos%20desde%20el%20ClubTienta%20para%20agradecerte%20tu%20fidelidad...`}
                              className="inline-flex items-center gap-1.5 bg-tienta-teal/5 text-tienta-teal hover:bg-tienta-teal hover:text-white border border-tienta-teal/15 px-3 py-1.5 rounded-full text-[10px] font-montserrat uppercase font-bold tracking-wider transition-all duration-300"
                              title="Enviar Email"
                            >
                              <Mail size={11} /> Email
                            </a>
                            {/* WhatsApp wa.me */}
                            {c.telefono ? (
                              <a
                                href={`https://wa.me/${c.telefono.replace(/\D/g, '').startsWith('54') ? '' : '54'}${c.telefono.replace(/\D/g, '')}?text=Hola%20${c.nombre},%20te%20escribimos%20del%20ClubTienta...`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 hover:bg-green-600 hover:text-white border border-green-200 px-3 py-1.5 rounded-full text-[10px] font-montserrat uppercase font-bold tracking-wider transition-all duration-300"
                                title="Enviar WhatsApp"
                              >
                                <MessageSquare size={11} /> WhatsApp
                              </a>
                            ) : (
                              <span className="text-[10px] text-black/35 font-bold italic py-1.5 px-3">Sin WhatsApp</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {crmTotalFilas > itemsPorPagina && (
                <div className="flex items-center justify-between border-t border-black/5 pt-6 mt-6">
                  <span className="text-xs text-black/60 font-semibold font-lato">
                    Mostrando del {crmPagina * itemsPorPagina + 1} al {Math.min((crmPagina + 1) * itemsPorPagina, crmTotalFilas)} de {crmTotalFilas} socios
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCrmPagina(p => Math.max(0, p - 1))}
                      disabled={crmPagina === 0}
                      className="p-2 rounded-full border border-black/10 hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200"
                      title="Página Anterior"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm font-bold font-montserrat text-tienta-teal px-2">
                      {crmPagina + 1}
                    </span>
                    <button
                      onClick={() => setCrmPagina(p => ((p + 1) * itemsPorPagina < crmTotalFilas ? p + 1 : p))}
                      disabled={(crmPagina + 1) * itemsPorPagina >= crmTotalFilas}
                      className="p-2 rounded-full border border-black/10 hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200"
                      title="Página Siguiente"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

    </div>
  )
}
