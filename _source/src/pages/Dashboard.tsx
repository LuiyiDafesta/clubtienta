import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Gift, QrCode, RefreshCw, Activity, Percent, Share2, Copy, UserCog, User, MessageSquare, Calendar } from 'lucide-react'

// Interfaces
interface Cliente {
  id: string
  dni: string
  nombre: string
  apellido: string
  telefono: string
  email: string
  puntos_actuales: number
  nivel: string
  fecha_nacimiento?: string | null
}

interface Premio {
  id: string
  nombre: string
  descripcion: string
  puntos_requeridos: number
  imagen_url: string
  stock: number
  activo: boolean
  niveles_aplicables?: string[]
}

interface Promocion {
  id: string
  titulo: string
  descripcion: string
  descuento_porcentaje: number | null
  dias_vigencia: string[]
  niveles_aplicables: string[] | null
  imagen_url: string
}

interface Transaccion {
  id: string
  tipo: string
  puntos: number
  ticket_factura: string | null
  detalle: string
  created_at: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [premios, setPremios] = useState<Premio[]>([])
  const [promos, setPromos] = useState<Promocion[]>([])
  const [historial, setHistorial] = useState<Transaccion[]>([])
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [copied, setCopied] = useState(false)
  
  const [totalConsumido, setTotalConsumido] = useState(0)
  const [limitePlatinum, setLimitePlatinum] = useState(20000)

  // Estados para Modal de Edición de Perfil
  const [editingProfile, setEditingProfile] = useState(false)
  const [editNombre, setEditNombre] = useState('')
  const [editApellido, setEditApellido] = useState('')
  const [editTelefono, setEditTelefono] = useState('')
  const [editFechaNacimiento, setEditFechaNacimiento] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const handleCopyLink = () => {
    if (!cliente) return
    const inviteText = `¡Sumate al ClubTienta! Registrate gratis usando mi DNI ${cliente.dni} como referido y sumá tus primeros puntos de regalo para canjear por helados en Tienta: ${window.location.origin}/registro?ref=${cliente.dni}`
    navigator.clipboard.writeText(inviteText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Cargar datos en el formulario del modal al seleccionar editar
  useEffect(() => {
    if (cliente) {
      setEditNombre(cliente.nombre || '')
      setEditApellido(cliente.apellido || '')
      setEditTelefono(cliente.telefono || '')
      setEditFechaNacimiento(cliente.fecha_nacimiento || '')
    }
  }, [cliente, editingProfile])

  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cliente) return
    setSavingEdit(true)

    try {
      // 1. Normalizar Whatsapp (549 + 10 dígitos)
      let cleanWhatsapp = editTelefono.replace(/\D/g, '')
      if (!cleanWhatsapp) {
        throw new Error('El número de WhatsApp es obligatorio.')
      }

      if (cleanWhatsapp.startsWith('0')) {
        cleanWhatsapp = cleanWhatsapp.substring(1)
      }
      if (cleanWhatsapp.length === 12 && cleanWhatsapp.substring(3, 5) === '15') {
        cleanWhatsapp = cleanWhatsapp.substring(0, 3) + cleanWhatsapp.substring(5)
      }

      if (cleanWhatsapp.startsWith('549') && cleanWhatsapp.length === 13) {
        // Correcto
      } else if (cleanWhatsapp.startsWith('54') && cleanWhatsapp.length === 12) {
        cleanWhatsapp = '549' + cleanWhatsapp.substring(2)
      } else if (cleanWhatsapp.length === 10) {
        cleanWhatsapp = '549' + cleanWhatsapp
      } else {
        throw new Error('Por favor ingresá un número de WhatsApp válido de 10 dígitos (código de área + número, sin el 0 y sin el 15).')
      }

      // 2. Ejecutar actualización en Supabase
      const { error } = await supabase
        .from('profiles')
        .update({
          nombre: editNombre.trim(),
          apellido: editApellido.trim(),
          telefono: cleanWhatsapp,
          fecha_nacimiento: editFechaNacimiento || null
        })
        .eq('id', cliente.id)

      if (error) throw error

      // 3. Actualizar estado local
      setCliente(prev => prev ? {
        ...prev,
        nombre: editNombre.trim(),
        apellido: editApellido.trim(),
        telefono: cleanWhatsapp,
        fecha_nacimiento: editFechaNacimiento || null
      } : null)

      setEditingProfile(false)
    } catch (err: any) {
      console.error('Error al editar perfil:', err)
      alert(err.message || 'Error al guardar los datos del perfil.')
    } finally {
      setSavingEdit(false)
    }
  }

  useEffect(() => {
    fetchSocioData()
  }, [])

  const fetchSocioData = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        navigate('/')
        return
      }

      // 1. Obtener perfil del socio
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()

      if (!profile || profile.activo === false) {
        await supabase.auth.signOut()
        navigate('/')
        return
      }

      setCliente(profile)
        
        // 2. Obtener historial del socio
        const { data: txs } = await supabase
          .from('transacciones')
          .select('*')
          .eq('cliente_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(8)
        if (txs) setHistorial(txs)

        // 2.2 Obtener consumo acumulado en pesos
        const { data: txImportes } = await supabase
          .from('transacciones')
          .select('importe')
          .eq('cliente_id', session.user.id)
          .eq('tipo', 'carga_compra')
        
        const sumImporte = txImportes 
          ? txImportes.reduce((acc, curr) => acc + Number(curr.importe || 0), 0)
          : 0
        setTotalConsumido(sumImporte)

        // 2.5 Obtener límites de consumo desde configuraciones
        const { data: configData } = await supabase
          .from('configuraciones')
          .select('clave, valor')
        
        if (configData) {
          const lp = configData.find(c => c.clave === 'limite_consumo_platinum')
          if (lp) setLimitePlatinum(Number(lp.valor || 20000))
        }

      // 3. Obtener premios activos
      const { data: rewards } = await supabase
        .from('premios')
        .select('*')
        .eq('activo', true)
        .order('puntos_requeridos', { ascending: true })
      if (rewards) setPremios(rewards)

      // 4. Obtener promos activas
      const { data: activePromos } = await supabase
        .from('promociones')
        .select('*')
        .eq('activo', true)
      if (activePromos) setPromos(activePromos)

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchSocioData()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-tienta-crema">
        <div className="flex items-center gap-2 text-tienta-teal text-sm font-semibold tracking-wider font-montserrat">
          <RefreshCw className="animate-spin" size={16} /> Cargando tu Club Tienta...
        </div>
      </div>
    )
  }

  if (!cliente) return null

  // Encontrar el premio más caro elegible
  const proximoPremio = premios.find(p => cliente.puntos_actuales < p.puntos_requeridos)
  const maxPuntosRequeridos = proximoPremio ? proximoPremio.puntos_requeridos : (premios[premios.length - 1]?.puntos_requeridos || 500)
  const progresoPorcentaje = Math.min(100, Math.floor((cliente.puntos_actuales / maxPuntosRequeridos) * 100))

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-left font-lato">
      
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-montserrat uppercase tracking-[0.25em] text-tienta-goldDark font-extrabold">
            Portal de Socio Premium
          </span>
          <h1 className="text-3xl font-montserrat font-extrabold text-tienta-teal uppercase tracking-wider mt-1">
            Hola, {cliente.nombre}
          </h1>
          <p className="text-sm text-black/75 font-lato mt-1 font-medium">
            ¡Nos alegra tenerte en el Club! Presentá tu tarjeta virtual en caja y sumá beneficios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4 self-start sm:self-auto">
          <button
            onClick={() => setEditingProfile(true)}
            className="flex items-center gap-1.5 text-xs text-tienta-goldDark font-bold hover:text-tienta-teal tracking-wider uppercase font-montserrat cursor-pointer border border-tienta-gold/20 px-4 py-2 rounded-full hover:bg-tienta-gold/5 transition-all duration-200"
          >
            <UserCog size={12} /> Editar Mis Datos
          </button>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-tienta-goldDark font-bold hover:text-tienta-teal tracking-wider uppercase font-montserrat cursor-pointer border border-tienta-gold/20 px-4 py-2 rounded-full hover:bg-tienta-gold/5 transition-all duration-200"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Actualizando...' : 'Actualizar Puntos'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Tarjeta de Fidelidad Virtual */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* La Tarjeta ClubTienta */}
          <div className="bg-tienta-teal text-white border border-white/5 rounded-3xl p-6 shadow-lg relative overflow-hidden glow-gold">
            <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-tienta-gold/15 blur-2xl"></div>
            
            <div className="flex justify-between items-start mb-12 relative z-10">
              <div className="flex flex-col">
                <span className="font-montserrat text-xl font-extrabold tracking-[0.25em] text-white">
                  TIENTA
                </span>
                <span className="font-montserrat text-[10px] font-extrabold tracking-[0.3em] text-tienta-gold uppercase -mt-0.5">
                  CLUB DE PUNTOS
                </span>
              </div>
              
              <div className="bg-tienta-gold/25 text-white border border-tienta-gold/45 px-3 py-1 rounded-full text-xs font-montserrat uppercase tracking-wider font-bold">
                Socio {cliente.nivel}
              </div>
            </div>

            {/* Código de Barras / QR Visual simulado */}
            <div className="bg-white/95 rounded-2xl p-4 flex items-center justify-between gap-4 mb-6 relative z-10 shadow-sm border border-black/10">
              <div className="flex flex-col text-left">
                <span className="text-xs font-montserrat uppercase tracking-wider text-black/75 mb-1 font-extrabold">
                  Socio Identificador
                </span>
                <span className="text-base font-bold text-tienta-teal font-mono tracking-wider">
                  DNI {cliente.dni}
                </span>
                <span className="text-sm text-black/90 font-lato mt-0.5 font-bold">
                  {cliente.nombre} {cliente.apellido}
                </span>
              </div>
              <div className="bg-tienta-teal/5 p-2 rounded-xl border border-black/5 flex items-center justify-center">
                <QrCode className="text-tienta-teal" size={36} />
              </div>
            </div>

            <div className="flex justify-between items-end relative z-10">
              <div className="text-left">
                <span className="text-sm font-montserrat uppercase tracking-wider text-white/85 block mb-0.5 font-bold">
                  Total Acumulado
                </span>
                <span className="text-4xl font-montserrat font-extrabold text-tienta-gold tracking-tight">
                  {cliente.puntos_actuales}
                </span>
                <span className="text-xs text-tienta-gold font-extrabold tracking-widest uppercase font-montserrat ml-1">
                  pts
                </span>
              </div>
              <span className="text-xs font-montserrat uppercase tracking-wider text-white/75 mb-1 font-bold">
                Caja Escaneable
              </span>
            </div>

            {/* Barra de progreso Premium (Solo si es Gold) */}
            {cliente.nivel === 'Gold' && (
              <div className="mt-5 pt-4 border-t border-white/10 relative z-10 text-left">
                <div className="flex justify-between items-center mb-1.5 text-xs font-montserrat uppercase font-extrabold tracking-wider text-[#fad08c]">
                  <span>Progreso a Socio Platinum</span>
                  <span>{Math.min(100, Math.floor((totalConsumido / limitePlatinum) * 100))}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden border border-white/5">
                  <div 
                    className="bg-gradient-to-r from-tienta-gold to-[#fad08c] h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, Math.floor((totalConsumido / limitePlatinum) * 100))}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center mt-1 text-[10px] font-bold font-montserrat uppercase tracking-wider text-white/85 leading-none">
                  <span>Consumo: ${Math.floor(totalConsumido).toLocaleString('es-AR')}</span>
                  <span>Faltan: ${Math.max(0, Math.floor(limitePlatinum - totalConsumido)).toLocaleString('es-AR')} para Platino</span>
                </div>
              </div>
            )}
          </div>

          {/* Progreso hacia el siguiente premio */}
          <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm text-left">
            <h3 className="font-montserrat font-extrabold text-base tracking-wider text-tienta-teal uppercase mb-4 flex items-center gap-2">
              <Activity size={15} className="text-tienta-goldDark" /> Tu Progreso
            </h3>
            
            {proximoPremio ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-black/80 font-lato">Próximo canje disponible:</span>
                  <span className="text-tienta-goldDark font-extrabold font-montserrat uppercase text-sm tracking-wider">{proximoPremio.nombre}</span>
                </div>
                <div className="w-full bg-tienta-crema rounded-full h-2 overflow-hidden border border-black/5">
                  <div 
                    className="bg-tienta-gold h-full rounded-full transition-all duration-500" 
                    style={{ width: `${progresoPorcentaje}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-sm text-black/75 font-bold tracking-wide">
                  <span>{cliente.puntos_actuales} Puntos</span>
                  <span>Meta: {proximoPremio.puntos_requeridos} pts ({proximoPremio.puntos_requeridos - cliente.puntos_actuales} faltantes)</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-base text-tienta-goldDark font-extrabold font-montserrat uppercase tracking-wider">¡Sos el Rey del Club! 👑</p>
                <p className="text-sm text-black/85 mt-1 leading-relaxed font-semibold">Tenés puntos acumulados suficientes para canjear absolutamente cualquier premio del catálogo actual.</p>
              </div>
            )}
          </div>

          {/* Recomendar Amigos Card */}
          <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-tienta-gold/5 blur-xl"></div>
            
            <h3 className="font-montserrat font-extrabold text-base tracking-wider text-tienta-teal uppercase mb-3 flex items-center gap-2">
              <Share2 size={15} className="text-tienta-goldDark" /> Recomendar Amigos 🍦
            </h3>
            
            <p className="text-sm text-black/85 leading-relaxed font-semibold mb-4">
              Invitá a tus amigos a asociarse al Club. Ingresando tu DNI como referido al registrarse, **¡ambos reciben puntos de regalo!**
            </p>
            
            <div className="bg-tienta-crema/40 border border-tienta-gold/25 rounded-2xl p-4 mb-4 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-montserrat font-bold tracking-wider text-black/65 block mb-1">
                  Tu Código de Referido (DNI)
                </span>
                <span className="text-lg font-montserrat font-extrabold text-tienta-teal tracking-wide">
                  {cliente.dni}
                </span>
              </div>
              <div className="bg-tienta-gold text-white font-montserrat text-xs uppercase font-bold tracking-wider px-2.5 py-1 rounded-full shadow-sm">
                Activo
              </div>
            </div>
            
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-2 bg-tienta-teal text-white hover:bg-tienta-teal/90 py-2.5 rounded-xl text-sm font-montserrat uppercase tracking-wider font-extrabold transition-all duration-300 shadow-sm active:scale-95 cursor-pointer"
            >
              <Copy size={13} />
              <span>{copied ? '¡Enlace Copiado!' : 'Copiar Enlace de Invitación'}</span>
            </button>
          </div>

          {/* Historial Reciente de Mis Puntos */}
          <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm text-left">
            <h3 className="font-montserrat font-extrabold text-base tracking-wider text-tienta-teal uppercase mb-4">
              Mis Últimos Movimientos
            </h3>

            {historial.length === 0 ? (
              <p className="text-sm text-black/65 py-6 text-center font-medium">Todavía no registrás consumos.</p>
            ) : (
              <div className="space-y-3">
                {historial.map((tr) => (
                  <div key={tr.id} className="flex justify-between items-center py-2 border-b border-black/5 last:border-b-0">
                    <div className="text-left max-w-[170px] truncate">
                      <span className="text-sm font-bold block text-black">
                        {tr.tipo === 'carga_compra' ? 'Compra en Local' : tr.tipo === 'carga_manual' ? 'Premio/Ajuste' : 'Premio Canjeado'}
                      </span>
                      <span className="text-sm text-black/75 block mt-0.5 truncate font-medium">{tr.detalle}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-base font-extrabold font-montserrat ${
                        tr.puntos > 0 ? 'text-green-600' : 'text-red-500'
                      }`}>
                        {tr.puntos > 0 ? `+${tr.puntos}` : tr.puntos}
                      </span>
                      <span className="text-xs text-black/70 block mt-0.5 font-semibold">
                        {new Date(tr.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Catálogo de Premios e Indicaciones */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Promociones Vigentes */}
          {promos.length > 0 && (
            <div className="bg-white border border-black/5 rounded-3xl p-6 sm:p-8 shadow-sm text-left">
              <div className="flex items-center gap-2 mb-4">
                <Percent className="text-tienta-teal" size={18} />
                <h3 className="text-base font-montserrat font-extrabold tracking-wider text-tienta-teal uppercase">
                  Promos y Beneficios Exclusivos del Club
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {promos.map((pr) => {
                  // Validar si aplica al nivel
                  const aplicaNivel = !pr.niveles_aplicables || pr.niveles_aplicables.length === 0 || pr.niveles_aplicables.includes(cliente.nivel)
                  if (!aplicaNivel) return null
                  
                  return (
                    <div key={pr.id} className="border border-tienta-gold/20 bg-tienta-crema/25 rounded-2xl p-4 flex flex-col justify-between overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.01)]">
                      <div>
                        {pr.imagen_url && (
                          <div className="w-full h-36 rounded-xl overflow-hidden border border-black/5 mb-3 bg-black/5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                            <img src={pr.imagen_url} alt={pr.titulo} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex justify-between items-start gap-3 mb-2">
                          <h4 className="font-montserrat font-bold text-sm uppercase tracking-wide text-tienta-teal">
                            {pr.titulo}
                          </h4>
                          {pr.descuento_porcentaje && (
                            <span className="bg-red-50 text-red-600 px-2.5 py-0.5 rounded text-[10px] font-bold border border-red-100 font-montserrat whitespace-nowrap shrink-0">
                              🏷 {pr.descuento_porcentaje}% OFF
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-black/75 font-lato leading-relaxed font-semibold">
                          {pr.descripcion}
                        </p>
                      </div>
                      <div className="mt-3 pt-3 border-t border-black/5 flex items-center justify-between text-[10px] text-tienta-goldDark font-montserrat uppercase tracking-wider font-extrabold">
                        <span>📅 Vigente: {pr.dias_vigencia.join(', ')}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Catálogo de Premios Canjeables */}
          <div className="bg-white border border-black/5 rounded-3xl p-6 sm:p-8 shadow-sm text-left">
            <div className="flex items-center gap-2 mb-6">
              <Gift className="text-tienta-teal" size={20} />
              <h3 className="text-lg font-montserrat font-extrabold tracking-wider text-tienta-teal uppercase">
                Catálogo de Premios ClubTienta
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {premios.map((premio) => {
                const alcanzado = cliente.puntos_actuales >= premio.puntos_requeridos
                const porcentajePremio = Math.min(100, Math.floor((cliente.puntos_actuales / premio.puntos_requeridos) * 100))
                const isExcluded = premio.niveles_aplicables && premio.niveles_aplicables.length > 0 && !premio.niveles_aplicables.includes(cliente.nivel)
                
                return (
                  <div 
                    key={premio.id} 
                    className={`border rounded-3xl overflow-hidden flex flex-col justify-between transition-all duration-300 ${
                      isExcluded
                        ? 'opacity-55 filter grayscale-[40%] bg-black/5 border-dashed border-black/15 pointer-events-none'
                        : alcanzado 
                          ? 'border-tienta-gold bg-tienta-gold/5 shadow-[0_2px_15px_rgba(202,168,112,0.08)] animate-pulse-subtle' 
                          : 'border-black/10 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.01)] hover:border-black/25'
                    }`}
                  >
                    {/* Foto de portada del premio si existe */}
                    {premio.imagen_url && (
                      <div className="w-full h-40 bg-black/5 relative overflow-hidden border-b border-black/5 shrink-0">
                        <img 
                          src={premio.imagen_url} 
                          alt={premio.nombre} 
                          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" 
                        />
                        {isExcluded && (
                          <div className="absolute inset-0 bg-black/35 backdrop-blur-xs flex items-center justify-center">
                            <span className="text-[10px] font-montserrat font-extrabold uppercase tracking-widest text-white bg-tienta-teal px-3 py-1 rounded-full shadow">
                              🔒 Exclusivo Platinum
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-3 mb-2">
                          <h4 className="font-montserrat font-bold text-sm uppercase tracking-wide text-tienta-teal">
                            {premio.nombre}
                          </h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-montserrat uppercase tracking-wider font-extrabold shrink-0 ${
                            isExcluded
                              ? 'bg-black/10 text-black/50'
                              : alcanzado 
                                ? 'bg-tienta-gold text-white shadow-sm border border-tienta-gold' 
                                : 'bg-tienta-crema text-tienta-goldDark border border-tienta-gold/20'
                          }`}>
                            {premio.puntos_requeridos} pts
                          </span>
                        </div>
                        <p className="text-xs text-black/80 font-lato leading-relaxed mb-4 font-semibold">
                          {premio.descripcion || 'Sin descripción disponible.'}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-black/5">
                        {isExcluded ? (
                          <div className="text-[10px] text-tienta-teal font-montserrat font-extrabold uppercase tracking-wide leading-relaxed text-center py-1 bg-tienta-teal/5 rounded-xl border border-tienta-teal/10 px-2">
                            🔒 Exclusivo para socios Platinum. ¡Seguí acumulando compras para alcanzar este beneficio!
                          </div>
                        ) : alcanzado ? (
                          <div className="flex items-center gap-1.5 text-tienta-goldDark font-extrabold uppercase tracking-wider text-xs font-montserrat">
                            <span>✓ ¡Elegible para Canjear en Caja!</span>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="w-full bg-tienta-crema rounded-full h-1 border border-black/5 overflow-hidden">
                              <div 
                                className="bg-tienta-teal/40 h-full rounded-full transition-all" 
                                style={{ width: `${porcentajePremio}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-[10px] text-black/65 font-bold tracking-wider font-montserrat">
                              <span>Estás al {porcentajePremio}% de conseguirlo</span>
                              <span>Faltan {premio.puntos_requeridos - cliente.puntos_actuales} pts</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>

      </div>

      {/* Modal de Edición de Perfil de Socio */}
      {editingProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in text-left">
          <div className="bg-white border border-black/10 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl animate-scale-up max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <div>
                <span className="text-[10px] font-montserrat uppercase tracking-[0.2em] text-tienta-goldDark font-extrabold">
                  Mi Perfil ClubTienta
                </span>
                <h3 className="text-xl font-montserrat font-extrabold text-tienta-teal uppercase tracking-wider mt-0.5">
                  Editar Mis Datos
                </h3>
              </div>
              <button
                onClick={() => setEditingProfile(false)}
                className="text-black/40 hover:text-black font-bold text-xl cursor-pointer p-1 -mt-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarEdicion} className="space-y-3 sm:space-y-4">
              
              {/* Bloque Fijo: DNI y Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-tienta-crema/40 border border-black/5 p-4 rounded-2xl">
                <div>
                  <span className="block text-[9px] font-montserrat uppercase tracking-wider font-extrabold text-black/45 mb-1">
                    Mi DNI (Fijo)
                  </span>
                  <span className="text-sm font-bold text-black/70 font-mono tracking-wide">
                    {cliente.dni}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-montserrat uppercase tracking-wider font-extrabold text-black/45 mb-1">
                    Mi Email (Fijo)
                  </span>
                  <span className="text-sm font-bold text-black/70 font-mono truncate block max-w-full">
                    {cliente.email}
                  </span>
                </div>
              </div>

              {/* Grid de Nombre y Apellido */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      className="input-tienta pl-11 py-2.5 text-black font-semibold text-sm bg-white"
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
                      value={editApellido}
                      onChange={(e) => setEditApellido(e.target.value)}
                      className="input-tienta pl-11 py-2.5 text-black font-semibold text-sm bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Teléfono (WhatsApp) */}
              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal mb-2">
                  WhatsApp (10 dígitos sin 0 ni 15)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/50">
                    <MessageSquare size={14} />
                  </span>
                  <input
                    type="tel"
                    required
                    placeholder="Ej. 3416123456"
                    value={editTelefono}
                    onChange={(e) => setEditTelefono(e.target.value)}
                    className="input-tienta pl-11 py-2.5 text-black font-semibold text-sm bg-white"
                  />
                </div>
              </div>

              {/* Fecha de Nacimiento */}
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
                    value={editFechaNacimiento}
                    onChange={(e) => setEditFechaNacimiento(e.target.value)}
                    className="input-tienta pl-11 py-2.5 text-black font-semibold text-sm bg-white"
                  />
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-black/5">
                <button
                  type="button"
                  onClick={() => setEditingProfile(false)}
                  className="btn-tienta-outline px-5 py-2.5 text-xs font-bold font-montserrat uppercase tracking-wider cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn-tienta-teal px-6 py-2.5 text-xs font-bold font-montserrat uppercase tracking-wider cursor-pointer disabled:opacity-55"
                >
                  {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
