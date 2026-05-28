import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  Settings, Gift, Percent, ShieldCheck, Plus, Trash2, 
  Calendar, RefreshCw, Layers 
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
  const [activeTab, setActiveTab] = useState<'config' | 'premios' | 'promos' | 'auditoria'>('config')

  // --- CONFIGURACIÓN ESTADOS ---
  const [valorPunto, setValorPunto] = useState('200')
  const [expiracionMeses, setExpiracionMeses] = useState('0')
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [successConfig, setSuccessConfig] = useState(false)

  // --- PREMIOS ESTADOS ---
  const [premios, setPremios] = useState<Premio[]>([])
  const [loadingPremios, setLoadingPremios] = useState(false)
  const [nuevoPremio, setNuevoPremio] = useState<Premio>({
    nombre: '', descripcion: '', puntos_requeridos: 100, imagen_url: '', stock: -1, activo: true
  })

  // --- PROMOS ESTADOS ---
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [loadingPromos, setLoadingPromos] = useState(false)
  const [nuevaPromo, setNuevaPromo] = useState<Promocion>({
    titulo: '', descripcion: '', descuento_porcentaje: null, dias_vigencia: [], niveles_aplicables: [], imagen_url: '', activo: true
  })

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
      if (p) setValorPunto(p.valor)
      if (e) setExpiracionMeses(e.valor)
    }
  }

  const handleGuardarConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingConfig(true)
    setSuccessConfig(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const { error: error1 } = await supabase.from('configuraciones').upsert({
        clave: 'valor_punto',
        valor: valorPunto,
        updated_by: session?.user?.id
      }, { onConflict: 'clave' })

      const { error: error2 } = await supabase.from('configuraciones').upsert({
        clave: 'expiracion_meses',
        valor: expiracionMeses,
        updated_by: session?.user?.id
      }, { onConflict: 'clave' })

      if (error1 || error2) throw error1 || error2

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
      const { error } = await supabase.from('premios').insert(nuevoPremio)
      if (error) throw error
      
      setNuevoPremio({ nombre: '', descripcion: '', puntos_requeridos: 100, imagen_url: '', stock: -1, activo: true })
      fetchPremios()
    } catch (err: any) {
      alert(err.message)
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
      const { error } = await supabase.from('promociones').insert(nuevaPromo)
      if (error) throw error

      setNuevaPromo({ titulo: '', descripcion: '', descuento_porcentaje: null, dias_vigencia: [], niveles_aplicables: [], imagen_url: '', activo: true })
      fetchPromociones()
    } catch (err: any) {
      alert(err.message)
    }
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-left">
      
      <div className="mb-8">
        <h1 className="text-3xl font-montserrat font-bold text-tienta-teal uppercase tracking-wider">
          Panel de Administración
        </h1>
        <p className="text-xs text-black/50 font-lato mt-1">
          Configurá los parámetros, premios, promociones y auditá las transacciones del Club.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-black/10 mb-8 space-x-6">
        <button
          onClick={() => setActiveTab('config')}
          className={`pb-4 text-xs font-montserrat uppercase tracking-wider font-semibold cursor-pointer transition-all ${
            activeTab === 'config' ? 'border-b-2 border-tienta-gold text-tienta-teal' : 'text-black/40 hover:text-black/60'
          }`}
        >
          <span className="flex items-center gap-2"><Settings size={14} /> Configuración</span>
        </button>
        <button
          onClick={() => setActiveTab('premios')}
          className={`pb-4 text-xs font-montserrat uppercase tracking-wider font-semibold cursor-pointer transition-all ${
            activeTab === 'premios' ? 'border-b-2 border-tienta-gold text-tienta-teal' : 'text-black/40 hover:text-black/60'
          }`}
        >
          <span className="flex items-center gap-2"><Gift size={14} /> Catálogo de Premios</span>
        </button>
        <button
          onClick={() => setActiveTab('promos')}
          className={`pb-4 text-xs font-montserrat uppercase tracking-wider font-semibold cursor-pointer transition-all ${
            activeTab === 'promos' ? 'border-b-2 border-tienta-gold text-tienta-teal' : 'text-black/40 hover:text-black/60'
          }`}
        >
          <span className="flex items-center gap-2"><Percent size={14} /> Promociones</span>
        </button>
        <button
          onClick={() => setActiveTab('auditoria')}
          className={`pb-4 text-xs font-montserrat uppercase tracking-wider font-semibold cursor-pointer transition-all ${
            activeTab === 'auditoria' ? 'border-b-2 border-tienta-gold text-tienta-teal' : 'text-black/40 hover:text-black/60'
          }`}
        >
          <span className="flex items-center gap-2"><ShieldCheck size={14} /> Auditoría General</span>
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
            <div>
              <label className="block text-xs font-montserrat uppercase tracking-widest font-semibold text-black/60 mb-2">
                Equivalencia en Pesos de 1 Punto ($)
              </label>
              <input
                type="number"
                required
                value={valorPunto}
                onChange={(e) => setValorPunto(e.target.value)}
                className="input-tienta max-w-sm text-black py-3 font-lato"
              />
              <span className="text-[10px] text-black/40 mt-1.5 block leading-relaxed">
                Ej: Si configurás 200 pesos, el cliente recibirá 1 punto por cada $200 consumidos en caja.
              </span>
            </div>

            <div>
              <label className="block text-xs font-montserrat uppercase tracking-widest font-semibold text-black/60 mb-2">
                Expiración de Puntos (Meses)
              </label>
              <input
                type="number"
                required
                value={expiracionMeses}
                onChange={(e) => setExpiracionMeses(e.target.value)}
                className="input-tienta max-w-sm text-black py-3"
              />
              <span className="text-[10px] text-black/40 mt-1.5 block leading-relaxed">
                Ingresá 0 para que los puntos nunca expiren (vencimiento desactivado).
              </span>
            </div>

            <div className="pt-4 border-t border-black/5">
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
            <h3 className="text-sm font-montserrat font-bold tracking-wider text-tienta-teal uppercase mb-4 flex items-center gap-2">
              <Plus size={16} /> Crear Nuevo Premio
            </h3>
            <form onSubmit={handleCrearPremio} className="space-y-4">
              <div>
                <label className="block text-[9px] font-montserrat uppercase tracking-widest text-black/50 mb-1.5">
                  Nombre del Premio
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Pote 1/2 Kg"
                  value={nuevoPremio.nombre}
                  onChange={(e) => setNuevoPremio({ ...nuevoPremio, nombre: e.target.value })}
                  className="input-tienta py-2.5 text-black"
                />
              </div>

              <div>
                <label className="block text-[9px] font-montserrat uppercase tracking-widest text-black/50 mb-1.5">
                  Descripción / Sabores elegibles
                </label>
                <textarea
                  placeholder="Detallá qué sabores o condiciones incluye..."
                  value={nuevoPremio.descripcion}
                  onChange={(e) => setNuevoPremio({ ...nuevoPremio, descripcion: e.target.value })}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:border-tienta-gold focus:outline-none focus:ring-1 focus:ring-tienta-gold transition-all duration-300 placeholder:text-black/30 text-black h-20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-montserrat uppercase tracking-widest text-black/50 mb-1.5">
                    Puntos Requeridos
                  </label>
                  <input
                    type="number"
                    required
                    value={nuevoPremio.puntos_requeridos}
                    onChange={(e) => setNuevoPremio({ ...nuevoPremio, puntos_requeridos: Number(e.target.value) })}
                    className="input-tienta py-2.5 text-black"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-montserrat uppercase tracking-widest text-black/50 mb-1.5">
                    Stock (-1 ilimitado)
                  </label>
                  <input
                    type="number"
                    required
                    value={nuevoPremio.stock}
                    onChange={(e) => setNuevoPremio({ ...nuevoPremio, stock: Number(e.target.value) })}
                    className="input-tienta py-2.5 text-black"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full btn-tienta-teal py-3 text-xs tracking-wider cursor-pointer"
              >
                Agregar al Catálogo
              </button>
            </form>
          </div>

          {/* Listado de Premios */}
          <div className="lg:col-span-2 bg-white border border-black/5 rounded-3xl p-6 sm:p-8 shadow-sm">
            <h3 className="text-sm font-montserrat font-bold tracking-wider text-tienta-teal uppercase mb-6">
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
                      <h4 className="font-montserrat font-bold text-xs uppercase tracking-wide text-tienta-teal">
                        {pr.nombre}
                      </h4>
                      <p className="text-[11px] text-black/50 font-lato leading-relaxed mt-0.5 max-w-lg">
                        {pr.descripcion || 'Sin descripción'}
                      </p>
                      <div className="flex gap-4 mt-2">
                        <span className="text-[10px] text-tienta-goldDark font-semibold">
                          💰 {pr.puntos_requeridos} Puntos
                        </span>
                        <span className="text-[10px] text-black/30 font-semibold">
                          📦 Stock: {pr.stock === -1 ? 'Ilimitado' : pr.stock}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleActivarPremio(pr.id!, !pr.activo)}
                        className={`px-3 py-1 rounded-full text-[9px] font-montserrat uppercase tracking-wider font-semibold cursor-pointer border ${
                          pr.activo 
                            ? 'bg-green-50 border-green-200 text-green-600' 
                            : 'bg-black/5 border-black/10 text-black/40'
                        }`}
                      >
                        {pr.activo ? 'Activo' : 'Pausado'}
                      </button>
                      <button
                        onClick={() => handleEliminarPremio(pr.id!)}
                        className="text-black/30 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
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
            <h3 className="text-sm font-montserrat font-bold tracking-wider text-tienta-teal uppercase mb-4 flex items-center gap-2">
              <Plus size={16} /> Nueva Promoción
            </h3>
            <form onSubmit={handleCrearPromo} className="space-y-4 text-xs">
              <div>
                <label className="block text-[9px] font-montserrat uppercase tracking-widest text-black/50 mb-1.5">
                  Título de la Promoción
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Miércoles de 2x1"
                  value={nuevaPromo.titulo}
                  onChange={(e) => setNuevaPromo({ ...nuevaPromo, titulo: e.target.value })}
                  className="input-tienta py-2.5 text-black"
                />
              </div>

              <div>
                <label className="block text-[9px] font-montserrat uppercase tracking-widest text-black/50 mb-1.5">
                  Descripción
                </label>
                <textarea
                  required
                  placeholder="Describí los beneficios y cómo se aplica..."
                  value={nuevaPromo.descripcion}
                  onChange={(e) => setNuevaPromo({ ...nuevaPromo, descripcion: e.target.value })}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:border-tienta-gold focus:outline-none focus:ring-1 focus:ring-tienta-gold transition-all duration-300 placeholder:text-black/30 text-black h-20 resize-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-montserrat uppercase tracking-widest text-black/50 mb-1.5">
                  % Descuento Directo (Opcional)
                </label>
                <input
                  type="number"
                  placeholder="Ej. 20 (opcional)"
                  value={nuevaPromo.descuento_porcentaje || ''}
                  onChange={(e) => setNuevaPromo({ ...nuevaPromo, descuento_porcentaje: e.target.value ? Number(e.target.value) : null })}
                  className="input-tienta py-2.5 text-black"
                />
              </div>

              {/* Días de Vigencia */}
              <div>
                <label className="block text-[9px] font-montserrat uppercase tracking-widest text-black/50 mb-2 flex items-center gap-1">
                  <Calendar size={10} /> Días de Vigencia
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {diasSemana.map((d) => {
                    const selected = nuevaPromo.dias_vigencia.includes(d)
                    return (
                      <button
                        type="button"
                        key={d}
                        onClick={() => toggleDiaVigencia(d)}
                        className={`px-2.5 py-1 rounded-full text-[9px] font-semibold border transition-all cursor-pointer ${
                          selected
                            ? 'bg-tienta-gold border-tienta-gold text-white'
                            : 'bg-white border-black/10 text-black/50'
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
                <label className="block text-[9px] font-montserrat uppercase tracking-widest text-black/50 mb-2 flex items-center gap-1">
                  <Layers size={10} /> Niveles aplicables (Vacío = Todos)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {nivelesClub.map((n) => {
                    const selected = (nuevaPromo.niveles_aplicables || []).includes(n)
                    return (
                      <button
                        type="button"
                        key={n}
                        onClick={() => toggleNivelAplicable(n)}
                        className={`px-2.5 py-1 rounded-full text-[9px] font-semibold border transition-all cursor-pointer ${
                          selected
                            ? 'bg-tienta-teal border-tienta-teal text-white'
                            : 'bg-white border-black/10 text-black/50'
                        }`}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full btn-tienta-teal py-3 text-xs tracking-wider cursor-pointer"
              >
                Publicar Promoción
              </button>
            </form>
          </div>

          {/* Listado de Promos */}
          <div className="lg:col-span-2 bg-white border border-black/5 rounded-3xl p-6 sm:p-8 shadow-sm">
            <h3 className="text-sm font-montserrat font-bold tracking-wider text-tienta-teal uppercase mb-6">
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
                      <h4 className="font-montserrat font-bold text-xs uppercase tracking-wide text-tienta-teal">
                        {pr.titulo}
                      </h4>
                      <p className="text-[11px] text-black/50 font-lato leading-relaxed mt-0.5 max-w-lg">
                        {pr.descripcion}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {pr.descuento_porcentaje && (
                          <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-[8px] font-semibold border border-red-100">
                            🏷 {pr.descuento_porcentaje}% OFF
                          </span>
                        )}
                        <span className="bg-tienta-crema text-tienta-goldDark px-2 py-0.5 rounded text-[8px] font-semibold border border-tienta-gold/20">
                          📅 {pr.dias_vigencia.join(', ')}
                        </span>
                        <span className="bg-tienta-teal/5 text-tienta-teal px-2 py-0.5 rounded text-[8px] font-semibold border border-tienta-teal/10">
                          👥 Niveles: {pr.niveles_aplicables && pr.niveles_aplicables.length > 0 ? pr.niveles_aplicables.join(', ') : 'Todos'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleActivarPromo(pr.id!, !pr.activo)}
                        className={`px-3 py-1 rounded-full text-[9px] font-montserrat uppercase tracking-wider font-semibold cursor-pointer border ${
                          pr.activo 
                            ? 'bg-green-50 border-green-200 text-green-600' 
                            : 'bg-black/5 border-black/10 text-black/40'
                        }`}
                      >
                        {pr.activo ? 'Activa' : 'Pausada'}
                      </button>
                      <button
                        onClick={() => handleEliminarPromo(pr.id!)}
                        className="text-black/30 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
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
              <label className="block text-[9px] font-montserrat uppercase tracking-widest text-black/50 mb-1.5">
                Filtrar DNI del Socio
              </label>
              <input
                type="text"
                placeholder="DNI del socio..."
                value={filtroDni}
                onChange={(e) => setFiltroDni(e.target.value)}
                className="input-tienta py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-[9px] font-montserrat uppercase tracking-widest text-black/50 mb-1.5">
                Filtrar por Tipo
              </label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full rounded-full border border-black/10 bg-white px-4 py-2 text-xs focus:border-tienta-gold focus:outline-none focus:ring-1 focus:ring-tienta-gold transition-all duration-300 text-black h-[38px]"
              >
                <option value="">Todos los movimientos</option>
                <option value="carga_compra">Compras en Local</option>
                <option value="carga_manual">Cargas Manuales / Ajustes</option>
                <option value="canje_premio">Canje de Premios</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-montserrat uppercase tracking-widest text-black/50 mb-1.5">
                Buscar Ticket / Factura
              </label>
              <input
                type="text"
                placeholder="Nro de ticket..."
                value={filtroTicket}
                onChange={(e) => setFiltroTicket(e.target.value)}
                className="input-tienta py-2 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end mb-6">
            <button
              onClick={fetchAuditoria}
              className="btn-tienta-teal px-6 py-2 text-[10px] tracking-widest"
            >
              Aplicar Filtros
            </button>
          </div>

          {/* Reporte Tabla */}
          {loadingAuditoria ? (
            <div className="flex justify-center items-center py-16 gap-2 text-black/40 text-xs">
              <RefreshCw size={14} className="animate-spin" /> Consolidando reporte de auditoría...
            </div>
          ) : auditorias.length === 0 ? (
            <p className="text-sm text-black/40 py-16 text-center">No se encontraron movimientos que coincidan con los filtros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-lato text-left border-collapse">
                <thead>
                  <tr className="border-b border-black/5 text-black/40 font-montserrat uppercase text-[9px] tracking-wider">
                    <th className="pb-3 font-semibold">Fecha y Hora</th>
                    <th className="pb-3 font-semibold">Socio (DNI)</th>
                    <th className="pb-3 font-semibold">Tipo</th>
                    <th className="pb-3 font-semibold">Ticket/Ref</th>
                    <th className="pb-3 font-semibold">Detalle del Movimiento</th>
                    <th className="pb-3 font-semibold text-right">Importe</th>
                    <th className="pb-3 font-semibold text-right">Puntos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {auditorias.map((tr) => (
                    <tr key={tr.id} className="hover:bg-tienta-crema/20">
                      <td className="py-3.5 text-black/60">
                        {new Date(tr.created_at).toLocaleString('es-AR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3.5">
                        <span className="font-semibold block text-black">
                          {tr.cliente?.nombre} {tr.cliente?.apellido}
                        </span>
                        <span className="text-[10px] text-black/40 block mt-0.5">DNI: {tr.cliente?.dni}</span>
                      </td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${
                          tr.tipo === 'carga_compra' 
                            ? 'bg-green-50 text-green-700 border border-green-100' 
                            : tr.tipo === 'carga_manual' 
                              ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' 
                              : 'bg-red-50 text-red-700 border border-red-100'
                        }`}>
                          {tr.tipo === 'carga_compra' ? 'Compra' : tr.tipo === 'carga_manual' ? 'Manual' : 'Canje'}
                        </span>
                      </td>
                      <td className="py-3.5 text-black/50 font-semibold">
                        {tr.ticket_factura || '-'}
                      </td>
                      <td className="py-3.5 text-black/60 max-w-xs truncate" title={tr.detalle}>
                        {tr.detalle}
                      </td>
                      <td className="py-3.5 text-right font-semibold text-black/80">
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

    </div>
  )
}
