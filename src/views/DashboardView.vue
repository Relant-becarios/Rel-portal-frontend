<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { useQuery, useMutation } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'

// --- ESTADOS DE CONTROL DE FLUJO ---
const filtroEstado = ref('TODOS')
const esModoOscuro = ref(true)
const comentarioAdmin = ref('')
const busquedaQuery = ref('')
const menuMovilAbierto = ref(false) // 🍔 Estado para controlar el menú en celulares

// --- VARIABLES DE NUEVO TICKET ---
const correoDestinatario = ref('')
const asuntoTicket = ref('')
const cuerpoTicket = ref('')

// --- WORKSPACE EN VIVO ---
const ticketIdActivo = ref<string | null>(null)
const notaProgresoActual = ref('')

// Buscador dinámico reactivo en el pool de Apollo
const ticketActivoWorkspace = computed(() => {
  if (!ticketIdActivo.value) return null
  return result.value?.misTickets?.find((t: any) => t.id === ticketIdActivo.value) || null
})

// Conversión del string del chat en renglones reactivos en la pantalla de ambos usuarios
const bitacoraProgresoAcumulada = computed(() => {
  const ticket = ticketActivoWorkspace.value
  if (!ticket) return []
  return ticket.chat ? ticket.chat.split('\n') : [`[⚙️ Sistema] Esperando primer mensaje de coordinación...`]
})

// Helper para parsear las fechas de PostgreSQL de forma segura
const parsearFecha = (fecha: any) => {
  if (!fecha) return null
  if (!isNaN(Number(fecha))) return new Date(Number(fecha))
  return new Date(fecha)
}

// Carga inicial de persistencia ante recargas accidentales
onMounted(() => {
  const guardado = localStorage.getItem('relant_active_ticket_id')
  if (guardado) ticketIdActivo.value = guardado
})

// --- 🔒 GRAPHQL API CENTRAL ---
const OBTENER_DATOS_DASHBOARD = gql`
  query GetDashboardData {
    me {
      id
      nombre
      email
      rol
    }
    misTickets {
      id
      titulo
      descripcion
      estado
      comentario_admin
      fecha_recibido
      fecha_trabajando
      fecha_completado
      fecha_evaluacion
      creadorId
      asignadoId
      chat
      creador {
        email
        nombre
      }
      asignado {
        email
        nombre
      }
    }
  }
`
const { result, loading, error, refetch } = useQuery(OBTENER_DATOS_DASHBOARD)

const CREAR_TICKET = gql`
  mutation NuevoTicket($titulo: String!, $descripcion: String!, $asignadoEmail: String) {
    crearTicket(titulo: $titulo, descripcion: $descripcion, asignadoEmail: $asignadoEmail) { id }
  }
`
const INICIAR_TRABAJO = gql` mutation Iniciar($ticketId: String!) { iniciarTrabajo(ticketId: $ticketId) { id estado } } `
const COMPLETAR_TRABAJO = gql` mutation Completar($ticketId: String!, $notas: String) { completarTrabajo(ticketId: $ticketId, notas: $notas) { id estado } } `
const EVALUAR_TICKET = gql`
  mutation Evaluar($ticketId: String!, $aprobado: Boolean!, $comentario: String!) {
    evaluarTicket(ticketId: $ticketId, aprobado: $aprobado, comentario: $comentario) { id estado }
  }
`
const ENVIAR_MENSAJE_CHAT = gql`
  mutation EnviarMensaje($ticketId: String!, $texto: String!) {
    enviarMensajeChat(ticketId: $ticketId, texto: $texto) { id chat }
  }
`

const { mutate: apiCrear } = useMutation(CREAR_TICKET)
const { mutate: apiIniciar } = useMutation(INICIAR_TRABAJO)
const { mutate: apiCompletar } = useMutation(COMPLETAR_TRABAJO)
const { mutate: apiEvaluar } = useMutation(EVALUAR_TICKET)
const { mutate: apiChat } = useMutation(ENVIAR_MENSAJE_CHAT)

const esAdmin = computed(() => result.value?.me?.rol === 'ADMIN')

const totalTickets = computed(() => ticketsFiltradosConPrivacidad.value.length)
const ticketsPendientes = computed(() => ticketsFiltradosConPrivacidad.value.filter((t: any) => t?.estado === 'RECIBIDO' || t?.estado === 'TRABAJANDO').length)
const ticketsCompletados = computed(() => ticketsFiltradosConPrivacidad.value.filter((t: any) => t?.estado === 'APROBADO').length)

const formatearTiempoSLA = (ticket: any) => {
  if (!ticket || !ticket.fecha_recibido) return 'Sin registro'
  const inicio = parsearFecha(ticket.fecha_trabajando || ticket.fecha_recibido)
  const fin = ticket.fecha_completado ? parsearFecha(ticket.fecha_completado) : new Date()
  if (!inicio || !fin) return 'Sin registro'
  const minutosTotales = Math.floor((fin.getTime() - inicio.getTime()) / 1000 / 60)
  if (ticket.estado === 'RECIBIDO') return '⏳ Esperando Atención'
  return ticket.fecha_completado ? `⏱️ Resuelto en: ${minutosTotales}m` : `🏃 En curso: ${minutosTotales}m`
}

const manejarEnviarTicket = async () => {
  if (!asuntoTicket.value || !cuerpoTicket.value) return
  try {
    await apiCrear({ 
      titulo: asuntoTicket.value, 
      descripcion: cuerpoTicket.value,
      asignadoEmail: correoDestinatario.value || null
    })
    alert('📧 Requerimiento enrutado y guardado con éxito en PostgreSQL.')
    asuntoTicket.value = ''
    cuerpoTicket.value = ''
    correoDestinatario.value = ''
    refetch()
  } catch (err: any) { alert('Error: ' + err.message) }
}

const ticketsFiltradosConPrivacidad = computed(() => {
  const tickets = result.value?.misTickets || []
  const miIdPrisma = result.value?.me?.id || ''
  const soyAdmin = esAdmin.value

  let filtrados = [...tickets]

  if (!soyAdmin) {
    filtrados = filtrados.filter((t: any) => t.asignadoId === miIdPrisma || t.creadorId === miIdPrisma)
  }

  if (filtroEstado.value === 'PENDIENTES') {
    filtrados = filtrados.filter((t: any) => t.estado === 'RECIBIDO' || t.estado === 'TRABAJANDO')
  } else if (filtroEstado.value === 'COMPLETADO') {
    filtrados = filtrados.filter((t: any) => t.estado === 'COMPLETADO')
  } else if (filtroEstado.value === 'CONCLUIDOS') {
    filtrados = filtrados.filter((t: any) => t.estado === 'APROBADO' || t.estado === 'RECHAZADO')
  }

  if (busquedaQuery.value) {
    const query = busquedaQuery.value.toLowerCase()
    filtrados = filtrados.filter((t: any) => t.titulo?.toLowerCase().includes(query) || t.descripcion?.toLowerCase().includes(query))
  }

  return filtrados
})

const activarProcesamientoTicket = async (ticket: any) => {
  try {
    await apiIniciar({ ticketId: ticket.id })
    ticketIdActivo.value = ticket.id
    localStorage.setItem('relant_active_ticket_id', ticket.id)
    refetch()
  } catch (e) {}
}

const registrarProgresoEnCaliente = async () => {
  if (!notaProgresoActual.value.trim() || !ticketIdActivo.value) return
  try {
    await apiChat({ ticketId: ticketIdActivo.value, texto: notaProgresoActual.value.trim() })
    notaProgresoActual.value = ''
    refetch()
  } catch (e: any) { alert('Error al enviar mensaje: ' + e.message) }
}

const despacharAuditoriaAdmin = async () => {
  try {
    const bitacoraFormateada = bitacoraProgresoAcumulada.value.join('\n')
    await apiCompletar({ ticketId: ticketIdActivo.value, notas: bitacoraFormateada })
    localStorage.removeItem('relant_active_ticket_id')
    ticketIdActivo.value = null
    alert('🏁 Ticket enviado de forma automatizada a la bandeja de los administradores.')
    refetch()
  } catch (e) {}
}

const ejecutarDictamenAdmin = async (aprobado: boolean) => {
  if (!comentarioAdmin.value.trim()) {
    alert('❌ Es obligatorio ingresar un comentario o acta de dictamen.')
    return
  }
  try {
    await apiEvaluar({
      ticketId: ticketIdActivo.value,
      aprobado,
      comentario: comentarioAdmin.value.trim()
    })
    localStorage.removeItem('relant_active_ticket_id')
    ticketIdActivo.value = null
    comentarioAdmin.value = ''
    alert(aprobado ? '✓ Ticket liberado y archivado con éxito.' : '✕ Ticket rechazado y devuelto a desarrollo.')
    refetch()
  } catch (e) {}
}
</script>

<template>
  <div :class="esModoOscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'" class="flex min-h-screen transition-colors duration-200 relative overflow-x-hidden">
    
    <div :class="[
      menuMovilAbierto ? 'translate-x-0' : '-translate-x-full',
      'lg:translate-x-0 fixed lg:sticky top-0 left-0 h-screen z-50 transition-transform duration-300 ease-in-out shrink-0'
    ]">
      <Sidebar :dark="esModoOscuro" />
    </div>

    <div v-if="menuMovilAbierto" @click="menuMovilAbierto = false" class="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-40"></div>
    
    <div class="flex-1 flex flex-col min-w-0 w-full">
      
      <header :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="h-16 border-b px-4 sm:px-8 flex justify-between items-center shrink-0 transition-colors">
        <div class="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <button @click="menuMovilAbierto = !menuMovilAbierto" class="lg:hidden p-1.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer mr-1 shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          <span class="text-[10px] sm:text-xs font-black bg-red-700 text-white px-2 py-0.5 rounded-md tracking-wider whitespace-nowrap shrink-0">RELANT HQ</span>
          <h2 class="text-sm sm:text-lg font-black tracking-tight truncate">Mesa de Control</h2>
        </div>
        <div class="flex items-center space-x-2 sm:space-x-4">
          <div v-if="!loading" :class="esAdmin ? 'bg-red-950/40 border-red-900/40 text-red-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400'" class="px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border text-[10px] sm:text-xs font-black tracking-wider uppercase whitespace-nowrap">
            {{ esAdmin ? '🛡️ ADMIN' : '👤 EMPLEADO' }}
          </div>
          <button @click="esModoOscuro = !esModoOscuro" class="px-2.5 sm:px-4 py-1 sm:py-2 rounded-xl border border-zinc-800 text-[10px] sm:text-xs font-semibold cursor-pointer whitespace-nowrap">
            {{ esModoOscuro ? '☀️ Claro' : '🌙 Oscuro' }}
          </button>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8 w-full max-w-7xl mx-auto">
        
        <div v-if="ticketActivoWorkspace" class="fixed inset-0 bg-zinc-950/80 backdrop-blur-md z-50 flex items-center justify-center p-0 sm:p-4">
          <div class="bg-zinc-900 border-0 sm:border border-zinc-800 rounded-none sm:rounded-3xl w-full max-w-5xl h-full sm:h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-fadeIn">
            
            <div class="bg-linear-to-r from-red-950/40 to-zinc-900 p-4 sm:p-6 border-b border-zinc-800 flex justify-between items-center shrink-0">
              <div class="min-w-0 pr-2">
                <span class="text-[10px] font-bold text-red-400 uppercase tracking-widest block">Mesa de Trabajo de Alta Prioridad</span>
                <h3 class="text-base sm:text-xl font-black text-white mt-0.5 truncate">{{ ticketActivoWorkspace.titulo }}</h3>
              </div>
              <button @click="ticketIdActivo = null" class="text-zinc-400 hover:text-white font-bold bg-zinc-800 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs cursor-pointer shrink-0">
                ✕ Cerrar
              </button>
            </div>

            <div class="flex-1 p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 overflow-y-auto content-start">
              
              <div class="bg-zinc-950 border border-zinc-800/60 rounded-2xl p-4 sm:p-5 flex flex-col space-y-4">
                <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-800 pb-2">Diagnóstico e Historial</h4>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-900/30 p-3 rounded-xl border border-zinc-800/50">
                  <div class="min-w-0">
                    <label class="text-[9px] uppercase font-bold text-zinc-500 block">De (Creador)</label>
                    <p class="text-xs font-bold text-red-400 mt-0.5 truncate" :title="ticketActivoWorkspace.creador?.email">
                      {{ ticketActivoWorkspace.creador?.nombre || ticketActivoWorkspace.creador?.email || 'Mesa Central' }}
                    </p>
                  </div>
                  <div class="min-w-0">
                    <label class="text-[9px] uppercase font-bold text-zinc-500 block">Para (Asignado)</label>
                    <p class="text-xs font-bold text-amber-400 mt-0.5 truncate" :title="ticketActivoWorkspace.asignado?.email">
                      {{ ticketActivoWorkspace.asignado?.nombre || ticketActivoWorkspace.asignado?.email || 'Sin Asignar' }}
                    </p>
                  </div>
                </div>

                <div>
                  <label class="text-[10px] uppercase font-bold text-zinc-500 block">Instrucción y Descripción Inicial</label>
                  <p class="text-sm text-zinc-300 whitespace-pre-line mt-1 bg-zinc-900/40 p-3 sm:p-4 rounded-xl border border-zinc-800/40 leading-relaxed max-h-40 sm:max-h-48 overflow-y-auto font-sans">
                    {{ ticketActivoWorkspace.descripcion }}
                  </p>
                </div>

                <div v-if="ticketActivoWorkspace.comentario_admin" class="p-3 sm:p-4 rounded-xl bg-red-950/20 border border-red-900/40">
                  <label class="text-[10px] uppercase font-bold text-red-400 block tracking-wider">⚠️ Comentarios del Dictamen Anterior</label>
                  <p class="text-xs text-zinc-300 italic mt-1">"{{ ticketActivoWorkspace.comentario_admin }}"</p>
                </div>
              </div>

              <div class="bg-zinc-950 border border-zinc-800/60 rounded-2xl p-4 sm:p-5 flex flex-col justify-between overflow-hidden min-h-87.5 md:min-h-0">
                <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-800 pb-2">Línea de Tiempo / Chat</h4>
                
                <div class="flex-1 my-3 overflow-y-auto space-y-2 pr-1 font-mono text-xs max-h-48 md:max-h-none">
                  <div v-if="bitacoraProgresoAcumulada.length === 0" class="text-zinc-600 text-center py-12">No hay mensajes registrados.</div>
                  <div v-for="(log, i) in bitacoraProgresoAcumulada" :key="i" class="p-2 rounded-lg bg-zinc-900 border border-zinc-800/40 text-zinc-300 wrap-break-word">
                    {{ log }}
                  </div>
                </div>

                <div v-if="ticketActivoWorkspace.estado === 'TRABAJANDO'" class="space-y-3 pt-2 border-t border-zinc-800 shrink-0">
                  <div class="flex gap-2">
                    <input v-model="notaProgresoActual" @keyup.enter="registrarProgresoEnCaliente" type="text" placeholder="Escribe un avance o mensaje..." class="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs flex-1 text-white focus:outline-hidden focus:border-red-700 min-w-0" />
                    <button @click="registrarProgresoEnCaliente" class="bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs px-3 py-2 rounded-xl cursor-pointer shrink-0">➕ Log</button>
                  </div>
                  <button @click="despacharAuditoriaAdmin" class="w-full bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-widest py-2.5 sm:py-3 rounded-xl shadow-md transition cursor-pointer">
                    🏁 Enviar a Validación de Administración
                  </button>
                </div>

                <div v-if="ticketActivoWorkspace.estado === 'COMPLETADO' && esAdmin" class="space-y-3 pt-2 border-t border-zinc-800 shrink-0">
                  <div>
                    <label class="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Acta o Justificación del Dictamen (Obligatorio)</label>
                    <input v-model="comentarioAdmin" type="text" placeholder="Escribe el porqué de la liberación o del rechazo..." class="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs w-full text-white focus:outline-hidden focus:border-red-700" />
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <button @click="ejecutarDictamenAdmin(true)" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer">✓ Aprobar</button>
                    <button @click="ejecutarDictamenAdmin(false)" class="bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer">✕ Rechazar</button>
                  </div>
                </div>

                <div v-if="ticketActivoWorkspace.estado === 'COMPLETADO' && !esAdmin" class="bg-zinc-900/60 p-3 rounded-xl border border-dashed border-zinc-800 text-center shrink-0">
                  <span class="text-xs font-bold text-zinc-500 tracking-wider block">⏳ Requerimiento Bloqueado</span>
                  <p class="text-[11px] text-zinc-400 mt-0.5">Bajo auditoría del cuerpo de administración.</p>
                </div>
              </div>

            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div v-for="kpi in [
            { label: 'Volumen Monitoreado', val: totalTickets, color: 'text-red-400' },
            { label: 'Tus Pendientes', val: ticketsPendientes, color: 'text-amber-400' },
            { label: 'Tus Cierres', val: ticketsCompletados, color: 'text-emerald-400' }
          ]" :key="kpi.label" :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="p-4 sm:p-6 rounded-2xl border flex items-center justify-between transition-colors">
            <div>
              <p class="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider">{{ kpi.label }}</p>
              <p :class="[kpi.color, 'text-2xl sm:text-3xl font-black mt-0.5']">{{ kpi.val }}</p>
            </div>
          </div>
          <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="p-4 rounded-2xl border flex items-center justify-between sm:col-span-2 lg:col-span-1">
            <p class="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider">⚡ Canal Activo</p>
            <span class="text-[10px] font-mono text-zinc-500">PostgreSQL + SSL</span>
          </div>
        </div>

        <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="w-full rounded-2xl border shadow-md overflow-hidden transition-colors">
          <div class="bg-red-700 p-3 sm:p-4 text-white border-b border-zinc-800">
            <h3 class="text-xs font-black tracking-wider uppercase">Generar Requerimiento Dirigido</h3>
          </div>
          <form @submit.prevent="manejarEnviarTicket" class="p-4 sm:p-6 space-y-4">
            <div class="flex items-center border-b pb-2 border-zinc-800">
              <label class="w-12 sm:w-16 text-xs font-bold text-zinc-400 uppercase">Para:</label>
              <input v-model="correoDestinatario" type="text" required :class="esModoOscuro ? 'bg-transparent text-white' : 'bg-transparent text-slate-900'" class="w-full text-sm focus:outline-hidden" placeholder="correo@relant.com o Usuario" />
            </div>
            <div class="flex items-center border-b pb-2 border-zinc-800">
              <label class="w-12 sm:w-16 text-xs font-bold text-zinc-400 uppercase">Asunto:</label>
              <input v-model="asuntoTicket" type="text" required :class="esModoOscuro ? 'bg-transparent text-white font-bold' : 'bg-transparent text-slate-900'" class="w-full text-sm focus:outline-hidden" placeholder="Folio o incidencia" />
            </div>
            <textarea v-model="cuerpoTicket" rows="3" required :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200'" class="w-full p-3 sm:p-4 text-sm rounded-xl border focus:outline-hidden" placeholder="Especificaciones técnicas..."></textarea>
            <div class="flex justify-end"><button type="submit" class="w-full sm:w-auto bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase px-6 py-2.5 rounded-xl cursor-pointer">Despachar Ticket</button></div>
          </form>
        </div>

        <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-3 sm:p-4 rounded-2xl border transition-colors">
          <div class="flex items-center space-x-1 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            <button v-for="opcion in [
              { id: 'TODOS', texto: '📂 Todos' },
              { id: 'PENDIENTES', texto: '⏳ Desarrollo' },
              { id: 'COMPLETADO', texto: '🏁 Validación' },
              { id: 'CONCLUIDOS', texto: '🔒 Historial' }
            ]" :key="opcion.id" @click="filtroEstado = opcion.id"
            :class="filtroEstado === opcion.id ? 'bg-red-700 text-white font-semibold shadow-md' : 'text-zinc-400 hover:bg-zinc-800'" class="px-3 sm:px-4 py-2 rounded-xl text-xs cursor-pointer whitespace-nowrap">
              {{ opcion.texto }}
            </button>
          </div>
          <input v-model="busquedaQuery" type="text" placeholder="Buscar folio..." class="bg-zinc-800 border border-zinc-700 text-white px-4 py-2 text-xs rounded-xl focus:outline-hidden w-full lg:w-64" />
        </div>

        <div class="space-y-4 sm:space-y-6">
          <div v-if="loading" class="text-center py-12 text-zinc-400 animate-pulse text-sm">Sincronizando registros con Prisma...</div>
          <div v-else-if="error" class="text-center py-12 text-red-500 text-sm font-semibold">Error de comunicación.</div>
          <div v-else-if="ticketsFiltradosConPrivacidad.length === 0" class="text-center py-16 text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-2xl text-sm">Bandeja vacía en esta sección.</div>

          <div v-else v-for="ticket in ticketsFiltradosConPrivacidad" :key="ticket.id" 
               :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="rounded-2xl border p-4 sm:p-6 space-y-4 transition-colors">
            
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b border-zinc-800 pb-3">
              <div class="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs min-w-0">
                <span class="font-mono font-bold bg-zinc-950 px-2 py-0.5 sm:py-1 rounded-md text-zinc-300 border border-zinc-800 shrink-0">{{ 'RLN-' + ticket.id.substring(0,6).toUpperCase() }}</span>
                <span class="text-zinc-400 font-semibold bg-zinc-950/60 px-2 py-0.5 sm:py-1 rounded-md border border-zinc-800 truncate max-w-full">
                  📩 De: <strong class="text-red-400" :title="ticket.creador?.email">{{ ticket.creador?.nombre || 'Mesa' }}</strong>
                  <span class="text-zinc-600 font-black mx-0.5">➡️</span>
                  👤 Para: <strong class="text-amber-400" :title="ticket.asignado?.email">{{ ticket.asignado?.nombre || 'Nadie' }}</strong>
                </span>
              </div>
              <span class="text-[10px] sm:text-xs font-bold px-2.5 py-0.5 sm:py-1 rounded-lg border border-zinc-800 bg-zinc-950 self-start sm:self-auto shrink-0">{{ formatearTiempoSLA(ticket) }}</span>
            </div>

            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div class="flex-1 w-full min-w-0">
                <h4 class="text-base sm:text-lg font-black tracking-tight text-white truncate">{{ ticket.titulo }}</h4>
                <p class="text-xs text-zinc-300 mt-2 whitespace-pre-line bg-zinc-950/40 p-3 rounded-xl border border-zinc-800/40 leading-relaxed font-sans max-h-36 overflow-y-auto wrap-break-word">
                  {{ ticket.descripcion }}
                </p>
                
                <div v-if="ticket.comentario_admin" class="mt-3 p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs w-full max-w-2xl">
                  <span class="font-bold text-red-400 block mb-0.5">💬 Justificación de Administración:</span>
                  <p class="text-zinc-300 italic wrap-break-word">"{{ ticket.comentario_admin }}"</p>
                  <span v-if="ticket.fecha_evaluacion" class="text-[10px] text-zinc-500 block mt-1">
                    Evaluado el: {{ parsearFecha(ticket.fecha_evaluacion)?.toLocaleString() }}
                  </span>
                </div>
              </div>

              <div class="shrink-0 flex gap-2 w-full md:w-auto">
                <button v-if="ticket.estado === 'RECIBIDO'" @click="activarProcesamientoTicket(ticket)" class="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer w-full md:w-auto text-center">
                  🛠️ Procesar Requerimiento
                </button>
                <button v-if="ticket.estado === 'TRABAJANDO'" @click="ticketIdActivo = ticket.id" class="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer w-full md:w-auto text-center">
                  💼 Abrir Panel / Chat
                </button>
                <button v-if="ticket.estado === 'COMPLETADO'" @click="ticketIdActivo = ticket.id" class="bg-linear-to-r from-red-950 to-zinc-900 border border-red-900/40 text-red-400 text-xs font-black px-4 py-2.5 rounded-xl transition cursor-pointer w-full md:w-auto text-center">
                  {{ esAdmin ? '🛡️ Auditar Folio' : '⏳ En Revisión' }}
                </button>
                <button v-if="ticket.estado === 'APROBADO'" @click="ticketIdActivo = ticket.id" class="text-xs font-bold tracking-wider uppercase px-4 py-2.5 rounded-xl border border-dashed border-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer text-center w-full md:w-auto select-none">
                  🔒 Liberado (Ver Chat)
                </button>
                
                <div v-if="ticket.estado === 'RECHAZADO'" class="flex gap-2 w-full md:w-auto">
                  <button @click="ticketIdActivo = ticket.id" class="text-xs font-bold tracking-wider uppercase px-3 py-2 rounded-xl border border-dashed border-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer text-center flex-1 md:flex-initial">
                    👁️ Ver Chat
                  </button>
                  <button @click="activarProcesamientoTicket(ticket)" class="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer flex-1 md:flex-initial text-center">
                    🔄 Reabrir
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
.animate-fadeIn {
  animation: fadeIn 0.15s ease-out forwards;
}
/* Ocultar barra de scroll en botones de filtro de móviles */
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>