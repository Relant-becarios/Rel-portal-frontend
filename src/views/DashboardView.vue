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
  <div :class="esModoOscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'" class="flex min-h-screen transition-colors duration-200">
    <Sidebar :dark="esModoOscuro" />
    
    <div class="flex-1 flex flex-col min-w-0">
      <header :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="h-16 border-b px-8 flex justify-between items-center shrink-0 transition-colors">
        <div class="flex items-center space-x-3">
          <span class="text-xs font-black bg-red-700 text-white px-2 py-0.5 rounded-md tracking-wider">RELANT HQ</span>
          <h2 class="text-lg font-black tracking-tight">Mesa de Control Central</h2>
        </div>
        <div class="flex items-center space-x-4">
          <div v-if="!loading" :class="esAdmin ? 'bg-red-950/40 border-red-900/40 text-red-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400'" class="px-3 py-1.5 rounded-xl border text-xs font-black tracking-wider uppercase">
            {{ esAdmin ? '🛡️ Rol: ADMINISTRADOR' : '👤 Rango: EMPLEADO' }}
          </div>
          <button @click="esModoOscuro = !esModoOscuro" class="px-4 py-2 rounded-xl border border-zinc-800 text-xs font-semibold cursor-pointer">
            {{ esModoOscuro ? '☀️ Claro' : '🌙 Oscuro' }}
          </button>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto p-8 space-y-8">
        
        <div v-if="ticketActivoWorkspace" class="fixed inset-0 bg-zinc-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div class="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-fadeIn">
            
            <div class="bg-linear-to-r from-red-950/40 to-zinc-900 p-6 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <span class="text-xs font-bold text-red-400 uppercase tracking-widest">Mesa de Trabajo de Alta Prioridad</span>
                <h3 class="text-xl font-black text-white mt-1">{{ ticketActivoWorkspace.titulo }}</h3>
              </div>
              <button @click="ticketIdActivo = null" class="text-zinc-400 hover:text-white font-bold bg-zinc-800 px-4 py-2 rounded-xl text-xs cursor-pointer">
                ✕ Minimizar Panel
              </button>
            </div>

            <div class="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto">
              
              <div class="bg-zinc-950 border border-zinc-800/60 rounded-2xl p-5 flex flex-col space-y-4">
                <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-800 pb-2">Diagnóstico e Historial</h4>
                
                <div class="grid grid-cols-2 gap-4 bg-zinc-900/30 p-3 rounded-xl border border-zinc-800/50">
                  <div>
                    <label class="text-[9px] uppercase font-bold text-zinc-500 block">De (Creador)</label>
                    <p class="text-xs font-bold text-red-400 mt-0.5 truncate" :title="ticketActivoWorkspace.creador?.email">
                      {{ ticketActivoWorkspace.creador?.nombre || ticketActivoWorkspace.creador?.email || 'Mesa Central' }}
                    </p>
                  </div>
                  <div>
                    <label class="text-[9px] uppercase font-bold text-zinc-500 block">Para (Asignado)</label>
                    <p class="text-xs font-bold text-amber-400 mt-0.5 truncate" :title="ticketActivoWorkspace.asignado?.email">
                      {{ ticketActivoWorkspace.asignado?.nombre || ticketActivoWorkspace.asignado?.email || 'Sin Asignar' }}
                    </p>
                  </div>
                </div>

                <div>
                  <label class="text-[10px] uppercase font-bold text-zinc-500 block">Instrucción y Descripción Inicial</label>
                  <p class="text-sm text-zinc-300 whitespace-pre-line mt-1 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/40 leading-relaxed max-h-48 overflow-y-auto font-sans">
                    {{ ticketActivoWorkspace.descripcion }}
                  </p>
                </div>

                <div v-if="ticketActivoWorkspace.comentario_admin" class="mt-2 p-4 rounded-xl bg-red-950/20 border border-red-900/40">
                  <label class="text-[10px] uppercase font-bold text-red-400 block tracking-wider">⚠️ Comentarios del Dictamen Anterior</label>
                  <p class="text-xs text-zinc-300 italic mt-1">"{{ ticketActivoWorkspace.comentario_admin }}"</p>
                </div>
              </div>

              <div class="bg-zinc-950 border border-zinc-800/60 rounded-2xl p-5 flex flex-col justify-between overflow-hidden">
                <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-800 pb-2">Línea de Tiempo Operacional</h4>
                
                <div class="flex-1 my-4 overflow-y-auto space-y-2.5 pr-2 font-mono text-xs">
                  <div v-if="bitacoraProgresoAcumulada.length === 0" class="text-zinc-600 text-center py-12">No hay logs registrados en este folio.</div>
                  <div v-for="(log, i) in bitacoraProgresoAcumulada" :key="i" class="p-2 rounded-lg bg-zinc-900 border border-zinc-800/40 text-zinc-300">
                    {{ log }}
                  </div>
                </div>

                <div v-if="ticketActivoWorkspace.estado === 'TRABAJANDO'" class="space-y-3 pt-2 border-t border-zinc-800">
                  <div class="flex gap-2">
                    <input v-model="notaProgresoActual" @keyup.enter="registrarProgresoEnCaliente" type="text" placeholder="Escribe un avance o mensaje..." class="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs flex-1 text-white focus:outline-hidden focus:border-red-700" />
                    <button @click="registrarProgresoEnCaliente" class="bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer">➕ Log</button>
                  </div>
                  <button @click="despacharAuditoriaAdmin" class="w-full bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl shadow-md transition cursor-pointer">
                    🏁 Enviar a Validación de Administración
                  </button>
                </div>

                <div v-if="ticketActivoWorkspace.estado === 'COMPLETADO' && esAdmin" class="space-y-3 pt-2 border-t border-zinc-800">
                  <div>
                    <label class="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Acta o Justificación del Dictamen (Obligatorio)</label>
                    <input v-model="comentarioAdmin" type="text" placeholder="Escribe el porqué de la liberación o del rechazo..." class="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs w-full text-white focus:outline-hidden focus:border-red-700" />
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <button @click="ejecutarDictamenAdmin(true)" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3 rounded-xl cursor-pointer">✓ Aprobar Ticket</button>
                    <button @click="ejecutarDictamenAdmin(false)" class="bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-3 rounded-xl cursor-pointer">✕ Rechazar y Devolver</button>
                  </div>
                </div>

                <div v-if="ticketActivoWorkspace.estado === 'COMPLETADO' && !esAdmin" class="bg-zinc-900/60 p-4 rounded-xl border border-dashed border-zinc-800 text-center">
                  <span class="text-xs font-bold text-zinc-500 uppercase tracking-wider block">⏳ Requerimiento Bloqueado</span>
                  <p class="text-[11px] text-zinc-400 mt-1">El reporte de progreso está bajo auditoría del cuerpo de administración.</p>
                </div>
              </div>

            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div class="xl:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div v-for="kpi in [
              { label: 'Volumen Monitoreado', val: totalTickets, color: 'text-red-400' },
              { label: 'Tus Pendientes', val: ticketsPendientes, color: 'text-amber-400' },
              { label: 'Tus Cierres', val: ticketsCompletados, color: 'text-emerald-400' }
            ]" :key="kpi.label" :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="p-6 rounded-2xl border flex items-center justify-between transition-colors">
              <div>
                <p class="text-xs font-bold text-zinc-400 uppercase tracking-wider">{{ kpi.label }}</p>
                <p :class="[kpi.color, 'text-3xl font-black mt-0.5']">{{ kpi.val }}</p>
              </div>
            </div>
          </div>
          <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="p-5 rounded-2xl border flex items-center justify-between">
            <p class="text-xs font-bold text-zinc-400 uppercase tracking-wider">⚡ Canal de Seguridad Activo</p>
            <span class="text-[10px] font-mono text-zinc-500">PostgreSQL + SSL</span>
          </div>
        </div>

        <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="max-w-4xl rounded-2xl border shadow-md overflow-hidden">
          <div class="bg-red-700 p-4 text-white flex items-center justify-between border-b border-zinc-800">
            <h3 class="text-xs font-black tracking-wider uppercase">Generar Requerimiento Dirigido</h3>
          </div>
          <form @submit.prevent="manejarEnviarTicket" class="p-6 space-y-4">
            <div class="flex items-center border-b pb-2 border-zinc-800">
              <label class="w-16 text-xs font-bold text-zinc-400 uppercase">Para:</label>
              <input v-model="correoDestinatario" type="text" required :class="esModoOscuro ? 'bg-transparent text-white' : 'bg-transparent text-slate-900'" class="w-full text-sm focus:outline-hidden" placeholder="correo@relant.com o Nombre del usuario" />
            </div>
            <div class="flex items-center border-b pb-2 border-zinc-800">
              <label class="w-16 text-xs font-bold text-zinc-400 uppercase">Asunto:</label>
              <input v-model="asuntoTicket" type="text" required :class="esModoOscuro ? 'bg-transparent text-white font-bold' : 'bg-transparent text-slate-900'" class="w-full text-sm focus:outline-hidden" placeholder="Folio o incidencia" />
            </div>
            <textarea v-model="cuerpoTicket" rows="3" required :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200'" class="w-full p-4 text-sm rounded-xl border focus:outline-hidden" placeholder="Especificaciones técnicas..."></textarea>
            <div class="flex justify-end"><button type="submit" class="bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase px-6 py-2.5 rounded-xl cursor-pointer">Despachar e Indizar Ticket</button></div>
          </form>
        </div>

        <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl border">
          <div class="flex items-center space-x-1 overflow-x-auto">
            <button v-for="opcion in [
              { id: 'TODOS', texto: '📂 Tus Folios' },
              { id: 'PENDIENTES', texto: '⏳ En Desarrollo' },
              { id: 'COMPLETADO', texto: '🏁 Por Validar' },
              { id: 'CONCLUIDOS', texto: '🔒 Historial Cerrado' }
            ]" :key="opcion.id" @click="filtroEstado = opcion.id"
            :class="filtroEstado === opcion.id ? 'bg-red-700 text-white font-semibold shadow-md' : 'text-zinc-400 hover:bg-zinc-800'" class="px-4 py-2 rounded-xl text-xs cursor-pointer">
              {{ opcion.texto }}
            </button>
          </div>
          <input v-model="busquedaQuery" type="text" placeholder="Buscar folio..." class="bg-zinc-800 border border-zinc-700 text-white pl-4 pr-4 py-2 text-xs rounded-xl focus:outline-hidden" />
        </div>

        <div class="space-y-6">
          <div v-if="loading" class="text-center py-12 text-zinc-400 animate-pulse text-sm">Sincronizando registros con Prisma...</div>
          <div v-else-if="error" class="text-center py-12 text-red-500 text-sm font-semibold">Error de comunicación.</div>
          <div v-else-if="ticketsFiltradosConPrivacidad.length === 0" class="text-center py-16 text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-2xl text-sm">Bandeja vacía en esta sección.</div>

          <div v-else v-for="ticket in ticketsFiltradosConPrivacidad" :key="ticket.id" 
               :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="rounded-2xl border p-6 space-y-4">
            
            <div class="flex flex-wrap justify-between items-center gap-4 border-b border-zinc-800 pb-3">
              <div class="flex flex-wrap items-center gap-3 text-xs">
                <span class="font-mono font-bold bg-zinc-950 px-2.5 py-1 rounded-md text-zinc-300 border border-zinc-800">{{ 'RLN-' + ticket.id.substring(0,6).toUpperCase() }}</span>
                
                <span class="text-zinc-400 font-semibold bg-zinc-950/60 px-2.5 py-1 rounded-md border border-zinc-800 flex items-center gap-1.5">
                  📩 De: <strong class="text-red-400" :title="ticket.creador?.email">{{ ticket.creador?.nombre || ticket.creador?.email || 'Mesa Central' }}</strong>
                  <span class="text-zinc-600 font-black">➡️</span>
                  👤 Para: <strong class="text-amber-400" :title="ticket.asignado?.email">{{ ticket.asignado?.nombre || ticket.asignado?.email || 'Sin Asignar' }}</strong>
                </span>
              </div>
              <span class="text-xs font-bold px-3 py-1 rounded-lg border border-zinc-800 bg-zinc-950">{{ formatearTiempoSLA(ticket) }}</span>
            </div>

            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div class="flex-1">
                <h4 class="text-lg font-black tracking-tight text-white">{{ ticket.titulo }}</h4>
                <p class="text-xs text-zinc-300 mt-2 whitespace-pre-line bg-zinc-950/40 p-3 rounded-xl border border-zinc-800/40 leading-relaxed font-sans max-h-48 overflow-y-auto">
                  {{ ticket.descripcion }}
                </p>
                
                <div v-if="ticket.comentario_admin" class="mt-3 p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs max-w-2xl">
                  <span class="font-bold text-red-400 block mb-0.5">💬 Justificación de Administración:</span>
                  <p class="text-zinc-300 italic">"{{ ticket.comentario_admin }}"</p>
                  <span v-if="ticket.fecha_evaluacion" class="text-[10px] text-zinc-500 block mt-1">
                    Evaluado el: {{ parsearFecha(ticket.fecha_evaluacion)?.toLocaleString() }}
                  </span>
                </div>
              </div>

              <div class="shrink-0 flex gap-2 w-full md:w-auto">
                <button v-if="ticket.estado === 'RECIBIDO'" @click="activarProcesamientoTicket(ticket)" class="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition cursor-pointer w-full md:w-auto">
                  🛠️ Procesar Requerimiento
                </button>
                <button v-if="ticket.estado === 'TRABAJANDO'" @click="ticketIdActivo = ticket.id" class="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition cursor-pointer w-full md:w-auto">
                  💼 Abrir Panel Grande / Chat
                </button>
                <button v-if="ticket.estado === 'COMPLETADO'" @click="ticketIdActivo = ticket.id" class="bg-linear-to-r from-red-950 to-zinc-900 border border-red-900/40 text-red-400 text-xs font-black px-5 py-2.5 rounded-xl transition cursor-pointer w-full md:w-auto">
                  {{ esAdmin ? '🛡️ Auditar y Dictaminar Folio' : '⏳ Ver Estatus en Revisión' }}
                </button>
                <button v-if="ticket.estado === 'APROBADO'" @click="ticketIdActivo = ticket.id" class="text-xs font-bold tracking-wider uppercase px-4 py-2 rounded-xl border border-dashed border-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer text-center w-full md:w-auto select-none">
                  🔒 Liberado (Ver Chat)
                </button>
                
                <div v-if="ticket.estado === 'RECHAZADO'" class="flex gap-2 w-full md:w-auto">
                  <button @click="ticketIdActivo = ticket.id" class="text-xs font-bold tracking-wider uppercase px-4 py-2 rounded-xl border border-dashed border-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer text-center flex-1 md:flex-initial">
                    👁️ Ver Acta
                  </button>
                  <button @click="activarProcesamientoTicket(ticket)" class="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer flex-1 md:flex-initial text-center">
                    🔄 Reabrir y Corregir
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
</style>