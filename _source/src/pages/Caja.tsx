import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, IceCream, RefreshCw, ShoppingCart, Gift, FileText, CheckCircle2, AlertCircle, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import { enviarEmailTransaccional } from '../lib/emails'

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
  bono_puntos_override: number | null
  dias_vigencia: string[]
  niveles_aplicables: string[] | null
  imagen_url: string
  activo: boolean
}

interface Transaccion {
  id: string
  tipo: string
  importe: number | null
  puntos: number
  ticket_factura: string | null
  detalle: string
  created_at: string
  promocion_id?: string | null
  descuento_aplicado?: number | null
  premio_id?: string | null
  promocion?: {
    titulo: string
  } | null
  creador?: {
    nombre: string
    apellido: string
    email: string
  } | null
}

const getDiaDeLaSemana = () => {
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const hoy = new Date()
  return dias[hoy.getDay()]
}

export default function Caja() {
  const [dniBusqueda, setDniBusqueda] = useState('')
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [errorSearch, setErrorSearch] = useState<string | null>(null)
  
  // Catálogo de Premios
  const [premios, setPremios] = useState<Premio[]>([])
  
  // Historial del Cliente
  const [historial, setHistorial] = useState<Transaccion[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [filterTipoCaja, setFilterTipoCaja] = useState<string>('todos')
  const [searchQueryCaja, setSearchQueryCaja] = useState('')
  const [paginaCaja, setPaginaCaja] = useState(0)
  const itemsPorPaginaCaja = 5
  
  // Configuración de Puntos
  const [valorPunto, setValorPunto] = useState<number>(200) // $200 = 1 punto por defecto
  const [bonoGold, setBonoGold] = useState<number>(0)
  const [bonoPlatinum, setBonoPlatinum] = useState<number>(20)

  // Formulario Carga de Compra
  const [importeCompra, setImporteCompra] = useState('')
  const [ticketCompra, setTicketCompra] = useState('')
  const [loadingCompra, setLoadingCompra] = useState(false)
  const [successCompra, setSuccessCompra] = useState(false)

  // Promociones del Socio
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [selectedPromo, setSelectedPromo] = useState<Promocion | null>(null)
  const [descuentoManual, setDescuentoManual] = useState<string>('')

  // Formulario Carga Manual
  const [puntosManuales, setPuntosManuales] = useState('')
  const [detalleManual, setDetalleManual] = useState('')
  const [loadingManual, setLoadingManual] = useState(false)
  const [successManual, setSuccessManual] = useState(false)

  // Rol del operador logueado
  const [userRole, setUserRole] = useState<string | null>(null)

  // Estadísticas del Cajero ("Mi Turno")
  const [cajeroStats, setCajeroStats] = useState({
    totalVentas: 0,
    totalPuntos: 0,
    totalCanjes: 0,
    totalPuntosCanjeados: 0
  })
  const [cajeroRecentTx, setCajeroRecentTx] = useState<any[]>([])
  const [loadingCajeroStats, setLoadingCajeroStats] = useState(false)
  const [cajeroPage, setCajeroPage] = useState(1)
  const cajeroItemsPerPage = 5

  // Sistema de Notificaciones Premium (Modal y Toasts)
  const [toast, setToast] = useState<{ mostrar: boolean; mensaje: string; tipo: 'success' | 'error' | 'info' }>({
    mostrar: false,
    mensaje: '',
    tipo: 'success'
  })
  
  const [modalConfirmacion, setModalConfirmacion] = useState<{
    mostrar: boolean;
    titulo: string;
    mensaje: string;
    onConfirmar: () => void;
  }>({
    mostrar: false,
    titulo: '',
    mensaje: '',
    onConfirmar: () => {}
  })

  const mostrarToast = (mensaje: string, tipo: 'success' | 'error' | 'info' = 'success') => {
    setToast({ mostrar: true, mensaje, tipo })
  }

  const cerrarToast = () => {
    setToast(prev => ({ ...prev, mostrar: false }))
  }

  // Auto-ocultar toast después de 4 segundos
  useEffect(() => {
    if (toast.mostrar) {
      const t = setTimeout(() => cerrarToast(), 4000)
      return () => clearTimeout(t)
    }
  }, [toast.mostrar])

  const mostrarConfirmacion = (titulo: string, mensaje: string, onConfirmar: () => void) => {
    setModalConfirmacion({
      mostrar: true,
      titulo,
      mensaje,
      onConfirmar: () => {
        onConfirmar()
        cerrarConfirmacion()
      }
    })
  }

  const cerrarConfirmacion = () => {
    setModalConfirmacion(prev => ({ ...prev, mostrar: false }))
  }

  // Carga de Premios y Configuración al montar
  useEffect(() => {
    fetchPremios()
    fetchPromociones()
    fetchConfiguracion()
    checkUserRole()
    fetchCajeroTurno()
  }, [])

  // Recalcular descuento sugerido cuando cambie el importe de la compra o la promo
  useEffect(() => {
    if (selectedPromo) {
      if (selectedPromo.descuento_porcentaje) {
        const ds = Math.round(Number(importeCompra || 0) * selectedPromo.descuento_porcentaje / 100)
        setDescuentoManual(ds > 0 ? ds.toString() : '')
      } else {
        setDescuentoManual('0')
      }
    } else {
      setDescuentoManual('')
    }
  }, [importeCompra, selectedPromo])

  const checkUserRole = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      setUserRole(session.user.app_metadata?.role || 'client')
    }
  }

  const fetchCajeroTurno = async () => {
    setLoadingCajeroStats(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const userId = session.user.id
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
      const startOfToday = startOfTodayDate.toISOString()

      const { data: txs, error } = await supabase
        .from('transacciones')
        .select(`
          id, tipo, importe, puntos, ticket_factura, detalle, created_at,
          cliente:profiles!cliente_id(nombre, apellido, dni)
        `)
        .eq('creado_por', userId)
        .gte('created_at', startOfToday)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (txs) {
        let totalVentas = 0
        let totalPuntos = 0
        let totalCanjes = 0
        let totalPuntosCanjeados = 0

        txs.forEach(tx => {
          if (tx.tipo === 'carga_compra') {
            totalVentas += Number(tx.importe) || 0
          }
          if (tx.puntos > 0) {
            totalPuntos += tx.puntos
          }
          if (tx.tipo === 'canje_premio') {
            totalCanjes += 1
            totalPuntosCanjeados += Math.abs(tx.puntos)
          }
        })

        setCajeroStats({
          totalVentas,
          totalPuntos,
          totalCanjes,
          totalPuntosCanjeados
        })
        setCajeroRecentTx(txs)
        setCajeroPage(1)
      }
    } catch (err) {
      console.error('Error fetching cashier shift stats:', err)
    } finally {
      setLoadingCajeroStats(false)
    }
  }

  const fetchPremios = async () => {
    const { data, error } = await supabase
      .from('premios')
      .select('*')
      .eq('activo', true)
      .order('puntos_requeridos', { ascending: true })
    if (!error && data) setPremios(data)
  }

  const fetchPromociones = async () => {
    const { data, error } = await supabase
      .from('promociones')
      .select('*')
      .eq('activo', true)
      .order('created_at', { ascending: false })
    if (!error && data) setPromociones(data)
  }

  const fetchConfiguracion = async () => {
    const { data, error } = await supabase
      .from('configuraciones')
      .select('clave, valor')
      .in('clave', ['valor_punto', 'bono_puntos_gold', 'bono_puntos_platinum'])
    if (!error && data) {
      const p = data.find(c => c.clave === 'valor_punto')
      const bg = data.find(c => c.clave === 'bono_puntos_gold')
      const bp = data.find(c => c.clave === 'bono_puntos_platinum')
      if (p) setValorPunto(Number(p.valor) || 200)
      if (bg) setBonoGold(Number(bg.valor) || 0)
      if (bp) setBonoPlatinum(Number(bp.valor) || 0)
    }
  }

  const buscarCliente = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!dniBusqueda.trim()) return

    setLoadingSearch(true)
    setErrorSearch(null)
    setCliente(null)
    setHistorial([])

    try {
      const cleanDni = dniBusqueda.replace(/\D/g, '')
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('dni', cleanDni)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setCliente(data)
        fetchHistorialCliente(data.id)
      } else {
        setErrorSearch('No se encontró ningún cliente con ese DNI.')
      }
    } catch (err: any) {
      console.error(err)
      setErrorSearch(err.message || 'Error al buscar el cliente.')
    } finally {
      setLoadingSearch(false)
    }
  }

  const handleCerrarCliente = () => {
    setCliente(null)
    setDniBusqueda('')
    setErrorSearch(null)
    setHistorial([])
    setFilterTipoCaja('todos')
    setSearchQueryCaja('')
    setPaginaCaja(0)
    setSelectedPromo(null)
    setDescuentoManual('')
  }

  const fetchHistorialCliente = async (clienteId: string) => {
    setLoadingHistorial(true)
    const { data, error } = await supabase
      .from('transacciones')
      .select(`
        id, tipo, importe, puntos, ticket_factura, detalle, created_at,
        promocion_id, descuento_aplicado,
        promocion:promociones(titulo),
        creador:profiles!creado_por(nombre, apellido, email)
      `)
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
    
    if (!error && data) {
      setHistorial(data as any)
    }
    setLoadingHistorial(false)
  }

  const recargarCliente = async () => {
    if (!cliente) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', cliente.id)
      .maybeSingle()
    if (data) {
      setCliente(data)
      fetchHistorialCliente(data.id)
    }
  }

  // Operación: Cargar Compra ($)
  const handleCargarCompra = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cliente || !importeCompra || !ticketCompra) return

    setLoadingCompra(true)
    setSuccessCompra(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      const importe = Number(importeCompra)
      const desc = Number(descuentoManual) || 0
      const neto = Math.max(0, importe - desc)

      // Calcular puntos base sobre el monto neto a cobrar
      let puntosCalculados = Math.floor(neto / valorPunto)

      // Aplicar multiplicador: Si la promoción tiene bono_puntos_override, lo priorizamos.
      // Si no, usamos el bono por nivel por defecto.
      const bonoAplicado = selectedPromo?.bono_puntos_override !== undefined && selectedPromo?.bono_puntos_override !== null
        ? selectedPromo.bono_puntos_override
        : (cliente.nivel === 'Platinum' && bonoPlatinum > 0 ? bonoPlatinum : (cliente.nivel === 'Gold' && bonoGold > 0 ? bonoGold : 0))

      if (bonoAplicado > 0) {
        puntosCalculados = Math.floor(puntosCalculados * (1 + bonoAplicado / 100))
      }

      if (puntosCalculados <= 0 && neto > 0) {
        throw new Error(`El importe neto de la compra es muy bajo para sumar puntos. Mínimo para 1 punto: $${valorPunto}`)
      }

      // Insertar transacción de carga de compra tradicional con promoción y descuento vinculados
      const { error } = await supabase
        .from('transacciones')
        .insert({
          cliente_id: cliente.id,
          tipo: 'carga_compra',
          importe: neto, // Se guarda el importe neto final cobrado
          puntos: puntosCalculados,
          ticket_factura: ticketCompra.trim(),
          detalle: selectedPromo 
            ? `Carga por compra en sucursal aplicando promo: ${selectedPromo.titulo} (Ticket ${ticketCompra})`
            : `Carga por compra en sucursal con ticket ${ticketCompra}`,
          creado_por: session?.user?.id || null,
          promocion_id: selectedPromo?.id || null,
          descuento_aplicado: desc
        })

      if (error) throw error

      // Si hay una promoción seleccionada, insertar registro en la tabla de auditoría registro_promociones
      if (selectedPromo) {
        const { error: promoError } = await supabase
          .from('registro_promociones')
          .insert({
            cliente_id: cliente.id,
            promocion_id: selectedPromo.id,
            cajero_id: session?.user?.id || null,
            ticket_factura: ticketCompra.trim(),
            importe_compra: importe,
            descuento_aplicado: desc,
            puntos_extra_otorgados: 0
          })

        if (promoError) throw promoError
      }

      const ticketFacturaVal = ticketCompra.trim()
      const promoTituloVal = selectedPromo?.titulo || null

      setSuccessCompra(true)
      setImporteCompra('')
      setTicketCompra('')
      setSelectedPromo(null)
      setDescuentoManual('')
      
      // Recargar datos actualizados del cliente
      await recargarCliente()
      await fetchCajeroTurno()

      // Enviar correo transaccional de compra
      enviarEmailTransaccional('suma_puntos', cliente.id, {
        ticket_factura: ticketFacturaVal,
        importe: neto,
        descuento_aplicado: desc || null,
        puntos: puntosCalculados,
        promo_titulo: promoTituloVal
      }, cliente)

      setTimeout(() => setSuccessCompra(false), 3000)

    } catch (err: any) {
      console.error(err)
      mostrarToast(err.message || 'Error al cargar puntos.', 'error')
    } finally {
      setLoadingCompra(false)
    }
  }

  // Operación: Cargar Puntos Manuales
  const handleCargarManual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cliente || !puntosManuales || !detalleManual) return

    if (userRole !== 'admin') {
      mostrarToast('Acceso denegado. Solo administradores pueden realizar cargas manuales.', 'error')
      return
    }

    setLoadingManual(true)
    setSuccessManual(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const puntos = Number(puntosManuales)

      const { error } = await supabase
        .from('transacciones')
        .insert({
          cliente_id: cliente.id,
          tipo: 'carga_manual',
          importe: null,
          puntos: puntos,
          ticket_factura: null,
          detalle: detalleManual.trim(),
          creado_por: session?.user?.id || null
        })

      if (error) throw error

      const puntosAjustados = Number(puntosManuales)
      const detalleAjuste = detalleManual.trim()

      setSuccessManual(true)
      setPuntosManuales('')
      setDetalleManual('')
      
      await recargarCliente()
      await fetchCajeroTurno()

      // Enviar correo transaccional de ajuste manual
      enviarEmailTransaccional('ajuste_manual', cliente.id, {
        puntos: puntosAjustados,
        detalle: detalleAjuste
      }, cliente)

      setTimeout(() => setSuccessManual(false), 3000)

    } catch (err: any) {
      console.error(err)
      mostrarToast(err.message || 'Error al cargar puntos manuales.', 'error')
    } finally {
      setLoadingManual(false)
    }
  }

  // Operación: Canje de Premios
  const handleCanjearPremio = async (premio: Premio) => {
    if (!cliente) return
    
    if (premio.stock !== -1 && premio.stock <= 0) {
      mostrarToast('Este premio se encuentra temporalmente sin stock.', 'error')
      return
    }

    mostrarConfirmacion(
      'Confirmar Canje',
      `¿Confirmás el canje de ${premio.nombre} por ${premio.puntos_requeridos} puntos para ${cliente.nombre} ${cliente.apellido}?`,
      async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession()

          const { error } = await supabase
            .from('transacciones')
            .insert({
              cliente_id: cliente.id,
              tipo: 'canje_premio',
              importe: null,
              puntos: -premio.puntos_requeridos,
              ticket_factura: null,
              detalle: `Canje de premio en caja: ${premio.nombre}`,
              creado_por: session?.user?.id || null,
              premio_id: premio.id
            })

          if (error) throw error

          mostrarToast(`¡Premio canjeado con éxito! Entregá: ${premio.nombre}`, 'success')
          await recargarCliente()
          await fetchPremios() // Recargar stock en frontend
          await fetchCajeroTurno()

          // Enviar correo transaccional de canje
          enviarEmailTransaccional('canje_premio', cliente.id, {
            premio_nombre: premio.nombre,
            puntos: -premio.puntos_requeridos
          }, cliente)

        } catch (err: any) {
          console.error(err)
          mostrarToast(err.message || 'Error al canjear el premio.', 'error')
        }
      }
    )
  }

  // Previsualización dinámica de puntos en formulario
  const previewPuntos = () => {
    const imp = Number(importeCompra)
    if (isNaN(imp) || imp <= 0) return 0
    const desc = Number(descuentoManual) || 0
    const neto = Math.max(0, imp - desc)
    let pts = Math.floor(neto / valorPunto)
    
    const bonoAplicado = selectedPromo?.bono_puntos_override !== undefined && selectedPromo?.bono_puntos_override !== null
      ? selectedPromo.bono_puntos_override
      : (cliente?.nivel === 'Platinum' && bonoPlatinum > 0 ? bonoPlatinum : (cliente?.nivel === 'Gold' && bonoGold > 0 ? bonoGold : 0))

    if (bonoAplicado > 0) pts = Math.floor(pts * (1 + bonoAplicado / 100))
    return pts
  }

  // Filtrar y paginar el historial del socio en caja
  const historialFiltradoCaja = historial.filter(tr => {
    const matchesTipo = 
      filterTipoCaja === 'todos' || 
      (filterTipoCaja === 'cargas' && tr.puntos > 0) || 
      (filterTipoCaja === 'canjes' && tr.puntos < 0)

    const cleanSearch = searchQueryCaja.toLowerCase().trim()
    const matchesSearch = 
      !cleanSearch || 
      tr.detalle.toLowerCase().includes(cleanSearch) || 
      (tr.ticket_factura && tr.ticket_factura.toLowerCase().includes(cleanSearch)) ||
      (tr.promocion?.titulo && tr.promocion.titulo.toLowerCase().includes(cleanSearch)) ||
      (tr.tipo === 'carga_compra' ? 'compra' : tr.tipo === 'carga_manual' ? 'cargas' : 'canje').includes(cleanSearch)

    return matchesTipo && matchesSearch
  })

  const totalItemsCaja = historialFiltradoCaja.length
  const startIndexCaja = paginaCaja * itemsPorPaginaCaja
  const endIndexCaja = startIndexCaja + itemsPorPaginaCaja
  const paginatedHistorialCaja = historialFiltradoCaja.slice(startIndexCaja, endIndexCaja)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Buscador Central Principal */}
      <div className="bg-white border border-black/5 rounded-3xl p-6 sm:p-8 shadow-sm mb-8">
        <h2 className="text-xl font-montserrat font-bold tracking-wider text-tienta-teal mb-4 uppercase text-left">
          Búsqueda de Cliente
        </h2>
        <form onSubmit={buscarCliente} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-5 flex items-center text-black/30">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="Ingresá DNI del cliente..."
              value={dniBusqueda}
              onChange={(e) => setDniBusqueda(e.target.value)}
              className="w-full rounded-full border border-black/10 bg-tienta-crema/50 pl-12 pr-5 py-4 text-base focus:border-tienta-gold focus:outline-none focus:ring-1 focus:ring-tienta-gold transition-all duration-300 placeholder:text-black/30 text-black font-lato"
            />
          </div>
          <button
            type="submit"
            disabled={loadingSearch}
            className="btn-tienta-teal px-8 py-4 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loadingSearch ? 'Buscando...' : 'Buscar Cliente'}
          </button>
          {cliente && (
            <button
              type="button"
              onClick={handleCerrarCliente}
              className="px-6 py-4 rounded-full border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-montserrat uppercase font-bold text-xs tracking-wider transition-all duration-200 shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              Cerrar Socio ✕
            </button>
          )}
        </form>

        {errorSearch && (
          <div className="mt-4 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2 text-left">
            <AlertCircle size={16} />
            <span>{errorSearch}</span>
          </div>
        )}
      </div>

      {cliente && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Columna Izquierda: Ficha de Datos y Catálogo de Premios */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Ficha de Datos del Cliente */}
            <div className="bg-tienta-teal text-white border border-white/5 rounded-3xl p-6 shadow-md relative overflow-hidden glow-gold">
              {/* Elemento de diseño de fondo */}
              <div className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full bg-tienta-gold/10 blur-2xl"></div>
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-xs font-montserrat uppercase tracking-[0.2em] text-tienta-gold font-extrabold">
                    Club de Puntos
                  </span>
                  <h3 className="text-xl font-montserrat font-extrabold tracking-wide uppercase mt-1">
                    {cliente.nombre} {cliente.apellido}
                  </h3>
                  <p className="text-sm text-white/85 font-lato mt-1 font-semibold">
                    DNI: {cliente.dni}
                  </p>
                </div>
                <div className="bg-tienta-gold/25 text-white border border-tienta-gold/45 px-3 py-1 rounded-full text-[10px] font-montserrat uppercase tracking-wider font-bold">
                  {cliente.nivel}
                </div>
              </div>

              <div className="my-8 text-center relative z-10">
                <span className="text-xs font-montserrat uppercase tracking-wider text-white/75 block mb-1 font-bold">
                  Puntos Acumulados
                </span>
                <span className="text-6xl font-montserrat font-extrabold text-tienta-gold tracking-tight">
                  {cliente.puntos_actuales}
                </span>
                <span className="text-xs text-white/75 block mt-2 tracking-widest uppercase font-montserrat font-bold">
                  PUNTOS DISPONIBLES
                </span>
              </div>

              <div className="h-[1px] bg-white/20 my-4"></div>

              <div className="space-y-2 text-left text-xs font-lato text-white">
                <p><span className="text-white/70 font-montserrat uppercase text-[10px] tracking-wider block font-bold">Email:</span> {cliente.email}</p>
                <p><span className="text-white/70 font-montserrat uppercase text-[10px] tracking-wider block font-bold">Teléfono:</span> {cliente.telefono || 'No registrado'}</p>
              </div>
            </div>

          </div>

          {/* Columna Derecha: Carga de Puntos (Compra y Manual) e Historial */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Operación: Cargar Compra */}
            <div className="bg-white border border-black/5 rounded-3xl p-6 sm:p-8 shadow-sm text-left">
              <div className="flex items-center gap-2 mb-6">
                <ShoppingCart className="text-tienta-teal" size={20} />
                <h4 className="font-montserrat font-extrabold text-base tracking-wider uppercase text-tienta-teal">
                  Carga de Puntos por Compra (Operación Principal)
                </h4>
              </div>

              {successCompra && (
                <div className="mb-6 p-4 rounded-2xl bg-green-50 border border-green-100 text-green-600 text-sm flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span className="font-semibold">¡Puntos cargados con éxito! El saldo del cliente ha sido actualizado.</span>
                </div>
              )}

              <form onSubmit={handleCargarCompra} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                    Importe de la Compra ($)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Ej. 10000"
                    value={importeCompra}
                    onChange={(e) => setImporteCompra(e.target.value)}
                    className="input-tienta py-2.5 text-black font-semibold text-base"
                  />
                  {importeCompra && (
                    <div className="space-y-1.5 mt-2">
                      <span className="text-xs text-tienta-goldDark font-extrabold mt-2 block tracking-wide bg-tienta-gold/5 border border-tienta-gold/25 p-2 rounded-xl">
                        ⚡ Sumará {previewPuntos()} puntos {
                          (() => {
                            const bonoAplicado = selectedPromo?.bono_puntos_override !== undefined && selectedPromo?.bono_puntos_override !== null
                              ? selectedPromo.bono_puntos_override
                              : (cliente.nivel === 'Platinum' && bonoPlatinum > 0 ? bonoPlatinum : (cliente.nivel === 'Gold' && bonoGold > 0 ? bonoGold : 0))
                            if (bonoAplicado > 0) {
                              const esOverride = selectedPromo?.bono_puntos_override !== undefined && selectedPromo?.bono_puntos_override !== null
                              return `(Con bono ${esOverride ? 'de promo' : `de nivel ${cliente.nivel}`}: +${bonoAplicado}%)`
                            }
                            return ''
                          })()
                        }
                      </span>
                      {selectedPromo && (
                        <span className="text-[11px] font-extrabold font-montserrat text-green-600 block uppercase tracking-wider">
                          💵 Neto a cobrar en caja: ${(Number(importeCompra) - (Number(descuentoManual) || 0)).toLocaleString('es-AR')}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                    Número de Ticket / Factura
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. T-002-12345"
                    value={ticketCompra}
                    onChange={(e) => setTicketCompra(e.target.value)}
                    className="input-tienta py-2.5 text-black font-semibold text-base"
                  />
                </div>

                {/* Selector de Promociones Aplicables */}
                <div className="sm:col-span-2 border-t border-b border-black/5 py-5 my-2 text-left">
                  <span className="block text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal mb-3">
                    🎟️ Promociones Disponibles para el Socio
                  </span>
                  
                  {promociones.filter(p => {
                    if (p.niveles_aplicables && p.niveles_aplicables.length > 0) {
                      if (!p.niveles_aplicables.includes(cliente.nivel)) return false
                    }
                    const hoyDia = getDiaDeLaSemana()
                    if (p.dias_vigencia && p.dias_vigencia.length > 0) {
                      if (!p.dias_vigencia.includes(hoyDia)) return false
                    }
                    return true
                  }).length === 0 ? (
                    <p className="text-xs text-black/40 font-medium">No hay promociones aplicables para este nivel de socio hoy.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2.5">
                      {promociones.filter(p => {
                        if (p.niveles_aplicables && p.niveles_aplicables.length > 0) {
                          if (!p.niveles_aplicables.includes(cliente.nivel)) return false
                        }
                        const hoyDia = getDiaDeLaSemana()
                        if (p.dias_vigencia && p.dias_vigencia.length > 0) {
                          if (!p.dias_vigencia.includes(hoyDia)) return false
                        }
                        return true
                      }).map((p) => {
                        const isSelected = selectedPromo?.id === p.id
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedPromo(null)
                                setDescuentoManual('')
                              } else {
                                setSelectedPromo(p)
                              }
                            }}
                            className={`px-4 py-2.5 rounded-2xl text-xs font-bold font-montserrat tracking-wider uppercase transition-all duration-200 cursor-pointer border text-left flex flex-col gap-1 max-w-[280px] sm:max-w-xs ${
                              isSelected
                                ? 'bg-tienta-gold text-white border-tienta-gold shadow-md'
                                : 'bg-tienta-crema/15 hover:bg-tienta-crema/30 text-black/75 border-black/5 hover:border-black/15'
                            }`}
                          >
                            <span className="font-extrabold block truncate">{p.titulo}</span>
                            <span className={`text-[10px] lowercase block line-clamp-1 font-lato ${isSelected ? 'text-white/85' : 'text-black/45'}`}>
                              {p.descripcion}
                            </span>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {p.descuento_porcentaje && (
                                <span className={`text-[9px] uppercase font-mono tracking-wider font-extrabold px-1.5 py-0.5 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                  % {p.descuento_porcentaje} OFF
                                </span>
                              )}
                              {p.bono_puntos_override && (
                                <span className={`text-[9px] uppercase font-mono tracking-wider font-extrabold px-1.5 py-0.5 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-yellow-50 text-yellow-700 border border-yellow-100'}`}>
                                  ⚡ +{p.bono_puntos_override}% Pts
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Detalle y ajuste manual del descuento si hay promo seleccionada */}
                  {selectedPromo && (
                    <div className="mt-4 p-4 rounded-2xl bg-tienta-crema/20 border border-tienta-gold/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
                      <div>
                        <span className="text-xs font-montserrat font-extrabold uppercase text-tienta-goldDark block">
                          Beneficio: {selectedPromo.titulo}
                        </span>
                        <p className="text-xs text-black/65 mt-0.5 font-medium">
                          {selectedPromo.descuento_porcentaje 
                            ? `Descuento sugerido del ${selectedPromo.descuento_porcentaje}% OFF.` 
                            : ''}
                          {selectedPromo.bono_puntos_override 
                            ? ` Acredita +${selectedPromo.bono_puntos_override}% de puntos extras (sobreescribe bono de nivel).` 
                            : ''}
                          {!selectedPromo.descuento_porcentaje && !selectedPromo.bono_puntos_override 
                            ? 'Promo de beneficio físico/regalo. Podés registrar el costo opcional en el casillero derecho.' 
                            : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <label className="text-[11px] font-montserrat uppercase font-extrabold text-black/55">
                          Descuento ($):
                        </label>
                        <input
                          type="number"
                          placeholder="0"
                          value={descuentoManual}
                          onChange={(e) => setDescuentoManual(e.target.value)}
                          className="w-24 bg-white border border-black/10 rounded-xl px-3 py-1.5 text-sm font-bold text-black focus:outline-none focus:border-tienta-teal"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={loadingCompra}
                    className="w-full btn-tienta-teal py-4 text-sm font-bold tracking-wider cursor-pointer shadow-md uppercase"
                  >
                    {loadingCompra ? 'Procesando...' : 'Cargar Puntos de la Compra'}
                  </button>
                </div>
              </form>
            </div>

            {/* Operación: Carga Manual (Solo Administradores) */}
            {userRole === 'admin' && (
              <div className="bg-white border border-black/5 rounded-3xl p-6 sm:p-8 shadow-sm text-left">
                <div className="flex items-center gap-2 mb-6">
                  <FileText className="text-tienta-goldDark" size={20} />
                  <h4 className="font-montserrat font-extrabold text-base tracking-wider uppercase text-tienta-goldDark">
                    Carga Manual / Ajuste de Puntos Especial
                  </h4>
                </div>

                {successManual && (
                  <div className="mb-6 p-4 rounded-2xl bg-green-50 border border-green-100 text-green-600 text-sm flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span className="font-semibold">¡Ajuste de puntos aplicado exitosamente!</span>
                  </div>
                )}

                <form onSubmit={handleCargarManual} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                      Puntos a Asignar (Usa negativo para restar)
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="Ej. 100 o -50"
                      value={puntosManuales}
                      onChange={(e) => setPuntosManuales(e.target.value)}
                      className="input-tienta py-2.5 text-black font-semibold text-base"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-xs font-montserrat uppercase tracking-wider font-bold text-black/75 mb-1.5">
                      Concepto / Motivo de Auditoría
                    </label>
                    <textarea
                      required
                      placeholder="Ej. Promo especial apertura / compensación por retraso"
                      value={detalleManual}
                      onChange={(e) => setDetalleManual(e.target.value)}
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:border-tienta-gold focus:outline-none focus:ring-1 focus:ring-tienta-gold transition-all duration-300 placeholder:text-black/50 text-black h-12 resize-none font-medium"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={loadingManual}
                      className="w-full btn-tienta-outline py-3.5 text-sm font-bold tracking-wider cursor-pointer uppercase font-montserrat text-tienta-goldDark border-tienta-goldDark hover:bg-tienta-goldDark/5"
                    >
                      {loadingManual ? 'Procesando...' : 'Aplicar Carga Manual / Ajuste'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Catálogo de Premios y Canjes (En horizontal, arriba de los últimos movimientos) */}
            <div className="bg-white border border-black/5 rounded-3xl p-6 sm:p-8 shadow-sm text-left">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Gift className="text-tienta-teal" size={18} />
                  <h3 className="text-sm font-montserrat font-extrabold tracking-wider text-tienta-teal uppercase">
                    Canje de Premios
                  </h3>
                </div>
              </div>

              {premios.length === 0 ? (
                <p className="text-xs text-black/50 py-6 text-center font-medium">No hay premios cargados.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {premios.map((premio) => {
                    const noAlcanza = cliente.puntos_actuales < premio.puntos_requeridos
                    const isExcluded = premio.niveles_aplicables && premio.niveles_aplicables.length > 0 && !premio.niveles_aplicables.includes(cliente.nivel)
                    const sinStock = premio.stock !== -1 && premio.stock <= 0
                    const disabledButton = noAlcanza || isExcluded || sinStock
                    
                    return (
                      <div 
                        key={premio.id} 
                        className={`border rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
                          isExcluded
                            ? 'bg-black/5 border-dashed border-black/15 opacity-50 filter grayscale pointer-events-none'
                            : disabledButton 
                              ? 'bg-black/[0.02] border-black/5 opacity-65' 
                              : 'bg-white border-black/10 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:border-tienta-gold/30'
                        }`}
                      >
                        {isExcluded && (
                          <div className="absolute top-2 right-2 bg-tienta-teal text-white font-montserrat text-[8px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded shadow-sm z-20">
                            🔒 Exclusivo
                          </div>
                        )}
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-montserrat font-bold text-xs uppercase tracking-wide text-tienta-teal">
                              {premio.nombre}
                            </h4>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="bg-tienta-crema text-tienta-goldDark px-2 py-0.5 rounded-full text-[10px] font-montserrat uppercase tracking-wider font-extrabold border border-tienta-gold/20 shrink-0">
                                {premio.puntos_requeridos} pts
                              </span>
                              {premio.stock !== -1 && (
                                <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                                  premio.stock <= 0 
                                    ? 'bg-red-50 text-red-600 border border-red-100' 
                                    : 'bg-green-50 text-green-700 border border-green-100'
                                }`}>
                                  {premio.stock <= 0 ? 'Sin Stock' : `Stock: ${premio.stock}`}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Foto del Premio si existe */}
                          {premio.imagen_url && (
                            <div className="w-full h-24 rounded-lg overflow-hidden border border-black/5 mb-3 bg-black/5">
                              <img src={premio.imagen_url} alt={premio.nombre} className="w-full h-full object-cover" />
                            </div>
                          )}

                          <p className="text-[11px] text-black/80 font-lato leading-relaxed font-semibold mb-4">
                            {premio.descripcion || 'Sin descripción.'}
                          </p>

                          {isExcluded && (
                            <p className="text-[10px] text-tienta-teal font-montserrat uppercase font-extrabold mb-3 text-center tracking-wide leading-relaxed">
                              💎 Exclusivo {premio.niveles_aplicables?.join(', ')}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => handleCanjearPremio(premio)}
                          disabled={disabledButton}
                          className={`w-full py-2 rounded-full font-montserrat uppercase tracking-widest text-[9px] font-extrabold cursor-pointer transition-all duration-200 ${
                            disabledButton
                              ? 'bg-black/5 text-black/40 cursor-not-allowed'
                              : 'bg-tienta-gold text-white hover:bg-tienta-teal shadow-sm active:scale-95'
                          }`}
                        >
                          {isExcluded 
                            ? 'Exclusivo Premium' 
                            : sinStock
                              ? 'Sin Stock'
                              : noAlcanza 
                                ? 'Puntos Insuficientes' 
                                : 'Canjear Premio'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Historial Reciente de Operaciones */}
            <div className="bg-white border border-black/5 rounded-3xl shadow-sm overflow-hidden text-left">
              
              {/* Barra superior de herramientas del historial: Buscador y Filtros */}
              <div className="p-5 sm:px-8 border-b border-black/5 bg-tienta-crema/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-xs w-full">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/50">
                    <Search size={13} />
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar en historial..."
                    value={searchQueryCaja}
                    onChange={(e) => {
                      setSearchQueryCaja(e.target.value)
                      setPaginaCaja(0)
                    }}
                    className="input-tienta pl-10 py-1.5 text-xs font-semibold w-full bg-white h-[36px]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1 text-[10px] font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal shrink-0">
                    <Filter size={12} className="text-tienta-gold" /> Filtrar:
                  </span>
                  
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setFilterTipoCaja('todos')
                        setPaginaCaja(0)
                      }}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold font-montserrat tracking-wider uppercase transition-colors duration-200 cursor-pointer ${
                        filterTipoCaja === 'todos' 
                          ? 'bg-tienta-teal text-white shadow-sm' 
                          : 'bg-black/5 text-black/65 hover:bg-black/10'
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterTipoCaja('cargas')
                        setPaginaCaja(0)
                      }}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold font-montserrat tracking-wider uppercase transition-colors duration-200 cursor-pointer ${
                        filterTipoCaja === 'cargas' 
                          ? 'bg-green-600 text-white shadow-sm' 
                          : 'bg-black/5 text-black/65 hover:bg-black/10'
                      }`}
                    >
                      Cargas
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterTipoCaja('canjes')
                        setPaginaCaja(0)
                      }}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold font-montserrat tracking-wider uppercase transition-colors duration-200 cursor-pointer ${
                        filterTipoCaja === 'canjes' 
                          ? 'bg-red-500 text-white shadow-sm' 
                          : 'bg-black/5 text-black/65 hover:bg-black/10'
                      }`}
                    >
                      Canjes
                    </button>
                  </div>
                </div>
              </div>

              {loadingHistorial ? (
                <div className="flex items-center justify-center py-12 gap-2 text-black/70 text-sm font-semibold">
                  <RefreshCw size={16} className="animate-spin" /> Cargando historial...
                </div>
              ) : totalItemsCaja === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-sm font-semibold text-black/50">No hay movimientos que coincidan con la búsqueda.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-lato text-left border-collapse">
                      <thead>
                        <tr className="border-b border-black/10 text-black/70 font-montserrat uppercase text-xs tracking-wider">
                          <th className="pb-3 px-4 font-extrabold">Fecha</th>
                          <th className="pb-3 px-4 font-extrabold">Operación / Detalle</th>
                          <th className="pb-3 px-4 font-extrabold">Ticket/Ref</th>
                          <th className="pb-3 px-4 text-right font-extrabold">Importe</th>
                          <th className="pb-3 px-4 text-right font-extrabold">Puntos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5 font-semibold text-black/85">
                        {paginatedHistorialCaja.map((tr) => (
                          <tr key={tr.id} className="hover:bg-tienta-crema/20">
                            <td className="py-3 px-4 text-black/70 text-xs">
                              {new Date(tr.created_at).toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="py-3 px-4 text-left">
                              <span className="font-bold block text-black">
                                {tr.tipo === 'carga_compra' ? 'Compra' : tr.tipo === 'carga_manual' ? 'Carga Manual' : 'Canje'}
                              </span>
                              <span className="text-xs text-black/65 block mt-0.5 font-medium">{tr.detalle}</span>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {tr.creador && (
                                  <span className="text-[10px] text-tienta-teal font-extrabold inline-block">
                                    👤 Op: {tr.creador.nombre} ({tr.creador.email.split('@')[0]})
                                  </span>
                                )}
                                {tr.promocion?.titulo && (
                                  <span className="bg-tienta-gold/15 text-tienta-goldDark border border-tienta-gold/20 text-[9px] font-montserrat font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider">
                                    🏷️ Promo: {tr.promocion.titulo} {tr.descuento_aplicado && tr.descuento_aplicado > 0 ? `(-$${Number(tr.descuento_aplicado).toLocaleString('es-AR')})` : ''}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-black/65 font-bold text-xs">
                              {tr.ticket_factura || '-'}
                            </td>
                            <td className="py-3 px-4 text-right font-extrabold text-black/80">
                              {tr.importe ? `$${Number(tr.importe).toLocaleString('es-AR')}` : '-'}
                            </td>
                            <td className={`py-3 px-4 text-right font-bold font-montserrat text-base ${
                              tr.puntos > 0 ? 'text-green-600' : 'text-red-500'
                            }`}>
                              {tr.puntos > 0 ? `+${tr.puntos}` : tr.puntos}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {totalItemsCaja > itemsPorPaginaCaja && (
                    <div className="flex items-center justify-between border-t border-black/5 p-4 sm:px-6">
                      <span className="text-[11px] text-black/60 font-semibold font-lato">
                        Mostrando {startIndexCaja + 1} - {Math.min(endIndexCaja, totalItemsCaja)} de {totalItemsCaja} registros
                      </span>
                      
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPaginaCaja(p => Math.max(0, p - 1))}
                          disabled={paginaCaja === 0}
                          className="p-1.5 rounded-full border border-black/10 hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200"
                          title="Página Anterior"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <span className="text-xs font-bold font-montserrat text-tienta-teal px-1.5">
                          {paginaCaja + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPaginaCaja(p => ((p + 1) * itemsPorPaginaCaja < totalItemsCaja ? p + 1 : p))}
                          disabled={(paginaCaja + 1) * itemsPorPaginaCaja >= totalItemsCaja}
                          className="p-1.5 rounded-full border border-black/10 hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200"
                          title="Página Siguiente"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Si no hay búsqueda o está vacío */}
      {!cliente && !loadingSearch && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Welcome search promo */}
          <div className="lg:col-span-1 bg-white/40 border border-dashed border-black/15 rounded-3xl p-8 flex flex-col justify-center items-center text-center">
            <IceCream className="text-tienta-teal/40 mb-4 animate-bounce" size={48} />
            <h3 className="font-montserrat font-extrabold text-base tracking-wider text-tienta-teal/80 uppercase">
              Club Tienta
            </h3>
            <p className="text-xs text-black/60 mt-3 max-w-xs font-semibold leading-relaxed">
              Ingresá el DNI del socio en el buscador superior para cargar compras, canjear premios o realizar ajustes.
            </p>
          </div>

          {/* Mi Turno de Hoy */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-black/5 rounded-3xl p-6 sm:p-8 shadow-sm text-left">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-montserrat font-extrabold tracking-wider text-tienta-teal uppercase flex items-center gap-2">
                  🍦 Mi Turno de Hoy
                </h3>
                <button
                  onClick={fetchCajeroTurno}
                  className="flex items-center gap-1 text-[10px] text-tienta-goldDark font-bold hover:text-tienta-teal tracking-wider uppercase font-montserrat"
                >
                  <RefreshCw size={10} className={loadingCajeroStats ? 'animate-spin' : ''} /> Actualizar
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-tienta-crema/40 border border-tienta-gold/25 p-4 rounded-2xl text-center">
                  <span className="text-[10px] uppercase font-montserrat font-bold tracking-wider text-black/50 block mb-1">
                    Vendido ($)
                  </span>
                  <span className="text-lg sm:text-xl font-montserrat font-extrabold text-tienta-teal">
                    ${cajeroStats.totalVentas.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="bg-tienta-crema/40 border border-tienta-gold/25 p-4 rounded-2xl text-center">
                  <span className="text-[10px] uppercase font-montserrat font-bold tracking-wider text-black/50 block mb-1">
                    Puntos Asignados
                  </span>
                  <span className="text-lg sm:text-xl font-montserrat font-extrabold text-tienta-teal">
                    +{cajeroStats.totalPuntos}
                  </span>
                </div>
                <div className="bg-tienta-crema/40 border border-tienta-gold/25 p-4 rounded-2xl text-center">
                  <span className="text-[10px] uppercase font-montserrat font-bold tracking-wider text-black/50 block mb-1">
                    Canjes
                  </span>
                  <span className="text-lg sm:text-xl font-montserrat font-extrabold text-tienta-goldDark">
                    {cajeroStats.totalCanjes}
                  </span>
                </div>
                <div className="bg-tienta-crema/40 border border-tienta-gold/25 p-4 rounded-2xl text-center">
                  <span className="text-[10px] uppercase font-montserrat font-bold tracking-wider text-black/50 block mb-1">
                    Puntos Canjeados
                  </span>
                  <span className="text-lg sm:text-xl font-montserrat font-extrabold text-red-500">
                    -{cajeroStats.totalPuntosCanjeados}
                  </span>
                </div>
              </div>

              {/* Recent Actions by Cajero */}
              <div className="border-t border-black/5 pt-6">
                <h4 className="text-xs font-montserrat font-bold uppercase tracking-wider text-black/70 mb-4">
                  Mis Operaciones de Hoy
                </h4>
                
                {loadingCajeroStats ? (
                  <p className="text-[11px] text-black/45 py-4 animate-pulse">Cargando mis transacciones...</p>
                ) : cajeroRecentTx.length === 0 ? (
                  <p className="text-[11px] text-black/45 py-4 italic">No registrás operaciones en el día de hoy.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-lato text-left border-collapse">
                      <thead>
                        <tr className="border-b border-black/5 text-black/60 font-montserrat uppercase text-[10px] tracking-wider">
                          <th className="pb-2">Hora</th>
                          <th className="pb-2">Socio</th>
                          <th className="pb-2">Operación</th>
                          <th className="pb-2 text-right">Importe</th>
                          <th className="pb-2 text-right">Puntos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5 font-semibold text-black/80">
                        {cajeroRecentTx
                          .slice((cajeroPage - 1) * cajeroItemsPerPage, cajeroPage * cajeroItemsPerPage)
                          .map((tx) => (
                            <tr key={tx.id} className="hover:bg-tienta-crema/10">
                              <td className="py-2.5 text-black/60 text-[11px]">
                                {new Date(tx.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="py-2.5">
                                {tx.cliente ? (
                                  <span className="block truncate max-w-[120px]">
                                    {tx.cliente.nombre} {tx.cliente.apellido}
                                  </span>
                                ) : (
                                  <span className="italic text-black/40">-</span>
                                )}
                              </td>
                              <td className="py-2.5">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                  tx.tipo === 'carga_compra' 
                                    ? 'bg-green-50 text-green-700' 
                                    : tx.tipo === 'carga_manual' 
                                      ? 'bg-yellow-50 text-yellow-700' 
                                      : 'bg-red-50 text-red-700'
                                }`}>
                                  {tx.tipo === 'carga_compra' ? 'Compra' : tx.tipo === 'carga_manual' ? 'Manual' : 'Canje'}
                                </span>
                              </td>
                              <td className="py-2.5 text-right text-black/75">
                                {tx.importe ? `$${Number(tx.importe).toLocaleString('es-AR')}` : '-'}
                              </td>
                              <td className={`py-2.5 text-right font-bold ${
                                tx.puntos > 0 ? 'text-green-600' : 'text-red-500'
                              }`}>
                                {tx.puntos > 0 ? `+${tx.puntos}` : tx.puntos}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>

                    {/* Pagination Controls */}
                    {cajeroRecentTx.length > cajeroItemsPerPage && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-black/5">
                        <span className="text-[11px] text-black/55 font-bold font-montserrat uppercase tracking-wider">
                          Página {cajeroPage} de {Math.ceil(cajeroRecentTx.length / cajeroItemsPerPage)} ({cajeroRecentTx.length} ops)
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setCajeroPage(prev => Math.max(1, prev - 1))}
                            disabled={cajeroPage === 1}
                            className="px-3 py-1 text-[10px] font-montserrat uppercase font-bold tracking-wider rounded-lg border border-black/10 bg-white hover:bg-tienta-crema/35 text-black/60 hover:text-black/85 cursor-pointer disabled:opacity-45 disabled:pointer-events-none"
                          >
                            Anterior
                          </button>
                          <button
                            type="button"
                            onClick={() => setCajeroPage(prev => Math.min(Math.ceil(cajeroRecentTx.length / cajeroItemsPerPage), prev + 1))}
                            disabled={cajeroPage === Math.ceil(cajeroRecentTx.length / cajeroItemsPerPage)}
                            className="px-3 py-1 text-[10px] font-montserrat uppercase font-bold tracking-wider rounded-lg border border-black/10 bg-white hover:bg-tienta-crema/35 text-black/60 hover:text-black/85 cursor-pointer disabled:opacity-45 disabled:pointer-events-none"
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Premium */}
      {toast.mostrar && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-lg border animate-slide-in ${
          toast.tipo === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : toast.tipo === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-tienta-crema border-tienta-gold/30 text-tienta-teal'
        }`}>
          {toast.tipo === 'success' && <CheckCircle2 className="text-green-600" size={20} />}
          {toast.tipo === 'error' && <AlertCircle className="text-red-600" size={20} />}
          {toast.tipo === 'info' && <IceCream className="text-tienta-gold" size={20} />}
          <span className="font-montserrat font-bold text-xs uppercase tracking-wider">{toast.mensaje}</span>
          <button 
            onClick={cerrarToast}
            className="text-black/40 hover:text-black/70 font-bold ml-2 text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modal de Confirmación Premium */}
      {modalConfirmacion.mostrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs animate-fade-in p-4">
          <div className="bg-white rounded-3xl border border-black/5 p-6 sm:p-8 max-w-md w-full shadow-2xl animate-scale-up text-left font-lato">
            <h3 className="text-lg font-montserrat font-extrabold text-tienta-teal uppercase tracking-wider mb-2">
              {modalConfirmacion.titulo}
            </h3>
            <p className="text-sm text-black/75 font-medium leading-relaxed mb-6">
              {modalConfirmacion.mensaje}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={cerrarConfirmacion}
                className="btn-tienta-outline px-5 py-2 text-[10px] tracking-widest font-extrabold cursor-pointer border-black/10 hover:bg-black/5 text-black/60"
              >
                Cancelar
              </button>
              <button
                onClick={modalConfirmacion.onConfirmar}
                className="btn-tienta-teal px-5 py-2 text-[10px] tracking-widest font-extrabold cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
