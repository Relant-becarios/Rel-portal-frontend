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

// --- ESTADOS DE CONTROL DE FLUJO ---
const filtroEstado = ref('TODOS')
const esModoOscuro = ref(true)
const comentarioAdmin = ref('')
const busquedaQuery = ref('')
const menuMovilAbierto = ref(false)

// --- VARIABLES DE NUEVO TICKET ---
const correoDestinatario = ref('')
const asuntoTicket = ref('')
const cuerpoTicket = ref('')
const listaArchivosBase64 = ref<{ nombre: string; data: string }[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
const prioridadTicket = ref('BAJA')
const proyectoTicket = ref('')
const usarHitoManual = ref(false)

// --- 📂 ESTRUCTURA DE PROYECTOS E HITOS DESDE FIREBASE ---
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
    console.error('Error al consultar proyectos en Firebase:', err)
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

// 📦 PROCESAR MÚLTIPLES ARCHIVOS HASTA 200MB CADA UNO
const manejarSubidaArchivosMultiples = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  listaArchivosBase64.value = []

  Array.from(files).forEach((file) => {
    // ⚡ LÍMITE DE 200MB POR ARCHIVO
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
    case 'CRITICA': return 'bg-red-950/60 border border-red-900 text-red-400'
    case 'ALTA': return 'bg-amber-950/60 border border-amber-900 text-amber-400'
    case 'MEDIA': return 'bg-blue-950/60 border border-blue-900 text-blue-400'
    default: return 'bg-zinc-800 border border-zinc-700 text-zinc-400'
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

const formatearFechaVisual = (fechaStr: string) => {
  if (!fechaStr) return ''
  const partes = fechaStr.split('-')
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`
  return fechaStr
}

// 🔒 GRAPHQL API CENTRAL
const OBTENER_DATOS_DASHBOARD = gql`
  query GetDashboardData {
    me { id nombre email rol }
    todosUsuarios { id nombre email }
    misTickets {
      id titulo descripcion estado comentario_admin fecha_recibido fecha_trabajando fecha_completado fecha_evaluacion creadorId asignadoId chat archivo archivos prioridad proyecto
      creador { email nombre }
      asignado { email nombre }
    }
  }
`
const { result, loading, error, refetch } = useQuery<{ me: any, todosUsuarios: Usuario[], misTickets: any[] }>(OBTENER_DATOS_DASHBOARD)

const CREAR_TICKET = gql`
  mutation NuevoTicket($titulo: String!, $descripcion: String!, $asignadosEmails: [String], $archivos: [String], $prioridad: String, $proyecto: String) {
    crearTicket(titulo: $titulo, descripcion: $descripcion, asignadosEmails: $asignadosEmails, archivos: $archivos, prioridad: $prioridad, proyecto: $proyecto) { id }
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

const obtenerTicketsFiltradosReporte = () => {
  const tickets = result.value?.misTickets || []
  const miIdPrisma = result.value?.me?.id || ''
  const soyAdmin = esAdmin.value

  let baseTickets = [...tickets]
  if (!soyAdmin) {
    baseTickets = baseTickets.filter((t: any) => t.asignadoId === miIdPrisma || t.creadorId === miIdPrisma)
  }

  const inicioDate = new Date(fechaInicioReporte.value + 'T00:00:00')
  const finDate = new Date(fechaFinReporte.value + 'T23:59:59')

  return baseTickets.filter((t: any) => {
    const fechaTicket = parsearFecha(t.fecha_recibido)
    return fechaTicket && fechaTicket >= inicioDate && fechaTicket <= finDate
  })
}

// 📊 EXPORTAR EXCEL
const descargarReporteExcel = () => {
  if (!fechaInicioReporte.value || !fechaFinReporte.value) {
    alert('❌ Por favor, seleccione el rango completo de fechas.')
    return
  }

  const filtradosPorFecha = obtenerTicketsFiltradosReporte()
  if (filtradosPorFecha.length === 0) {
    alert('⚠️ No se encontraron requerimientos registrados dentro del rango de fechas.')
    return
  }

  let tablaHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8" /></head>
    <body>
      <table>
        <thead>
          <tr>
            <th>ID Folio</th><th>Título</th><th>Descripción</th><th>Prioridad</th><th>Proyecto</th><th>Estado</th><th>Fecha Recibido</th><th>Creador</th><th>Operador Asignado</th>
          </tr>
        </thead>
        <tbody>
  `

  filtradosPorFecha.forEach((t: any) => {
    const folio = 'RLN-' + t.id.substring(0, 6).toUpperCase()
    tablaHtml += `
      <tr>
        <td>${folio}</td><td>${t.titulo || ''}</td><td>${t.descripcion || ''}</td><td>${t.prioridad || 'BAJA'}</td><td>${t.proyecto || 'General'}</td><td>${t.estado || ''}</td><td>${parsearFecha(t.fecha_recibido)?.toLocaleString() || ''}</td><td>${t.creador?.nombre || t.creador?.email || 'Mesa Central'}</td><td>${t.asignado?.nombre || t.asignado?.email || 'Sin Asignar'}</td>
      </tr>
    `
  })

  tablaHtml += `</tbody></table></body></html>`
  const blob = new Blob([tablaHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(blob)
  enlace.download = `Reporte_Relant_Tickets_${fechaInicioReporte.value}_a_${fechaFinReporte.value}.xls`
  enlace.click()
}

// 📄 EXPORTAR PDF
const descargarReportePdf = () => {
  if (!fechaInicioReporte.value || !fechaFinReporte.value) {
    alert('❌ Por favor, seleccione el rango completo de fechas.')
    return
  }

  const filtradosPorFecha = obtenerTicketsFiltradosReporte()
  if (filtradosPorFecha.length === 0) {
    alert('⚠️ No se encontraron requerimientos registrados dentro del rango de fechas.')
    return
  }

  const periodoVisual = `${formatearFechaVisual(fechaInicioReporte.value)} – ${formatearFechaVisual(fechaFinReporte.value)}`
  let itemsHtml = ''
  
  filtradosPorFecha.forEach((t: any, index: number) => {
    const folio = 'RLN-' + t.id.substring(0, 6).toUpperCase()
    itemsHtml += `
      <div style="margin-bottom: 15px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
        <strong>#${index + 1} ${folio} - ${t.titulo}</strong> (${t.estado})<br>
        <small>De: ${t.creador?.nombre || 'Mesa'} | Para: ${t.asignado?.nombre || 'Sin asignar'} | Fecha: ${parsearFecha(t.fecha_recibido)?.toLocaleString()}</small>
        <p style="margin: 5px 0;">${t.descripcion}</p>
      </div>
    `
  })

  const doc = window.open('', '', 'width=800,height=600')
  if (doc) {
    doc.document.write(`<html><head><title>Reporte de Tickets</title></head><body style="font-family:sans-serif; padding:20px;"><h2>Reporte de Tickets RELANT</h2><p>Periodo: ${periodoVisual}</p><hr>${itemsHtml}</body></html>`)
    doc.document.close()
    doc.print()
  }
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
      proyecto: proyectoTicket.value || null
    })
    alert('📧 Requerimiento despachado con éxito.')
    asuntoTicket.value = ''
    cuerpoTicket.value = ''
    correoDestinatario.value = ''
    proyectoTicket.value = ''
    prioridadTicket.value = 'BAJA'
    usarHitoManual.value = false
    listaArchivosBase64.value = []
    if (fileInputRef.value) fileInputRef.value.value = ''
    refetch()
    cargarProyectosFirebase()
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
    filtrados = filtrados.filter((t: any) => t.titulo?.toLowerCase().includes(query) || t.descripcion?.toLowerCase().includes(query) || t.id?.toLowerCase().includes(query))
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
    await Promise.all([refetch(), cargarProyectosFirebase()])
    alert(aprobado ? '✓ Ticket liberado y archivado.' : '✕ Ticket rechazado.')
  } catch (e: any) {
    alert('Error al evaluar: ' + e.message)
    ticketIdActivo.value = currentTicketId
    comentarioAdmin.value = comentario
  }
}

const cerrarWorkspace = () => {
  ticketIdActivo.value = null
  localStorage.removeItem('relant_active_ticket_id')
}
</script>

<template>
  <div :class="esModoOscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'" class="flex min-h-screen transition-colors duration-200 relative overflow-x-hidden font-sans">
    
    <div :class="[menuMovilAbierto ? 'translate-x-0' : '-translate-x-full', 'lg:translate-x-0 fixed lg:sticky top-0 left-0 h-screen z-50 transition-transform duration-300 ease-in-out shrink-0']">
      <Sidebar :dark="esModoOscuro" />
    </div>

    <div v-if="menuMovilAbierto" @click="menuMovilAbierto = false" class="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-40"></div>
    
    <div class="flex-1 flex flex-col min-w-0 w-full">
      <header :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="h-16 border-b px-4 sm:px-8 flex justify-between items-center shrink-0">
        <div class="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <button @click="menuMovilAbierto = !menuMovilAbierto" class="lg:hidden p-1.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer mr-1">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          <span class="text-[10px] sm:text-xs font-black bg-red-700 text-white px-2 py-0.5 rounded-md tracking-wider whitespace-nowrap">RELANT HQ</span>
          <h2 class="text-sm sm:text-lg font-black tracking-tight truncate">Mesa de Control</h2>
        </div>
        <div class="flex items-center space-x-2 sm:space-x-4">
          <button @click="toggleTema" :class="esModoOscuro ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'" class="px-2.5 sm:px-4 py-1 sm:py-2 rounded-xl border text-[10px] sm:text-xs font-semibold cursor-pointer">
            {{ esModoOscuro ? '☀️ Claro' : '🌙 Oscuro' }}
          </button>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8 w-full max-w-7xl mx-auto">
        
        <!-- WORKSPACE MODAL -->
        <div v-if="ticketActivoWorkspace" class="fixed inset-0 bg-zinc-950/80 backdrop-blur-md z-50 flex items-center justify-center p-0 sm:p-4">
          <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-800'" class="border-0 sm:border rounded-none sm:rounded-3xl w-full max-w-5xl h-full sm:h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            
            <div :class="esModoOscuro ? 'from-red-950/40 to-zinc-900 border-zinc-800' : 'from-red-50 to-slate-50 border-slate-200'" class="bg-linear-to-r p-4 sm:p-6 border-b flex justify-between items-center shrink-0">
              <div class="min-w-0 pr-2">
                <span class="text-[10px] font-bold text-red-400 uppercase tracking-widest block">Mesa de Trabajo de Alta Prioridad</span>
                <h3 class="text-base sm:text-xl font-black mt-0.5 truncate">{{ ticketActivoWorkspace.titulo }}</h3>
              </div>
              
              <button @click="cerrarWorkspace" class="font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs cursor-pointer bg-zinc-800 text-zinc-400 hover:text-white">
                ✕ Cerrar
              </button>
            </div>

            <div class="flex-1 p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 overflow-y-auto content-start">
              <div :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800/60' : 'bg-slate-50 border-slate-200'" class="border rounded-2xl p-4 sm:p-5 flex flex-col space-y-4">
                <h4 class="text-xs font-bold uppercase tracking-widest border-b pb-2 text-zinc-400 border-zinc-800">Diagnóstico e Historial</h4>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border bg-zinc-900/30 border-zinc-800/50">
                  <div class="min-w-0">
                    <label class="text-[9px] uppercase font-bold text-zinc-500 block">De (Creador)</label>
                    <p class="text-xs font-bold text-red-400 mt-0.5 truncate">{{ ticketActivoWorkspace.creador?.nombre || ticketActivoWorkspace.creador?.email || 'Mesa Central' }}</p>
                  </div>
                  <div class="min-w-0">
                    <label class="text-[9px] uppercase font-bold text-zinc-500 block">Para (Asignado)</label>
                    <p class="text-xs font-bold text-amber-400 mt-0.5 truncate">{{ ticketActivoWorkspace.asignado?.nombre || ticketActivoWorkspace.asignado?.email || 'Sin Asignar' }}</p>
                  </div>
                </div>

                <div>
                  <label class="text-[10px] uppercase font-bold text-zinc-500 block">Instrucción y Descripción Inicial</label>
                  <p class="text-sm whitespace-pre-line mt-1 p-3 sm:p-4 rounded-xl border bg-zinc-900/40 border-zinc-800/40 text-zinc-300 leading-relaxed max-h-40 overflow-y-auto">{{ ticketActivoWorkspace.descripcion }}</p>
                </div>

                <!-- 📎 VISUALIZADOR DE MÚLTIPLES ARCHIVOS HASTA 200MB -->
                <div v-if="ticketActivoWorkspace.archivos && ticketActivoWorkspace.archivos.length > 0" class="pt-4 border-t border-zinc-800">
                  <label class="text-[10px] uppercase font-bold text-zinc-500 block mb-2">📎 Documentos / Archivos Adjuntos ({{ ticketActivoWorkspace.archivos.length }})</label>
                  <div class="grid grid-cols-1 gap-2">
                    <div v-for="(archivoItem, index) in ticketActivoWorkspace.archivos" :key="index" class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                      
                      <template v-if="archivoItem.includes('{')">
                        <div class="flex justify-between items-center text-xs">
                          <span class="font-mono text-zinc-300 font-bold truncate pr-2">📦 {{ JSON.parse(archivoItem).nombre }}</span>
                          <a :href="JSON.parse(archivoItem).data" :download="JSON.parse(archivoItem).nombre" class="bg-red-700 hover:bg-red-800 text-white font-bold px-3 py-1 rounded-lg text-[10px] uppercase tracking-wider shrink-0 transition">
                            Descargar 💾
                          </a>
                        </div>
                      </template>

                      <template v-else-if="archivoItem.startsWith('data:image')">
                        <img :src="archivoItem" alt="Evidencia" class="max-w-full max-h-48 object-contain rounded-lg shadow-md mx-auto" />
                      </template>

                      <template v-else>
                        <a :href="archivoItem" download="adjunto_ticket" class="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition w-full">
                          📄 Descargar Archivo {{ String(index) + 1 }}
                        </a>
                      </template>

                    </div>
                  </div>
                </div>

              </div>

              <div :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800/60' : 'bg-slate-50 border-slate-200'" class="border rounded-2xl p-4 sm:p-5 flex flex-col justify-between overflow-hidden">
                <h4 class="text-xs font-bold uppercase tracking-widest border-b pb-2 text-zinc-400 border-zinc-800">Línea de Tiempo / Chat</h4>
                <div class="flex-1 my-3 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
                  <div v-for="(log, i) in bitacoraProgresoAcumulada" :key="i" class="p-2 rounded-lg border bg-zinc-900 border-zinc-800/40 text-zinc-300 wrap-break-word">
                    {{ log }}
                  </div>
                </div>

                <div v-if="ticketActivoWorkspace.estado === 'TRABAJANDO'" class="space-y-3 pt-2 border-t border-zinc-800 shrink-0">
                  <div class="flex gap-2">
                    <input v-model="notaProgresoActual" @keyup.enter="registrarProgresoEnCaliente" type="text" placeholder="Escribe un avance..." class="rounded-xl px-3 py-2 text-xs flex-1 bg-zinc-900 border-zinc-800 text-white focus:outline-none" />
                    <button @click="registrarProgresoEnCaliente" class="bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs px-3 py-2 rounded-xl cursor-pointer">➕ Log</button>
                  </div>
                  <button @click="despacharAuditoriaAdmin" class="w-full bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-widest py-2.5 rounded-xl shadow-md cursor-pointer">🏁 Enviar a Validación</button>
                </div>

                <div v-if="ticketActivoWorkspace.estado === 'COMPLETADO' && esAdmin" class="space-y-3 pt-2 border-t border-zinc-800 shrink-0 text-left">
                  <div>
                    <label class="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Acta o Justificación del Dictamen (Obligatorio)</label>
                    <input v-model="comentarioAdmin" type="text" placeholder="Escribe el porqué de la liberación o rechazo..." class="rounded-xl px-3 py-2 text-xs w-full bg-zinc-900 border-zinc-800 text-white focus:outline-none" />
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <button @click="ejecutarDictamenAdmin(true)" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer">✓ Aprobar y Liberar</button>
                    <button @click="ejecutarDictamenAdmin(false)" class="bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer">✕ Rechazar Requerimiento</button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        <!-- 📊 RESTAURADO: MÓDULO EXPORTAR REPORTES -->
        <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="w-full rounded-2xl border shadow-md overflow-hidden text-left">
          <div :class="esModoOscuro ? 'border-zinc-800 bg-zinc-950/40' : 'border-slate-200 bg-slate-50/50'" class="p-3 sm:p-4 border-b flex items-center justify-between">
            <h3 class="text-xs font-black tracking-wider uppercase">📊 Exportar Reporte Operacional</h3>
          </div>
          <div class="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div class="flex flex-col space-y-1">
              <label class="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Fecha de Inicio:</label>
              <input v-model="fechaInicioReporte" type="date" :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'" class="p-2.5 text-xs rounded-xl border focus:outline-none" />
            </div>
            <div class="flex flex-col space-y-1">
              <label class="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Fecha de Fin:</label>
              <input v-model="fechaFinReporte" type="date" :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'" class="p-2.5 text-xs rounded-xl border focus:outline-none" />
            </div>
            <button @click="descargarReporteExcel" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl cursor-pointer shadow-md transition-all">
              📥 Descargar Excel
            </button>
            <button @click="descargarReportePdf" class="w-full bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl cursor-pointer shadow-md transition-all">
              📄 Descargar PDF
            </button>
          </div>
        </div>

        <!-- GENERAR REQUERIMIENTO CON SOPORTE HASTA 200MB -->
        <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="w-full rounded-2xl border shadow-md overflow-hidden text-left">
          <div class="bg-red-700 p-3 sm:p-4 text-white">
            <h3 class="text-xs font-black tracking-wider uppercase">Generar Requerimiento Dirigido</h3>
          </div>
          <form @submit.prevent="manejarEnviarTicket" class="p-4 sm:p-6 space-y-4">
            
            <div class="flex items-center border-b pb-2 relative border-zinc-800">
              <label class="w-12 sm:w-16 text-xs font-bold text-zinc-400 uppercase">Para:</label>
              <div class="flex-1 relative">
                <input v-model="correoDestinatario" type="text" @focus="mostrarSugerencias = true" @blur="ocultarSugerenciasConRetraso" class="w-full text-sm focus:outline-none bg-transparent text-white placeholder-zinc-600" placeholder="operador1@relant.com, operador2@relant.com (Separa por comas)" />
                <div v-if="mostrarSugerencias && usuariosSugeridos.length > 0" class="absolute left-0 right-0 top-full mt-1 border rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50 bg-zinc-900 border-zinc-800 text-white divide-y divide-zinc-800">
                  <div v-for="usuario in usuariosSugeridos" :key="usuario.id" @mousedown="seleccionarUsuarioSugerido(usuario)" class="p-2.5 text-xs cursor-pointer hover:bg-zinc-800/60 transition flex flex-col">
                    <span class="font-bold">{{ usuario.nombre }}</span>
                    <span class="text-[10px] text-zinc-500 font-mono mt-0.5">{{ usuario.email }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b pb-3 border-zinc-800">
              <div class="flex items-center">
                <label class="w-12 sm:w-16 text-xs font-bold text-zinc-400 uppercase">Prioridad:</label>
                <select v-model="prioridadTicket" class="flex-1 text-xs p-2.5 rounded-xl border focus:outline-none cursor-pointer font-bold bg-zinc-950 border-zinc-800 text-white">
                  <option value="BAJA">🟢 BAJA</option>
                  <option value="MEDIA">🔵 MEDIA</option>
                  <option value="ALTA">🟡 ALTA</option>
                  <option value="CRITICA">🔴 CRÍTICA</option>
                </select>
              </div>

              <div class="flex items-center">
                <label class="w-12 sm:w-16 text-xs font-bold text-zinc-400 uppercase">Proyecto:</label>
                <select v-model="proyectoTicket" class="flex-1 text-xs p-2.5 rounded-xl border focus:outline-none cursor-pointer font-bold truncate bg-zinc-950 border-zinc-800 text-white">
                  <option value="">📂 General / Sin Proyecto</option>
                  <option v-if="cargandoProyectos" disabled>⏳ Cargando proyectos...</option>
                  <option v-else v-for="nombreProj in listaProyectos" :key="nombreProj" :value="nombreProj">
                    📁 {{ nombreProj }}
                  </option>
                </select>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center border-b pb-2 gap-2 border-zinc-800">
              <label class="w-12 sm:w-16 text-xs font-bold text-zinc-400 uppercase">Asunto:</label>
              
              <div v-if="hitosDelProyectoSeleccionado.length > 0 && !usarHitoManual" class="flex-1 flex gap-2 items-center">
                <select v-model="asuntoTicket" required class="flex-1 text-xs p-2.5 rounded-xl border focus:outline-none font-bold cursor-pointer bg-zinc-950 border-zinc-800 text-white">
                  <option value="" disabled>-- Selecciona un hito del proyecto --</option>
                  <option v-for="hito in hitosDelProyectoSeleccionado" :key="hito.id" :value="hito.title">
                    {{ hito.completed ? '✅' : '⏳' }} {{ hito.title }}
                  </option>
                </select>
                <button type="button" @click="usarHitoManual = true; asuntoTicket = ''" class="text-[11px] font-bold text-red-400 underline whitespace-nowrap px-2">✏️ Escribir otro</button>
              </div>

              <div v-else class="flex-1 flex gap-2 items-center">
                <input v-model="asuntoTicket" type="text" required class="flex-1 text-sm focus:outline-none bg-transparent text-white font-bold" placeholder="Título del hito o incidencia" />
                <button v-if="hitosDelProyectoSeleccionado.length > 0" type="button" @click="usarHitoManual = false; asuntoTicket = ''" class="text-[11px] font-bold text-blue-400 underline whitespace-nowrap px-2">📋 Ver lista</button>
              </div>
            </div>
            
            <div class="flex flex-col border-b pb-3 border-zinc-800">
              <div class="flex items-center">
                <label class="w-12 sm:w-16 text-xs font-bold text-zinc-400 uppercase">Adjuntos:</label>
                <input type="file" ref="fileInputRef" multiple accept="*" @change="manejarSubidaArchivosMultiples" class="text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold cursor-pointer w-full" />
              </div>
              <div v-if="listaArchivosBase64.length > 0" class="flex flex-wrap gap-2 mt-2 pl-12 sm:pl-16">
                <span v-for="(f, i) in listaArchivosBase64" :key="i" class="bg-zinc-800 text-zinc-300 text-[10px] font-mono px-2.5 py-1 rounded-lg border border-zinc-700 flex items-center gap-1">
                  📦 {{ f.nombre }}
                </span>
              </div>
            </div>

            <textarea v-model="cuerpoTicket" rows="3" required class="w-full p-3 sm:p-4 text-sm rounded-xl border focus:outline-none bg-zinc-950 border-zinc-800 text-white" placeholder="Especificaciones técnicas..."></textarea>
            
            <div class="flex justify-end">
              <button type="submit" class="w-full sm:w-auto bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-widest px-6 py-2.5 rounded-xl cursor-pointer shadow-md">
                Despachar Ticket
              </button>
            </div>
          </form>
        </div>

        <!-- 📂 RESTAURADO: BARRA DE PESTAÑAS (FILTROS) Y BUSCADOR -->
        <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-3 sm:p-4 rounded-2xl border transition-colors">
          <div class="flex items-center space-x-1 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            <button v-for="opcion in [
              { id: 'TODOS', texto: '📂 Todos' },
              { id: 'PENDIENTES', texto: '⏳ Desarrollo' },
              { id: 'COMPLETADO', texto: '🏁 Validación' },
              { id: 'CONCLUIDOS', texto: '🔒 Historial' }
            ]" :key="opcion.id" @click="filtroEstado = opcion.id" :class="filtroEstado === opcion.id ? 'bg-red-700 text-white font-semibold shadow-md' : 'text-zinc-400 hover:bg-zinc-800'" class="px-3 sm:px-4 py-2 rounded-xl text-xs cursor-pointer whitespace-nowrap">
              {{ opcion.texto }}
            </button>
          </div>
          <input v-model="busquedaQuery" type="text" placeholder="Buscar folio o texto..." :class="esModoOscuro ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-slate-100 border-slate-200'" class="px-4 py-2 text-xs rounded-xl focus:outline-none w-full lg:w-64" />
        </div>

        <!-- LISTADO DE TICKETS -->
        <div class="space-y-4 sm:space-y-6">
          <div v-if="loading" class="text-center py-12 text-zinc-400 animate-pulse text-sm">Sincronizando registros con Prisma...</div>
          <div v-else-if="error" class="text-center py-12 text-red-500 text-sm font-semibold">Error de comunicación.</div>
          <div v-else-if="ticketsFiltradosConPrivacidad.length === 0" class="text-center py-16 rounded-2xl text-sm border" :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-white border-slate-200 text-slate-500'">Bandeja vacía en esta sección.</div>

          <div v-else v-for="ticket in ticketsFiltradosConPrivacidad" :key="ticket.id" class="rounded-2xl border p-4 sm:p-6 space-y-4 transition bg-zinc-900 border-zinc-800">
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b pb-3 border-zinc-800">
              <div class="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs min-w-0">
                <span class="font-mono font-bold px-2 py-0.5 rounded-md border bg-zinc-950 text-zinc-300 border-zinc-800">{{ 'RLN-' + ticket.id.substring(0,6).toUpperCase() }}</span>
                
                <span class="font-semibold px-2 py-0.5 rounded-md border truncate max-w-full bg-zinc-950/60 border-zinc-800 text-zinc-400">
                  📩 De: <strong class="text-red-500">{{ ticket.creador?.nombre || ticket.creador?.email || 'Mesa' }}</strong>
                  <span class="text-zinc-600 font-black mx-0.5">➡️</span>
                  👤 Para: <strong class="text-amber-500">{{ ticket.asignado?.nombre || ticket.asignado?.email || 'Sin Asignar' }}</strong>
                </span>
                
                <select :value="ticket.prioridad || 'BAJA'" @change="(e) => ejecutarCambioPrioridad(ticket.id, (e.target as HTMLSelectElement).value)" :class="obtenerColorPrioridad(ticket.prioridad)" class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase cursor-pointer border">
                  <option value="BAJA">🟢 BAJA</option>
                  <option value="MEDIA">🔵 MEDIA</option>
                  <option value="ALTA">🟡 ALTA</option>
                  <option value="CRITICA">🔴 CRÍTICA</option>
                </select>

                <span v-if="ticket.proyecto" class="bg-blue-950/50 border border-blue-900/40 text-blue-400 px-2 py-0.5 rounded-md text-[10px] font-bold">📁 {{ ticket.proyecto }}</span>
              </div>
            </div>

            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div class="flex-1 w-full min-w-0">
                <h4 class="text-base sm:text-lg font-black tracking-tight truncate text-left text-white">{{ ticket.titulo }}</h4>
                <p class="text-xs mt-2 whitespace-pre-line p-3 rounded-xl border leading-relaxed text-left bg-zinc-950/40 border-zinc-800/40 text-zinc-300">{{ ticket.descripcion }}</p>
              </div>

              <div class="shrink-0 flex gap-2 w-full md:w-auto">
                <button v-if="ticket.estado === 'RECIBIDO'" @click="activarProcesamientoTicket(ticket)" class="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer w-full md:w-auto">🛠️ Procesar Requerimiento</button>
                <button v-if="ticket.estado === 'TRABAJANDO'" @click="ticketIdActivo = ticket.id" class="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer w-full md:w-auto">💼 Abrir Panel / Chat</button>
                <button v-if="ticket.estado === 'COMPLETADO'" @click="ticketIdActivo = ticket.id" class="bg-linear-to-r from-red-950 to-zinc-900 border border-red-900/40 text-red-400 text-xs font-black px-4 py-2.5 rounded-xl cursor-pointer w-full md:w-auto">{{ esAdmin ? '🛡️ Auditar Folio' : '⏳ En Revisión' }}</button>
                <button v-if="ticket.estado === 'APROBADO'" @click="ticketIdActivo = ticket.id" class="text-xs font-bold tracking-wider uppercase px-4 py-2.5 rounded-xl border border-dashed border-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer w-full md:w-auto">🔒 Liberado (Ver Chat)</button>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  </div>
</template>