import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, IceCream, RefreshCw, ShoppingCart, Gift, FileText, CheckCircle2, AlertCircle } from 'lucide-react'

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
}

interface Transaccion {
  id: string
  tipo: string
  importe: number | null
  puntos: number
  ticket_factura: string | null
  detalle: string
  created_at: string
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
  
  // Configuración de Puntos
  const [valorPunto, setValorPunto] = useState<number>(200) // $200 = 1 punto por defecto

  // Formulario Carga de Compra
  const [importeCompra, setImporteCompra] = useState('')
  const [ticketCompra, setTicketCompra] = useState('')
  const [loadingCompra, setLoadingCompra] = useState(false)
  const [successCompra, setSuccessCompra] = useState(false)

  // Formulario Carga Manual
  const [puntosManuales, setPuntosManuales] = useState('')
  const [detalleManual, setDetalleManual] = useState('')
  const [loadingManual, setLoadingManual] = useState(false)
  const [successManual, setSuccessManual] = useState(false)

  // Carga de Premios y Configuración al montar
  useEffect(() => {
    fetchPremios()
    fetchConfiguracion()
  }, [])

  const fetchPremios = async () => {
    const { data, error } = await supabase
      .from('premios')
      .select('*')
      .eq('activo', true)
      .order('puntos_requeridos', { ascending: true })
    if (!error && data) setPremios(data)
  }

  const fetchConfiguracion = async () => {
    const { data, error } = await supabase
      .from('configuraciones')
      .select('clave, valor')
      .eq('clave', 'valor_punto')
      .maybeSingle()
    if (!error && data) {
      setValorPunto(Number(data.valor) || 200)
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

  const fetchHistorialCliente = async (clienteId: string) => {
    setLoadingHistorial(true)
    const { data, error } = await supabase
      .from('transacciones')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (!error && data) {
      setHistorial(data)
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
      // Calcular puntos base en frontend (el trigger de la base de datos se encargará de impactarlo)
      // Si el cliente tiene un nivel premium, podríamos configurar un multiplicador en configuraciones.
      // Por simplicidad, calculamos puntos = importe / valorPunto
      let puntosCalculados = Math.floor(importe / valorPunto)

      // Aplicar multiplicador del 10% para nivel Oro y 20% para nivel Platino en caja para incentivar
      if (cliente.nivel === 'Oro') {
        puntosCalculados = Math.floor(puntosCalculados * 1.1)
      } else if (cliente.nivel === 'Platino') {
        puntosCalculados = Math.floor(puntosCalculados * 1.2)
      }

      if (puntosCalculados <= 0) {
        throw new Error(`El importe ingresado es muy bajo para sumar puntos. Mínimo para 1 punto: $${valorPunto}`)
      }

      const { error } = await supabase
        .from('transacciones')
        .insert({
          cliente_id: cliente.id,
          tipo: 'carga_compra',
          importe: importe,
          puntos: puntosCalculados,
          ticket_factura: ticketCompra.trim(),
          detalle: `Carga por compra en sucursal con ticket ${ticketCompra}`,
          creado_por: session?.user?.id || null
        })

      if (error) throw error

      setSuccessCompra(true)
      setImporteCompra('')
      setTicketCompra('')
      
      // Recargar datos actualizados del cliente
      await recargarCliente()

      setTimeout(() => setSuccessCompra(false), 3000)

    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Error al cargar puntos.')
    } finally {
      setLoadingCompra(false)
    }
  }

  // Operación: Cargar Puntos Manuales
  const handleCargarManual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cliente || !puntosManuales || !detalleManual) return

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

      setSuccessManual(true)
      setPuntosManuales('')
      setDetalleManual('')
      
      await recargarCliente()

      setTimeout(() => setSuccessManual(false), 3000)

    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Error al cargar puntos manuales.')
    } finally {
      setLoadingManual(false)
    }
  }

  // Operación: Canje de Premios
  const handleCanjearPremio = async (premio: Premio) => {
    if (!cliente) return
    
    const confirmar = window.confirm(`¿Confirmás el canje de ${premio.nombre} por ${premio.puntos_requeridos} puntos?`)
    if (!confirmar) return

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const { error } = await supabase
        .from('transacciones')
        .insert({
          cliente_id: cliente.id,
          tipo: 'canje_premio',
          importe: null,
          puntos: -premio.puntos_requeridos, // Negativo para descontar
          ticket_factura: null,
          detalle: `Canje de premio en caja: ${premio.nombre}`,
          creado_por: session?.user?.id || null
        })

      if (error) throw error

      alert(`✓ ¡Premio canjeado con éxito! Entregá el premio: ${premio.nombre}`)
      await recargarCliente()

    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Error al canjear el premio.')
    }
  }

  // Previsualización dinámica de puntos en formulario
  const previewPuntos = () => {
    const imp = Number(importeCompra)
    if (isNaN(imp) || imp <= 0) return 0
    let pts = Math.floor(imp / valorPunto)
    if (cliente?.nivel === 'Oro') pts = Math.floor(pts * 1.1)
    if (cliente?.nivel === 'Platino') pts = Math.floor(pts * 1.2)
    return pts
  }

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
          
          {/* Ficha de Datos del Cliente */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-tienta-teal text-white border border-white/5 rounded-3xl p-6 shadow-md relative overflow-hidden glow-gold">
              {/* Elemento de diseño de fondo */}
              <div className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full bg-tienta-gold/10 blur-2xl"></div>
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[10px] font-montserrat uppercase tracking-[0.2em] text-tienta-gold font-bold">
                    Club de Puntos
                  </span>
                  <h3 className="text-xl font-montserrat font-semibold tracking-wide uppercase mt-1">
                    {cliente.nombre} {cliente.apellido}
                  </h3>
                  <p className="text-xs text-white/60 font-lato mt-1">
                    DNI: {cliente.dni}
                  </p>
                </div>
                <div className="bg-tienta-gold/20 text-tienta-gold border border-tienta-gold/30 px-3 py-1 rounded-full text-[9px] font-montserrat uppercase tracking-wider font-semibold">
                  {cliente.nivel}
                </div>
              </div>

              <div className="my-8 text-center relative z-10">
                <span className="text-[10px] font-montserrat uppercase tracking-widest text-white/50 block mb-1">
                  Puntos Acumulados
                </span>
                <span className="text-6xl font-montserrat font-light text-tienta-gold tracking-tight">
                  {cliente.puntos_actuales}
                </span>
                <span className="text-xs text-white/40 block mt-2 tracking-widest uppercase font-montserrat">
                  PUNTOS DISPONIBLES
                </span>
              </div>

              <div className="h-[1px] bg-white/10 my-4"></div>

              <div className="space-y-2 text-left text-xs font-lato text-white/80">
                <p><span className="text-white/40 font-montserrat uppercase text-[9px] tracking-wider block">Email:</span> {cliente.email}</p>
                <p><span className="text-white/40 font-montserrat uppercase text-[9px] tracking-wider block">Teléfono:</span> {cliente.telefono || 'No registrado'}</p>
              </div>
            </div>

            {/* Operación: Cargar Compra */}
            <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm text-left">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingCart className="text-tienta-teal" size={18} />
                <h4 className="font-montserrat font-bold text-sm tracking-wider uppercase text-tienta-teal">
                  Carga por Compra
                </h4>
              </div>

              {successCompra && (
                <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-100 text-green-600 text-xs flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  <span>Carga realizada con éxito</span>
                </div>
              )}

              <form onSubmit={handleCargarCompra} className="space-y-4">
                <div>
                  <label className="block text-[9px] font-montserrat uppercase tracking-widest text-black/50 mb-1.5">
                    Importe de la Compra ($)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Ej. 10000"
                    value={importeCompra}
                    onChange={(e) => setImporteCompra(e.target.value)}
                    className="input-tienta py-2 text-black"
                  />
                  {importeCompra && (
                    <span className="text-[10px] text-tienta-goldDark font-semibold mt-1.5 block tracking-wide">
                      ⚡ Sumará {previewPuntos()} puntos {cliente.nivel !== 'Standard' && `(Con bono de nivel ${cliente.nivel})`}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[9px] font-montserrat uppercase tracking-widest text-black/50 mb-1.5">
                    Número de Ticket / Factura
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. T-002-12345"
                    value={ticketCompra}
                    onChange={(e) => setTicketCompra(e.target.value)}
                    className="input-tienta py-2 text-black"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingCompra}
                  className="w-full btn-tienta-teal py-3 text-xs tracking-wider cursor-pointer"
                >
                  {loadingCompra ? 'Procesando...' : 'Cargar Puntos'}
                </button>
              </form>
            </div>

            {/* Operación: Carga Manual */}
            <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm text-left">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="text-tienta-goldDark" size={18} />
                <h4 className="font-montserrat font-bold text-sm tracking-wider uppercase text-tienta-goldDark">
                  Carga Manual / Especial
                </h4>
              </div>

              {successManual && (
                <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-100 text-green-600 text-xs flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  <span>Ajuste aplicado con éxito</span>
                </div>
              )}

              <form onSubmit={handleCargarManual} className="space-y-4">
                <div>
                  <label className="block text-[9px] font-montserrat uppercase tracking-widest text-black/50 mb-1.5">
                    Puntos a Asignar
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Ej. 100 o -50"
                    value={puntosManuales}
                    onChange={(e) => setPuntosManuales(e.target.value)}
                    className="input-tienta py-2 text-black"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-montserrat uppercase tracking-widest text-black/50 mb-1.5">
                    Concepto / Motivo de Auditoría
                  </label>
                  <textarea
                    required
                    placeholder="Ej. Promo especial apertura / compensación por retraso"
                    value={detalleManual}
                    onChange={(e) => setDetalleManual(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:border-tienta-gold focus:outline-none focus:ring-1 focus:ring-tienta-gold transition-all duration-300 placeholder:text-black/30 text-black h-20 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingManual}
                  className="w-full btn-tienta-outline py-3 text-xs tracking-wider cursor-pointer"
                >
                  {loadingManual ? 'Procesando...' : 'Aplicar Carga Manual'}
                </button>
              </form>
            </div>

          </div>

          {/* Catálogo de Premios y Canjes */}
          <div className="lg:col-span-2 space-y-6">
            
            <div className="bg-white border border-black/5 rounded-3xl p-6 sm:p-8 shadow-sm text-left">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Gift className="text-tienta-teal" size={20} />
                  <h3 className="text-lg font-montserrat font-bold tracking-wider text-tienta-teal uppercase">
                    Canje de Premios
                  </h3>
                </div>
                <span className="text-[10px] text-black/40 font-montserrat uppercase tracking-widest">
                  Saldo del Cliente: {cliente.puntos_actuales} pts
                </span>
              </div>

              {premios.length === 0 ? (
                <p className="text-sm text-black/40 py-8 text-center">No hay premios cargados en el catálogo actualmente.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {premios.map((premio) => {
                    const noAlcanza = cliente.puntos_actuales < premio.puntos_requeridos
                    return (
                      <div 
                        key={premio.id} 
                        className={`border rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 ${
                          noAlcanza 
                            ? 'bg-black/[0.01] border-black/5 opacity-55' 
                            : 'bg-white border-black/5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:border-tienta-gold/20'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-montserrat font-bold text-xs uppercase tracking-wide text-tienta-teal">
                              {premio.nombre}
                            </h4>
                            <span className="bg-tienta-crema text-tienta-goldDark px-2.5 py-0.5 rounded-full text-[9px] font-montserrat uppercase tracking-wider font-bold">
                              {premio.puntos_requeridos} pts
                            </span>
                          </div>
                          <p className="text-[11px] text-black/60 font-lato leading-relaxed mb-4">
                            {premio.descripcion || 'Sin descripción disponible.'}
                          </p>
                        </div>

                        <button
                          onClick={() => handleCanjearPremio(premio)}
                          disabled={noAlcanza}
                          className={`w-full py-2.5 rounded-full font-montserrat uppercase tracking-widest text-[9px] font-bold cursor-pointer transition-all duration-200 ${
                            noAlcanza
                              ? 'bg-black/5 text-black/30 cursor-not-allowed'
                              : 'bg-tienta-gold text-white hover:bg-tienta-teal'
                          }`}
                        >
                          {noAlcanza ? 'Puntos Insuficientes' : 'Canjear Premio'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Historial Reciente de Operaciones */}
            <div className="bg-white border border-black/5 rounded-3xl p-6 sm:p-8 shadow-sm text-left">
              <h3 className="text-lg font-montserrat font-bold tracking-wider text-tienta-teal mb-6 uppercase">
                Historial Reciente (Últimos 10 movimientos)
              </h3>

              {loadingHistorial ? (
                <div className="flex items-center justify-center py-8 gap-2 text-black/50 text-xs">
                  <RefreshCw size={14} className="animate-spin" /> Cargando historial...
                </div>
              ) : historial.length === 0 ? (
                <p className="text-sm text-black/40 py-8 text-center">Este cliente aún no registra transacciones.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-lato text-left">
                    <thead>
                      <tr className="border-b border-black/5 text-black/40 font-montserrat uppercase text-[9px] tracking-wider">
                        <th className="pb-3 font-semibold">Fecha</th>
                        <th className="pb-3 font-semibold">Operación</th>
                        <th className="pb-3 font-semibold">Ticket/Ref</th>
                        <th className="pb-3 font-semibold text-right">Importe</th>
                        <th className="pb-3 font-semibold text-right">Puntos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {historial.map((tr) => (
                        <tr key={tr.id} className="hover:bg-tienta-crema/20">
                          <td className="py-3 text-black/60">
                            {new Date(tr.created_at).toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="py-3">
                            <span className="font-semibold block text-black">
                              {tr.tipo === 'carga_compra' ? 'Compra' : tr.tipo === 'carga_manual' ? 'Carga Manual' : 'Canje'}
                            </span>
                            <span className="text-[10px] text-black/40 block mt-0.5">{tr.detalle}</span>
                          </td>
                          <td className="py-3 text-black/50 font-semibold">
                            {tr.ticket_factura || '-'}
                          </td>
                          <td className="py-3 text-right font-semibold text-black/75">
                            {tr.importe ? `$${Number(tr.importe).toLocaleString('es-AR')}` : '-'}
                          </td>
                          <td className={`py-3 text-right font-bold font-montserrat text-sm ${
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

          </div>

        </div>
      )}

      {/* Si no hay búsqueda o está vacío */}
      {!cliente && !loadingSearch && (
        <div className="bg-white/40 border border-dashed border-black/10 rounded-3xl py-24 text-center">
          <IceCream className="mx-auto text-tienta-teal/20 mb-4" size={48} />
          <h3 className="font-montserrat font-bold text-sm tracking-widest text-tienta-teal/40 uppercase">
            Ingresá el DNI del socio para operar en caja
          </h3>
          <p className="text-xs text-black/30 mt-1 max-w-sm mx-auto font-lato leading-relaxed">
            Desde aquí podrás asignar puntos por consumos, realizar canjes de premios e ingresar ajustes de auditoría con seguridad.
          </p>
        </div>
      )}

    </div>
  )
}
