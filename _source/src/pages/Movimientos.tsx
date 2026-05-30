import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, Link } from 'react-router-dom'
import { ClipboardList, ArrowLeft, RefreshCw, Filter, Calendar, Award, DollarSign, Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface Transaccion {
  id: string
  tipo: string
  puntos: number
  importe: number | null
  ticket_factura: string | null
  detalle: string
  created_at: string
  promocion_id?: string | null
  descuento_aplicado?: number | null
  promocion?: {
    titulo: string
  } | null
}

export default function Movimientos() {
  const navigate = useNavigate()
  const [historial, setHistorial] = useState<Transaccion[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterTipo, setFilterTipo] = useState<string>('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const itemsPerPage = 10

  useEffect(() => {
    fetchMovimientos()
  }, [])

  const fetchMovimientos = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        navigate('/')
        return
      }

      const { data: txs, error } = await supabase
        .from('transacciones')
        .select('*, promocion:promociones(titulo)')
        .eq('cliente_id', session.user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (txs) setHistorial(txs)
    } catch (err) {
      console.error('Error fetching transactions:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchMovimientos()
    setRefreshing(false)
  }

  // Filtrar el historial según el tipo seleccionado y la búsqueda por texto
  const historialFiltrado = historial.filter(tx => {
    const matchesTipo = 
      filterTipo === 'todos' || 
      (filterTipo === 'cargas' && tx.puntos > 0) || 
      (filterTipo === 'canjes' && tx.puntos < 0)

    const cleanSearch = searchQuery.toLowerCase().trim()
    const matchesSearch = 
      !cleanSearch || 
      tx.detalle.toLowerCase().includes(cleanSearch) || 
      (tx.ticket_factura && tx.ticket_factura.toLowerCase().includes(cleanSearch)) ||
      (tx.promocion?.titulo && tx.promocion.titulo.toLowerCase().includes(cleanSearch)) ||
      (tx.tipo === 'carga_compra' ? 'compra' : tx.tipo === 'carga_manual' ? 'bono carga' : 'canje').includes(cleanSearch)

    return matchesTipo && matchesSearch
  })

  const totalItems = historialFiltrado.length
  const startIndex = currentPage * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedHistorial = historialFiltrado.slice(startIndex, endIndex)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-tienta-crema">
        <div className="flex items-center gap-2 text-tienta-teal text-sm font-semibold tracking-wider font-montserrat">
          <RefreshCw className="animate-spin" size={16} /> Cargando tus movimientos...
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-left font-lato">
      
      {/* Botón de Retorno */}
      <div className="mb-6">
        <Link 
          to="/dashboard" 
          className="inline-flex items-center gap-2 text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-goldDark hover:text-tienta-teal transition-colors duration-200"
        >
          <ArrowLeft size={14} /> Volver a Mi Tarjeta
        </Link>
      </div>

      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-montserrat uppercase tracking-[0.25em] text-tienta-goldDark font-extrabold">
            ClubTienta
          </span>
          <h1 className="text-3xl font-montserrat font-extrabold text-tienta-teal uppercase tracking-wider mt-1 flex items-center gap-2.5">
            <ClipboardList size={28} className="text-tienta-gold" /> Mis Movimientos
          </h1>
          <p className="text-sm text-black/75 font-lato mt-1 font-medium">
            Consultá el historial completo de tus puntos sumados por compras y tus postres canjeados.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-tienta-goldDark font-bold hover:text-tienta-teal tracking-wider uppercase font-montserrat cursor-pointer border border-tienta-gold/20 px-4 py-2 rounded-full hover:bg-tienta-gold/5"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Actualizando...' : 'Actualizar Historial'}
        </button>
      </div>

      {/* Tarjetas de Resumen Rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-black/5 p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex items-center gap-4">
          <div className="bg-green-50 text-green-600 p-3 rounded-2xl border border-green-100">
            <Award size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-montserrat font-extrabold text-black/55 tracking-wider block">Puntos Acumulados</span>
            <span className="text-2xl font-montserrat font-extrabold text-tienta-teal">
              {historial.filter(t => t.puntos > 0).reduce((acc, curr) => acc + curr.puntos, 0)} pts
            </span>
          </div>
        </div>

        <div className="bg-white border border-black/5 p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex items-center gap-4">
          <div className="bg-red-50 text-red-500 p-3 rounded-2xl border border-red-100">
            <Gift size={20} className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-montserrat font-extrabold text-black/55 tracking-wider block">Puntos Canjeados</span>
            <span className="text-2xl font-montserrat font-extrabold text-tienta-goldDark">
              {Math.abs(historial.filter(t => t.puntos < 0).reduce((acc, curr) => acc + curr.puntos, 0))} pts
            </span>
          </div>
        </div>

        <div className="bg-white border border-black/5 p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex items-center gap-4">
          <div className="bg-tienta-crema text-tienta-goldDark p-3 rounded-2xl border border-tienta-gold/20">
            <DollarSign size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-montserrat font-extrabold text-black/55 tracking-wider block">Consumo Total</span>
            <span className="text-2xl font-montserrat font-extrabold text-black/85">
              ${historial.reduce((acc, curr) => acc + Number(curr.importe || 0), 0).toLocaleString('es-AR')}
            </span>
          </div>
        </div>
      </div>

      {/* Contenedor del Listado */}
      <div className="bg-white border border-black/5 rounded-3xl shadow-sm overflow-hidden">
        
        {/* Barra superior de herramientas: Buscador y Filtros */}
        <div className="p-5 sm:px-8 border-b border-black/5 bg-tienta-crema/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md w-full">
            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/50">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Buscar por detalle o nro de ticket..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(0)
              }}
              className="input-tienta pl-11 py-2 text-sm font-semibold w-full bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal shrink-0">
              <Filter size={14} className="text-tienta-gold" /> Filtrar:
            </span>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setFilterTipo('todos')
                  setCurrentPage(0)
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold font-montserrat tracking-wider uppercase transition-colors duration-200 cursor-pointer ${
                  filterTipo === 'todos' 
                    ? 'bg-tienta-teal text-white shadow-sm' 
                    : 'bg-black/5 text-black/65 hover:bg-black/10'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => {
                  setFilterTipo('cargas')
                  setCurrentPage(0)
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold font-montserrat tracking-wider uppercase transition-colors duration-200 cursor-pointer ${
                  filterTipo === 'cargas' 
                    ? 'bg-green-600 text-white shadow-sm' 
                    : 'bg-black/5 text-black/65 hover:bg-black/10'
                }`}
              >
                Cargas
              </button>
              <button
                onClick={() => {
                  setFilterTipo('canjes')
                  setCurrentPage(0)
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold font-montserrat tracking-wider uppercase transition-colors duration-200 cursor-pointer ${
                  filterTipo === 'canjes' 
                    ? 'bg-red-500 text-white shadow-sm' 
                    : 'bg-black/5 text-black/65 hover:bg-black/10'
                }`}
              >
                Canjes
              </button>
            </div>
          </div>
        </div>

        {/* Tabla / Listado */}
        {historialFiltrado.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="text-black/25 mx-auto mb-3" size={32} />
            <p className="text-sm font-semibold text-black/50">No hay movimientos registrados para este filtro.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-tienta-crema/20 border-b border-black/5 text-[11px] font-montserrat uppercase tracking-wider text-black/65 font-extrabold">
                    <th className="py-4 px-6 sm:px-8">Fecha y Hora</th>
                    <th className="py-4 px-6">Detalle de Operación</th>
                    <th className="py-4 px-6 text-right">Importe Gastado</th>
                    <th className="py-4 px-6 sm:px-8 text-right">Puntos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {paginatedHistorial.map((tx) => (
                    <tr key={tx.id} className="hover:bg-tienta-crema/5 transition-colors duration-150">
                      {/* Fecha y Hora formateada */}
                      <td className="py-4.5 px-6 sm:px-8 text-xs font-semibold text-black/75 font-mono">
                        {new Date(tx.created_at).toLocaleString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      
                      {/* Detalle */}
                      <td className="py-4.5 px-6 text-left">
                        <span className="text-sm font-bold text-black block">
                          {tx.detalle}
                        </span>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[10px] uppercase font-montserrat font-bold tracking-wider text-black/50 inline-block">
                            {tx.tipo === 'carga_compra' ? '🛒 Compra' : tx.tipo === 'carga_manual' ? '⭐ Bono/Carga' : '🎁 Canje'}
                            {tx.ticket_factura ? ` • Ticket #${tx.ticket_factura}` : ''}
                          </span>
                          {tx.promocion?.titulo && (
                            <span className="bg-tienta-gold/15 text-tienta-goldDark border border-tienta-gold/20 text-[9px] font-montserrat font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider">
                              🏷️ Promo: {tx.promocion.titulo} {tx.descuento_aplicado && tx.descuento_aplicado > 0 ? `(-$${Number(tx.descuento_aplicado).toLocaleString('es-AR')})` : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      
                      {/* Importe Gastado */}
                      <td className="py-4.5 px-6 text-right text-sm font-bold text-black/85">
                        {tx.importe ? `$${Number(tx.importe).toLocaleString('es-AR')}` : '-'}
                      </td>
                      
                      {/* Puntos */}
                      <td className="py-4.5 px-6 sm:px-8 text-right">
                        <span className={`text-base font-extrabold font-montserrat ${
                          tx.puntos > 0 ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {tx.puntos > 0 ? `+${tx.puntos}` : tx.puntos}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalItems > itemsPerPage && (
              <div className="flex items-center justify-between border-t border-black/5 p-5 sm:px-8">
                <span className="text-xs text-black/60 font-semibold font-lato">
                  Mostrando del {startIndex + 1} al {Math.min(endIndex, totalItems)} de {totalItems} movimientos
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className="p-2 rounded-full border border-black/10 hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200"
                    title="Página Anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm font-bold font-montserrat text-tienta-teal px-2">
                    {currentPage + 1}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => ((p + 1) * itemsPerPage < totalItems ? p + 1 : p))}
                    disabled={(currentPage + 1) * itemsPerPage >= totalItems}
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

    </div>
  )
}

// Icono simple de Gift de fallback
function Gift(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  )
}
