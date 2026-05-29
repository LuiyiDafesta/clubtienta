import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  Layers, RefreshCw, Search, Mail, MessageSquare, 
  ChevronLeft, ChevronRight, Edit
} from 'lucide-react'

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
  fecha_nacimiento?: string | null
  nivel_manual?: boolean
}

export default function Crm() {
  const [clientes, setClientes] = useState<ClienteCRM[]>([])
  const [loading, setLoading] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(0)
  const [totalFilas, setTotalFilas] = useState(0)
  const itemsPorPagina = 15

  // Estados para Modal de Edición de Perfil
  const [editingCliente, setEditingCliente] = useState<ClienteCRM | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editApellido, setEditApellido] = useState('')
  const [editTelefono, setEditTelefono] = useState('')
  const [editFechaNacimiento, setEditFechaNacimiento] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    fetchClientes()
  }, [pagina])

  const fetchClientes = async () => {
    setLoading(true)
    try {
      let queryBuilder = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('rol', 'client')
        
      if (busqueda.trim()) {
        const searchVal = busqueda.trim()
        queryBuilder = queryBuilder.or(
          `dni.ilike.%${searchVal}%,nombre.ilike.%${searchVal}%,apellido.ilike.%${searchVal}%,email.ilike.%${searchVal}%`
        )
      }

      const start = pagina * itemsPorPagina
      const end = start + itemsPorPagina - 1
      
      const { data, count, error } = await queryBuilder
        .order('created_at', { ascending: false })
        .range(start, end)

      if (error) throw error
      if (data) setClientes(data)
      if (count !== null) setTotalFilas(count)
    } catch (err) {
      console.error('Error fetching CRM clients:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault()
    setPagina(0)
    fetchClientes()
  }

  const handleResetBusqueda = () => {
    setBusqueda('')
    setPagina(0)
    setTimeout(() => {
      fetchClientes()
    }, 50)
  }

  const handleCambiarNivel = async (clienteId: string, value: string) => {
    try {
      const isManual = value !== 'auto'
      const updates: any = {
        nivel_manual: isManual
      }
      if (isManual) {
        updates.nivel = value
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', clienteId)

      if (error) throw error

      setClientes(prev => prev.map(c => {
        if (c.id === clienteId) {
          return {
            ...c,
            nivel_manual: isManual,
            nivel: isManual ? value : c.nivel
          }
        }
        return c
      }))

      if (!isManual) {
        setTimeout(() => {
          fetchClientes()
        }, 150)
      }
    } catch (err: any) {
      console.error('Error al cambiar nivel:', err)
      alert('Error al actualizar membresía: ' + err.message)
    }
  }

  // Cargar datos en el formulario del modal al seleccionar cliente
  useEffect(() => {
    if (editingCliente) {
      setEditNombre(editingCliente.nombre || '')
      setEditApellido(editingCliente.apellido || '')
      setEditTelefono(editingCliente.telefono || '')
      setEditFechaNacimiento(editingCliente.fecha_nacimiento || '')
    }
  }, [editingCliente])

  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCliente) return
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
        .eq('id', editingCliente.id)

      if (error) throw error

      // 3. Actualizar estado local
      setClientes(prev => prev.map(c => {
        if (c.id === editingCliente.id) {
          return {
            ...c,
            nombre: editNombre.trim(),
            apellido: editApellido.trim(),
            telefono: cleanWhatsapp,
            fecha_nacimiento: editFechaNacimiento || null
          }
        }
        return c
      }))

      setEditingCliente(null)
    } catch (err: any) {
      console.error('Error al editar cliente:', err)
      alert(err.message || 'Error al guardar los datos del cliente.')
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-left font-lato">
      
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-montserrat uppercase tracking-[0.25em] text-tienta-goldDark font-extrabold">
            ClubTienta
          </span>
          <h1 className="text-3xl font-montserrat font-extrabold text-tienta-teal uppercase tracking-wider mt-1 flex items-center gap-2.5">
            <Layers size={28} className="text-tienta-gold" /> Gestión de Clientes (CRM)
          </h1>
          <p className="text-sm text-black/75 font-lato mt-1 font-medium">
            Visualizá la base de datos de socios, buscá por datos personales y contactalos de forma rápida.
          </p>
        </div>

        <button
          onClick={fetchClientes}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-tienta-goldDark font-bold hover:text-tienta-teal tracking-wider uppercase font-montserrat cursor-pointer border border-tienta-gold/20 px-4 py-2 rounded-full hover:bg-tienta-gold/5"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> {loading ? 'Cargando...' : 'Actualizar CRM'}
        </button>
      </div>

      {/* Contenedor Principal */}
      <div className="bg-white border border-black/5 rounded-3xl shadow-sm overflow-hidden">
        
        {/* Barra superior de herramientas: Buscador */}
        <div className="p-5 sm:px-8 border-b border-black/5 bg-tienta-crema/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <form onSubmit={handleBuscar} className="flex gap-2 w-full max-w-lg">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/50">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Buscar por DNI, Nombre, Apellido, Email..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="input-tienta pl-11 py-2 text-sm font-semibold w-full bg-white"
              />
            </div>
            <button
              type="submit"
              className="btn-tienta-teal px-5 py-2 text-xs font-bold font-montserrat uppercase tracking-wider cursor-pointer"
            >
              Buscar
            </button>
            {busqueda && (
              <button
                type="button"
                onClick={handleResetBusqueda}
                className="btn-tienta-outline px-4 py-2 text-xs font-bold font-montserrat uppercase tracking-wider cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </form>

          <div className="text-xs text-black/55 font-bold tracking-wide font-montserrat">
            Total de socios registrados: <span className="text-tienta-teal font-extrabold">{totalFilas}</span>
          </div>
        </div>

        {/* Tabla CRM */}
        {loading ? (
          <div className="flex justify-center items-center py-16 gap-2 text-black/60 text-sm">
            <RefreshCw size={16} className="animate-spin" /> Cargando listado de clientes...
          </div>
        ) : clientes.length === 0 ? (
          <div className="p-16 text-center">
            <Search className="text-black/25 mx-auto mb-3" size={32} />
            <p className="text-sm font-semibold text-black/50">No se encontraron clientes que coincidan con la búsqueda.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-tienta-crema/5 border-b border-black/5 text-[11px] font-montserrat uppercase tracking-wider text-black/65 font-extrabold">
                    <th className="py-4 px-6 sm:px-8">Fecha Reg.</th>
                    <th className="py-4 px-6">DNI / Socio</th>
                    <th className="py-4 px-6">Contacto</th>
                    <th className="py-4 px-6">Nivel</th>
                    <th className="py-4 px-6 text-right">Puntos Disponibles</th>
                    <th className="py-4 px-6 sm:px-8 text-center">Acciones Comerciales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 font-semibold text-black/85">
                  {clientes.map((c) => (
                    <tr key={c.id} className="hover:bg-tienta-crema/5 transition-colors duration-150">
                      <td className="py-4 px-6 sm:px-8 text-black/70 text-xs font-mono">
                        {new Date(c.created_at).toLocaleDateString('es-AR')}
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-bold block text-black text-sm">
                          {c.nombre} {c.apellido}
                        </span>
                        <span className="text-xs text-black/60 block mt-0.5 font-mono">DNI: {c.dni}</span>
                        {c.fecha_nacimiento && (
                          <span className="text-[10px] text-tienta-goldDark block mt-0.5 font-bold">
                            🎂 Cumple: {new Date(c.fecha_nacimiento + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-xs">
                        <div className="text-black">{c.email}</div>
                        <div className="text-black/60 mt-0.5">{c.telefono || 'Sin teléfono'}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-1">
                          <select
                            value={c.nivel_manual ? c.nivel : 'auto'}
                            onChange={(e) => handleCambiarNivel(c.id, e.target.value)}
                            className="bg-transparent text-xs font-bold font-montserrat text-tienta-teal focus:outline-none border-b border-black/10 pb-0.5 w-28 cursor-pointer uppercase tracking-wider"
                          >
                            <option value="auto">🔄 Automático</option>
                            <option value="Gold">👑 Oro (Manual)</option>
                            <option value="Platinum">💎 Platino (Manual)</option>
                          </select>
                          <span className={`text-[9px] font-bold font-montserrat uppercase tracking-wider ${
                            c.nivel_manual 
                              ? 'text-tienta-goldDark' 
                              : 'text-black/40'
                          }`}>
                            {c.nivel_manual ? 'Fijado a mano' : `Activo: ${c.nivel}`}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right font-extrabold text-tienta-teal text-base font-montserrat">
                        {c.puntos_actuales} <span className="text-[10px] font-bold text-black/65">pts</span>
                      </td>
                      <td className="py-4 px-6 sm:px-8">
                        <div className="flex justify-center items-center gap-2">
                          {/* Editar Perfil */}
                          <button
                            onClick={() => setEditingCliente(c)}
                            className="inline-flex items-center gap-1.5 bg-tienta-gold/10 text-tienta-goldDark hover:bg-tienta-gold hover:text-white border border-tienta-gold/25 px-3 py-1.5 rounded-full text-[10px] font-montserrat uppercase font-bold tracking-wider transition-all duration-300 cursor-pointer"
                            title="Editar Datos de Socio"
                          >
                            <Edit size={11} /> Editar
                          </button>
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
            {totalFilas > itemsPorPagina && (
              <div className="flex items-center justify-between border-t border-black/5 p-5 sm:px-8">
                <span className="text-xs text-black/60 font-semibold font-lato">
                  Mostrando del {pagina * itemsPorPagina + 1} al {Math.min((pagina + 1) * itemsPorPagina, totalFilas)} de {totalFilas} socios
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagina(p => Math.max(0, p - 1))}
                    disabled={pagina === 0}
                    className="p-2 rounded-full border border-black/10 hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200"
                    title="Página Anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm font-bold font-montserrat text-tienta-teal px-2">
                    {pagina + 1}
                  </span>
                  <button
                    onClick={() => setPagina(p => ((p + 1) * itemsPorPagina < totalFilas ? p + 1 : p))}
                    disabled={(pagina + 1) * itemsPorPagina >= totalFilas}
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

      {/* Modal de Edición de Perfil */}
      {editingCliente && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in text-left">
          <div className="bg-white border border-black/10 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl animate-scale-up">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[10px] font-montserrat uppercase tracking-[0.2em] text-tienta-goldDark font-extrabold">
                  ClubTienta CRM
                </span>
                <h3 className="text-xl font-montserrat font-extrabold text-tienta-teal uppercase tracking-wider mt-0.5">
                  Editar Datos de Socio
                </h3>
              </div>
              <button
                onClick={() => setEditingCliente(null)}
                className="text-black/40 hover:text-black font-bold text-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarEdicion} className="space-y-4">
              
              {/* Bloque Fijo: DNI y Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-tienta-crema/40 border border-black/5 p-4 rounded-2xl">
                <div>
                  <span className="block text-[9px] font-montserrat uppercase tracking-wider font-extrabold text-black/45 mb-1">
                    DNI (No editable)
                  </span>
                  <span className="text-sm font-bold text-black/70 font-mono tracking-wide">
                    {editingCliente.dni}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-montserrat uppercase tracking-wider font-extrabold text-black/45 mb-1">
                    Email (No editable)
                  </span>
                  <span className="text-sm font-bold text-black/70 font-mono truncate block max-w-full">
                    {editingCliente.email}
                  </span>
                </div>
              </div>

              {/* Grid de Nombre y Apellido */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal mb-2">
                    Nombre
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juan"
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    className="input-tienta py-2.5 text-black font-semibold text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal mb-2">
                    Apellido
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Pérez"
                    value={editApellido}
                    onChange={(e) => setEditApellido(e.target.value)}
                    className="input-tienta py-2.5 text-black font-semibold text-sm bg-white"
                  />
                </div>
              </div>

              {/* Teléfono (WhatsApp) */}
              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal mb-2">
                  WhatsApp (10 dígitos sin 0 ni 15)
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ej. 3416123456"
                  value={editTelefono}
                  onChange={(e) => setEditTelefono(e.target.value)}
                  className="input-tienta py-2.5 text-black font-semibold text-sm bg-white"
                />
              </div>

              {/* Fecha de Nacimiento */}
              <div>
                <label className="block text-xs font-montserrat uppercase tracking-wider font-extrabold text-tienta-teal mb-2">
                  Fecha de Nacimiento
                </label>
                <input
                  type="date"
                  required
                  value={editFechaNacimiento}
                  onChange={(e) => setEditFechaNacimiento(e.target.value)}
                  className="input-tienta py-2.5 text-black font-semibold text-sm bg-white"
                />
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-black/5">
                <button
                  type="button"
                  onClick={() => setEditingCliente(null)}
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
