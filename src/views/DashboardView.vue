<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { useQuery, useMutation } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'

const obtenerFechaHoyLocal = () => {
  const hoy = new Date()
  const anio = hoy.getFullYear()
  const mes = String(hoy.getMonth() + 1).padStart(2, '0')
  const dia = String(hoy.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

const filtroEstado = ref('TODOS')
const busquedaQuery = ref('')
const esModoOscuro = ref(true)
const comentarioAdmin = ref('')
const menuMovilAbierto = ref(false)

// Campos del formulario
const correoDestinatario = ref('')
const asuntoTicket = ref('')
const cuerpoTicket = ref('')
const horasObjetivoTicket = ref(10) // ⏱️ Horas límite por defecto
const listaArchivosBase64 = ref<{ nombre: string; data: string }[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
const prioridadTicket = ref('BAJA')
const proyectoTicket = ref('')
const usarHitoManual = ref(false)

interface Hito { id: string; title: string; completed: boolean }
interface ProyectoFirebase { id: string; name: string; status: string; tasks: Hito[] }

const mapaProyectos = ref<Record<string, ProyectoFirebase>>({})
const listaProyectos = ref<string[]>([])
const cargandoProyectos = ref(true)

const cargarProyectosFirebase = async () => {
  try {
    cargandoProyectos.value = true
    const res = await fetch('https://version-1-e3799-default-rtdb.firebaseio.com/projects.json')
    const data = await res.json()
    if (data) {
      const map: Record<string, ProyectoFirebase> = {}
      const nombres: string[] = []

      Object.entries(data).forEach(([id, p]: [string, any]) => {
        if (p && p.status !== 'completed' && p.name) {
          const nameTrim = p.name.trim()
          let tasksRaw = p.tasks || []
          let tasksArr: Hito[] = Array.isArray(tasksRaw) ? tasksRaw : Object.values(tasksRaw)
          map[nameTrim] = { id, name: nameTrim, status: p.status, tasks: tasksArr }
          nombres.push(nameTrim)
        }
      })
      mapaProyectos.value = map
      listaProyectos.value = Array.from(new Set(nombres))
    }
  } catch (err) {
    console.error('Error al consultar Firebase:', err)
  } finally {
    cargandoProyectos.value = false
  }
}

const hitosDelProyectoSeleccionado = computed(() => {
  if (!proyectoTicket.value) return []
  return mapaProyectos.value[proyectoTicket.value]?.tasks || []
})

watch(proyectoTicket, () => {
  asuntoTicket.value = ''
  usarHitoManual.value = false
})

const mostrarSugerencias = ref(false)
const fechaInicioReporte = ref(obtenerFechaHoyLocal())
const fechaFinReporte = ref(obtenerFechaHoyLocal())

const ticketIdActivo = ref<string | null>(null)
const notaProgresoActual = ref('')

interface Usuario { id: string; nombre: string; email: string }

const ticketActivoWorkspace = computed(() => {
  if (!ticketIdActivo.value) return null
  return result.value?.misTickets?.find((t: any) => t.id === ticketIdActivo.value) || null
})

const bitacoraProgresoAcumulada = computed(() => {
  const ticket = ticketActivoWorkspace.value
  if (!ticket) return []
  return ticket.chat ? ticket.chat.split('\n') : [`[⚙️ Sistema] Esperando primer mensaje de coordinación...`]
})

const usuariosSugeridos = computed(() => {
  const query = correoDestinatario.value.trim().toLowerCase()
  if (!query) return []
  const listaCompleta = result.value?.todosUsuarios || []
  return listaCompleta.filter((u: Usuario) => 
    u.nombre.toLowerCase().includes(query) || u.email.toLowerCase().includes(query)
  )
})

const seleccionarUsuarioSugerido = (usuario: Usuario) => {
  if (correoDestinatario.value.includes(',')) {
    const partes = correoDestinatario.value.split(',')
    partes.pop()
    partes.push(' ' + usuario.email)
    correoDestinatario.value = partes.join(',') + ', '
  } else {
    correoDestinatario.value = usuario.email + ', '
  }
  mostrarSugerencias.value = false
}

const ocultarSugerenciasConRetraso = () => {
  setTimeout(() => { mostrarSugerencias.value = false }, 200)
}

const manejarSubidaArchivosMultiples = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  listaArchivosBase64.value = []
  Array.from(files).forEach((file) => {
    if (file.size > 200 * 1024 * 1024) {
      alert(`⚠️ El archivo "${file.name}" supera el límite de 200MB.`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      listaArchivosBase64.value.push({
        nombre: file.name,
        data: reader.result as string
      })
    }
    reader.readAsDataURL(file)
  })
}

const parsearFecha = (fecha: any) => {
  if (!fecha) return null
  if (!isNaN(Number(fecha))) return new Date(Number(fecha))
  return new Date(fecha)
}

const obtenerColorPrioridad = (prioridad: string) => {
  switch (prioridad?.toUpperCase()) {
    case 'CRITICA': return 'bg-red-500/20 text-red-500 border-red-500/40'
    case 'ALTA': return 'bg-amber-500/20 text-amber-500 border-amber-500/40'
    case 'MEDIA': return 'bg-blue-500/20 text-blue-500 border-blue-500/40'
    default: return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/40'
  }
}

onMounted(() => {
  const temaGuardado = localStorage.getItem('relant_theme')
  esModoOscuro.value = temaGuardado ? temaGuardado === 'oscuro' : true
  const guardado = localStorage.getItem('relant_active_ticket_id')
  if (guardado) ticketIdActivo.value = guardado
  cargarProyectosFirebase()
})

const toggleTema = () => {
  esModoOscuro.value = !esModoOscuro.value
  localStorage.setItem('relant_theme', esModoOscuro.value ? 'oscuro' : 'claro')
}

// GRAPHQL
const OBTENER_DATOS_DASHBOARD = gql`
  query GetDashboardData {
    me { id nombre email rol }
    todosUsuarios { id nombre email }
    misTickets {
      id titulo descripcion estado comentario_admin fecha_recibido fecha_trabajando fecha_completado fecha_evaluacion creadorId asignadoId chat archivo archivos prioridad proyecto horasEstimadas devoluciones
      creador { email nombre }
      asignado { email nombre }
    }
  }
`
const { result, loading, error, refetch } = useQuery<{ me: any, todosUsuarios: Usuario[], misTickets: any[] }>(OBTENER_DATOS_DASHBOARD)

const CREAR_TICKET = gql`
  mutation NuevoTicket($titulo: String!, $descripcion: String!, $asignadosEmails: [String], $archivos: [String], $prioridad: String, $proyecto: String, $horasEstimadas: Int) {
    crearTicket(titulo: $titulo, descripcion: $descripcion, asignadosEmails: $asignadosEmails, archivos: $archivos, prioridad: $prioridad, proyecto: $proyecto, horasEstimadas: $horasEstimadas) { id }
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
const CAMBIAR_PRIORIDAD_MUTATION = gql`
  mutation CambiarPrioridad($ticketId: String!, $prioridad: String!) {
    cambiarPrioridadTicket(ticketId: $ticketId, prioridad: $prioridad) { id prioridad }
  }
`

const { mutate: apiCrear } = useMutation(CREAR_TICKET)
const { mutate: apiIniciar } = useMutation(INICIAR_TRABAJO)
const { mutate: apiCompletar } = useMutation(COMPLETAR_TRABAJO)
const { mutate: apiEvaluar } = useMutation(EVALUAR_TICKET)
const { mutate: apiChat } = useMutation(ENVIAR_MENSAJE_CHAT)
const { mutate: apiCambiarPrioridad } = useMutation(CAMBIAR_PRIORIDAD_MUTATION)

const esAdmin = computed(() => result.value?.me?.rol === 'ADMIN')

const ejecutarCambioPrioridad = async (ticketId: string, nuevaPrioridad: string) => {
  try {
    await apiCambiarPrioridad({ ticketId, prioridad: nuevaPrioridad })
    refetch()
  } catch (err: any) { alert('Error: ' + err.message) }
}

const manejarEnviarTicket = async () => {
  if (!asuntoTicket.value || !cuerpoTicket.value) return
  const arregloArchivosEnviables = listaArchivosBase64.value.map(f => JSON.stringify(f))
  const listaCorreos = correoDestinatario.value.split(',').map(c => c.trim()).filter(c => c.length > 0)

  try {
    await apiCrear({ 
      titulo: asuntoTicket.value, 
      descripcion: cuerpoTicket.value,
      asignadosEmails: listaCorreos,
      archivos: arregloArchivosEnviables,
      prioridad: prioridadTicket.value,
      proyecto: proyectoTicket.value || null,
      horasEstimadas: Number(horasObjetivoTicket.value) || 10
    })
    alert('📧 Requerimiento despachado con éxito.')
    asuntoTicket.value = ''
    cuerpoTicket.value = ''
    correoDestinatario.value = ''
    proyectoTicket.value = ''
    prioridadTicket.value = 'BAJA'
    horasObjetivoTicket.value = 10
    listaArchivosBase64.value = []
    if (fileInputRef.value) fileInputRef.value.value = ''
    refetch()
  } catch (err: any) { alert('Error: ' + err.message) }
}

const ticketsFiltradosConPrivacidad = computed(() => {
  const tickets = result.value?.misTickets || []
  const miIdPrisma = result.value?.me?.id || ''

  let filtrados = tickets.filter((t: any) => t.asignadoId === miIdPrisma || t.creadorId === miIdPrisma)

  if (filtroEstado.value === 'PENDIENTES') {
    filtrados = filtrados.filter((t: any) => t.estado === 'RECIBIDO' || t.estado === 'TRABAJANDO')
  } else if (filtroEstado.value === 'COMPLETADO') {
    filtrados = filtrados.filter((t: any) => t.estado === 'COMPLETADO')
  } else if (filtroEstado.value === 'CONCLUIDOS') {
    filtrados = filtrados.filter((t: any) => t.estado === 'APROBADO' || t.estado === 'RECHAZADO')
  }

  if (busquedaQuery.value) {
    const query = busquedaQuery.value.toLowerCase()
    filtrados = filtrados.filter((t: any) => 
      t.titulo?.toLowerCase().includes(query) || 
      t.descripcion?.toLowerCase().includes(query) ||
      t.id?.toLowerCase().includes(query)
    )
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
  } catch (e: any) { alert('Error: ' + e.message) }
}

const despacharAuditoriaAdmin = async () => {
  try {
    const bitacoraFormateada = bitacoraProgresoAcumulada.value.join('\n')
    await apiCompletar({ ticketId: ticketIdActivo.value, notas: bitacoraFormateada })
    localStorage.removeItem('relant_active_ticket_id')
    ticketIdActivo.value = null
    alert('🏁 Ticket enviado a validación.')
    refetch()
  } catch (e) {}
}

const ejecutarDictamenAdmin = async (aprobado: boolean) => {
  if (!comentarioAdmin.value.trim()) {
    alert('❌ Es obligatorio ingresar un comentario de dictamen.')
    return
  }

  const currentTicketId = ticketIdActivo.value
  const comentario = comentarioAdmin.value.trim()

  ticketIdActivo.value = null
  comentarioAdmin.value = ''
  localStorage.removeItem('relant_active_ticket_id')

  try {
    await apiEvaluar({ ticketId: currentTicketId, aprobado, comentario })
    await refetch()
    alert(aprobado ? '✓ Ticket liberado y archivado.' : '✕ Ticket devuelto al operador.')
  } catch (e: any) {
    alert('Error al evaluar: ' + e.message)
    ticketIdActivo.value = currentTicketId
  }
}

const cerrarWorkspace = () => {
  ticketIdActivo.value = null
  localStorage.removeItem('relant_active_ticket_id')
}
</script>

<template>
  <div :class="esModoOscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'" class="flex min-h-screen transition-colors duration-200 relative font-sans">
    
    <div :class="[menuMovilAbierto ? 'translate-x-0' : '-translate-x-full', 'lg:translate-x-0 fixed lg:sticky top-0 left-0 h-screen z-50 transition-transform duration-300 shrink-0']">
      <Sidebar :dark="esModoOscuro" />
    </div>

    <div v-if="menuMovilAbierto" @click="menuMovilAbierto = false" class="lg:hidden fixed inset-0 bg-black/60 z-40"></div>
    
    <div class="flex-1 flex flex-col min-w-0 w-full">
      <header :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="h-16 border-b px-4 sm:px-8 flex justify-between items-center shrink-0">
        <div class="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <button @click="menuMovilAbierto = !menuMovilAbierto" class="lg:hidden p-1.5 rounded-xl border border-zinc-800 text-zinc-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          <span class="text-[10px] sm:text-xs font-black bg-red-700 text-white px-2 py-0.5 rounded-md tracking-wider">RELANT HQ</span>
          <h2 class="text-sm sm:text-lg font-black tracking-tight truncate">Mesa de Control</h2>
        </div>
        <div class="flex items-center space-x-2 sm:space-x-4">
          <button @click="toggleTema" :class="esModoOscuro ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'" class="px-2.5 sm:px-4 py-1 sm:py-2 rounded-xl border text-[10px] sm:text-xs font-semibold cursor-pointer">
            {{ esModoOscuro ? '☀️ Claro' : '🌙 Oscuro' }}
          </button>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8 w-full max-w-7xl mx-auto">
        
        <!-- GENERAR REQUERIMIENTO (FORMULARIO ADAPTADO) -->
        <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'" class="w-full rounded-2xl border overflow-hidden text-left">
          <div class="bg-red-700 p-3 sm:p-4 text-white">
            <h3 class="text-xs font-black tracking-wider uppercase">Generar Requerimiento Dirigido</h3>
          </div>
          <form @submit.prevent="manejarEnviarTicket" class="p-4 sm:p-6 space-y-4">
            
            <div class="flex items-center border-b pb-2 relative" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'">
              <label class="w-16 text-xs font-bold uppercase" :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-500'">Para:</label>
              <div class="flex-1 relative">
                <input v-model="correoDestinatario" type="text" @focus="mostrarSugerencias = true" @blur="ocultarSugerenciasConRetraso" :class="esModoOscuro ? 'text-white placeholder-zinc-600' : 'text-slate-800 placeholder-slate-400'" class="w-full text-sm focus:outline-none bg-transparent" placeholder="operador1@relant.com, operador2@relant.com" />
                <div v-if="mostrarSugerencias && usuariosSugeridos.length > 0" :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800 text-white divide-zinc-800' : 'bg-white border-slate-200 text-slate-800 divide-slate-100'" class="absolute left-0 right-0 top-full mt-1 border rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50 divide-y">
                  <div v-for="usuario in usuariosSugeridos" :key="usuario.id" @mousedown="seleccionarUsuarioSugerido(usuario)" class="p-2.5 text-xs cursor-pointer hover:opacity-80 flex flex-col">
                    <span class="font-bold">{{ usuario.nombre }}</span>
                    <span class="text-[10px] opacity-60 font-mono">{{ usuario.email }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b pb-3" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'">
              <div class="flex items-center">
                <label class="w-16 text-xs font-bold uppercase" :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-500'">Prioridad:</label>
                <!-- 🎨 CORREGIDO: SE ADAPTA AL MODO CLARO Y OSCURO -->
                <select v-model="prioridadTicket" :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'" class="flex-1 text-xs p-2.5 rounded-xl border focus:outline-none font-bold cursor-pointer">
                  <option value="BAJA">🟢 BAJA</option>
                  <option value="MEDIA">🔵 MEDIA</option>
                  <option value="ALTA">🟡 ALTA</option>
                  <option value="CRITICA">🔴 CRÍTICA</option>
                </select>
              </div>

              <div class="flex items-center">
                <label class="w-16 text-xs font-bold uppercase" :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-500'">Proyecto:</label>
                <!-- 🎨 CORREGIDO -->
                <select v-model="proyectoTicket" :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'" class="flex-1 text-xs p-2.5 rounded-xl border focus:outline-none font-bold cursor-pointer truncate">
                  <option value="">📂 General / Sin Proyecto</option>
                  <option v-for="nombreProj in listaProyectos" :key="nombreProj" :value="nombreProj">📁 {{ nombreProj }}</option>
                </select>
              </div>

              <!-- ⏱️ NUEVO CAMPO: HORAS LÍMITE (SLA) -->
              <div class="flex items-center">
                <label class="w-20 text-xs font-bold uppercase" :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-500'">Horas SLA:</label>
                <input v-model.number="horasObjetivoTicket" type="number" min="1" max="500" :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'" class="flex-1 text-xs p-2.5 rounded-xl border focus:outline-none font-bold" placeholder="Ej. 10" />
              </div>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center border-b pb-2 gap-2" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'">
              <label class="w-16 text-xs font-bold uppercase" :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-500'">Asunto:</label>
              <div v-if="hitosDelProyectoSeleccionado.length > 0 && !usarHitoManual" class="flex-1 flex gap-2 items-center">
                <!-- 🎨 CORREGIDO -->
                <select v-model="asuntoTicket" required :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'" class="flex-1 text-xs p-2.5 rounded-xl border focus:outline-none font-bold cursor-pointer">
                  <option value="" disabled>-- Selecciona un hito del proyecto --</option>
                  <option v-for="hito in hitosDelProyectoSeleccionado" :key="hito.id" :value="hito.title">{{ hito.title }}</option>
                </select>
                <button type="button" @click="usarHitoManual = true" class="text-[11px] font-bold text-red-500 underline whitespace-nowrap">✏️ Otro</button>
              </div>
              <div v-else class="flex-1 flex gap-2 items-center">
                <input v-model="asuntoTicket" type="text" required :class="esModoOscuro ? 'text-white' : 'text-slate-800'" class="flex-1 text-sm focus:outline-none bg-transparent font-bold" placeholder="Título del hito o incidencia" />
              </div>
            </div>

            <!-- 🎨 CORREGIDO: AREA DE TEXTO SENSIONABLE AL TEMA -->
            <textarea v-model="cuerpoTicket" rows="3" required :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'" class="w-full p-3 sm:p-4 text-sm rounded-xl border focus:outline-none" placeholder="Especificaciones técnicas..."></textarea>
            
            <div class="flex justify-end">
              <button type="submit" class="w-full sm:w-auto bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-widest px-6 py-2.5 rounded-xl cursor-pointer shadow-md">
                Despachar Ticket
              </button>
            </div>
          </form>
        </div>

        <!-- 📂 FILTROS Y BUSCADOR (CORREGIDOS) -->
        <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'" class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-3 sm:p-4 rounded-2xl border">
          <div class="flex items-center space-x-1 overflow-x-auto pb-2 lg:pb-0">
            <button v-for="opcion in [
              { id: 'TODOS', texto: '📂 Todos' },
              { id: 'PENDIENTES', texto: '⏳ Desarrollo' },
              { id: 'COMPLETADO', texto: '🏁 Validación' },
              { id: 'CONCLUIDOS', texto: '🔒 Historial' }
            ]" :key="opcion.id" @click="filtroEstado = opcion.id" :class="filtroEstado === opcion.id ? 'bg-red-700 text-white font-semibold' : (esModoOscuro ? 'text-zinc-400 hover:bg-zinc-800' : 'text-slate-600 hover:bg-slate-100')" class="px-3 sm:px-4 py-2 rounded-xl text-xs cursor-pointer whitespace-nowrap">
              {{ opcion.texto }}
            </button>
          </div>

          <!-- 🎨 BUSCADOR ADAPTADO -->
          <input v-model="busquedaQuery" type="text" placeholder="Buscar folio o texto..." :class="esModoOscuro ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'" class="px-4 py-2 text-xs rounded-xl focus:outline-none w-full lg:w-64 border" />
        </div>

        <!-- LISTADO DE TICKETS (TARJETAS CORREGIDAS EN MODO CLARO) -->
        <div class="space-y-4 sm:space-y-6">
          <div v-if="loading" class="text-center py-12 text-zinc-400 animate-pulse text-sm">Sincronizando registros...</div>
          <div v-else-if="ticketsFiltradosConPrivacidad.length === 0" :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-white border-slate-200 text-slate-500'" class="text-center py-16 rounded-2xl text-sm border">No tienes requerimientos en esta sección.</div>

          <!-- 🎨 TARJETAS DE TICKETS CON ADAPTACIÓN PERFECTA DE TEMA -->
          <div v-else v-for="ticket in ticketsFiltradosConPrivacidad" :key="ticket.id" :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-800 shadow-sm'" class="rounded-2xl border p-4 sm:p-6 space-y-4">
            
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b pb-3" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'">
              <div class="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs min-w-0">
                <span :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-slate-100 border-slate-300 text-slate-700'" class="font-mono font-bold px-2 py-0.5 rounded-md border">{{ 'RLN-' + ticket.id.substring(0,6).toUpperCase() }}</span>
                
                <span :class="esModoOscuro ? 'bg-zinc-950/60 border-zinc-800 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-600'" class="font-semibold px-2 py-0.5 rounded-md border truncate max-w-full">
                  📩 De: <strong class="text-red-500">{{ ticket.creador?.nombre || ticket.creador?.email || 'Mesa' }}</strong>
                  <span class="opacity-40 mx-0.5">➡️</span>
                  👤 Para: <strong class="text-amber-500">{{ ticket.asignado?.nombre || ticket.asignado?.email || 'Sin Asignar' }}</strong>
                </span>
                
                <select :value="ticket.prioridad || 'BAJA'" @change="(e) => ejecutarCambioPrioridad(ticket.id, (e.target as HTMLSelectElement).value)" :class="obtenerColorPrioridad(ticket.prioridad)" class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase cursor-pointer border">
                  <option value="BAJA">🟢 BAJA</option>
                  <option value="MEDIA">🔵 MEDIA</option>
                  <option value="ALTA">🟡 ALTA</option>
                  <option value="CRITICA">🔴 CRÍTICA</option>
                </select>

                <span v-if="ticket.proyecto" class="bg-blue-500/10 border border-blue-500/30 text-blue-500 px-2 py-0.5 rounded-md text-[10px] font-bold">📁 {{ ticket.proyecto }}</span>
                <span v-if="ticket.devoluciones > 0" class="bg-red-500/10 border border-red-500/30 text-red-500 px-2 py-0.5 rounded-md text-[10px] font-bold">⚠️ {{ ticket.devoluciones }} Devolución(es)</span>
              </div>
            </div>

            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div class="flex-1 w-full min-w-0">
                <h4 class="text-base sm:text-lg font-black tracking-tight truncate text-left">{{ ticket.titulo }}</h4>
                <!-- 🎨 CONTENEDOR DE DESCRIPCIÓN CON MODO CLARO CORREGIDO -->
                <p :class="esModoOscuro ? 'bg-zinc-950/40 border-zinc-800/40 text-zinc-300' : 'bg-slate-50 border-slate-200 text-slate-700'" class="text-xs mt-2 whitespace-pre-line p-3 rounded-xl border leading-relaxed text-left">{{ ticket.descripcion }}</p>
              </div>

              <div class="shrink-0 flex gap-2 w-full md:w-auto">
                <button v-if="ticket.estado === 'RECIBIDO'" @click="activarProcesamientoTicket(ticket)" class="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer w-full md:w-auto">🛠️ Procesar Requerimiento</button>
                <button v-if="ticket.estado === 'TRABAJANDO'" @click="ticketIdActivo = ticket.id" class="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer w-full md:w-auto">💼 Abrir Panel / Chat</button>
                <button v-if="ticket.estado === 'COMPLETADO'" @click="ticketIdActivo = ticket.id" class="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer w-full md:w-auto">{{ esAdmin ? '🛡️ Auditar Folio' : '⏳ En Revisión' }}</button>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  </div>
</template>