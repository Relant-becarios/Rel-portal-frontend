<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { useQuery, useMutation } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'

// Helper de formato de fecha local para inicializar los campos en el día de hoy
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
const archivoAdjuntoBase64 = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// --- ⚙️ NUEVAS VARIABLES PARA CAMPOS OPERACIONALES ---
const prioridadTicket = ref('BAJA')
const proyectoTicket = ref('')

// --- VARIABLES DEL AUTOCOMPLETADO INTELIGENTE ---
const mostrarSugerencias = ref(false)

// --- 📅 CONFIGURACIÓN DE REPORTES ---
const fechaInicioReporte = ref(obtenerFechaHoyLocal())
const fechaFinReporte = ref(obtenerFechaHoyLocal())

// --- WORKSPACE EN VIVO ---
const ticketIdActivo = ref<string | null>(null)
const notaProgresoActual = ref('')

// --- ⚙️ INTERFACES ESTRICTAS DE TYPESCRIPT ---
interface Usuario {
  id: string
  nombre: string
  email: string
}

// Buscador dinámico reactivo en el pool de Apollo
const ticketActivoWorkspace = computed(() => {
  if (!ticketIdActivo.value) return null
  return result.value?.misTickets?.find((t: any) => t.id === ticketIdActivo.value) || null
})

// Conversión del string del chat en renglones reactivos (¡ESPACIO CORREGIDO AQUÍ!)
const bitacoraProgresoAcumulada = computed(() => {
  const ticket = ticketActivoWorkspace.value
  if (!ticket) return []
  return ticket.chat ? ticket.chat.split('\n') : [`[⚙️ Sistema] Esperando primer mensaje de coordinación...`]
})

// Lógica reactiva para sugerencias de usuarios
const usuariosSugeridos = computed(() => {
  const query = correoDestinatario.value.trim().toLowerCase()
  if (!query) return []

  const listaCompleta = result.value?.todosUsuarios || []
  return listaCompleta.filter((u: Usuario) => 
    u.nombre.toLowerCase().includes(query) || 
    u.email.toLowerCase().includes(query)
  )
})

const seleccionarUsuarioSugerido = (usuario: Usuario) => {
  correoDestinatario.value = usuario.email
  mostrarSugerencias.value = false
}

const ocultarSugerenciasConRetraso = () => {
  setTimeout(() => {
    mostrarSugerencias.value = false
  }, 200)
}

// Subida de archivos Base64
const manejarSubidaArchivo = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) {
    archivoAdjuntoBase64.value = null
    return
  }
  if (file.size > 3 * 1024 * 1024) {
    alert('⚠️ El archivo supera los 3MB. Por favor sube uno más ligero.')
    target.value = ''
    archivoAdjuntoBase64.value = null
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    archivoAdjuntoBase64.value = reader.result as string
  }
  reader.readAsDataURL(file)
}

const parsearFecha = (fecha: any) => {
  if (!fecha) return null
  if (!isNaN(Number(fecha))) return new Date(Number(fecha))
  return new Date(fecha)
}

// Helper para colores de las prioridades en el historial
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
  if (temaGuardado) {
    esModoOscuro.value = temaGuardado === 'oscuro'
  } else {
    esModoOscuro.value = true
  }

  const guardado = localStorage.getItem('relant_active_ticket_id')
  if (guardado) ticketIdActivo.value = guardado
})

const toggleTema = () => {
  esModoOscuro.value = !esModoOscuro.value
  localStorage.setItem('relant_theme', esModoOscuro.value ? 'oscuro' : 'claro')
}

// --- 📊 EXPORTACIÓN A EXCEL ---
const descargarReporteExcel = () => {
  if (!fechaInicioReporte.value || !fechaFinReporte.value) {
    alert('❌ Por favor, seleccione el rango completo de fechas (Inicio y Fin).')
    return
  }

  const tickets = result.value?.misTickets || []
  const miIdPrisma = result.value?.me?.id || ''
  const soyAdmin = esAdmin.value

  let baseTickets = [...tickets]
  if (!soyAdmin) {
    baseTickets = baseTickets.filter((t: any) => t.asignadoId === miIdPrisma || t.creadorId === miIdPrisma)
  }

  const inicioDate = new Date(fechaInicioReporte.value + 'T00:00:00')
  const finDate = new Date(fechaFinReporte.value + 'T23:59:59')

  const filtradosPorFecha = baseTickets.filter((t: any) => {
    const fechaTicket = parsearFecha(t.fecha_recibido)
    return fechaTicket && fechaTicket >= inicioDate && fechaTicket <= finDate
  })

  if (filtradosPorFecha.length === 0) {
    alert('⚠️ No se encontraron requerimientos registrados dentro del rango de fechas seleccionado.')
    return
  }

  let tablaHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        th { background-color: #b91c1c; color: #ffffff; font-weight: bold; text-align: center; }
        td, th { border: 1px solid #cbd5e1; padding: 6px 12px; font-family: sans-serif; font-size: 11px; }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            <th>ID Folio</th>
            <th>Título</th>
            <th>Descripción</th>
            <th>Prioridad</th>
            <th>Proyecto</th>
            <th>Estado Actual</th>
            <th>Fecha de Recibido</th>
            <th>Creador del Ticket</th>
            <th>Operador Asignado</th>
          </tr>
        </thead>
        <tbody>
  `

  filtradosPorFecha.forEach((t: any) => {
    const folio = 'RLN-' + t.id.substring(0, 6).toUpperCase()
    tablaHtml += `
      <tr>
        <td>${folio}</td>
        <td>${t.titulo || ''}</td>
        <td>${t.descripcion || ''}</td>
        <td>${t.prioridad || 'BAJA'}</td>
        <td>${t.proyecto || 'General'}</td>
        <td>${t.estado || ''}</td>
        <td>${parsearFecha(t.fecha_recibido)?.toLocaleString() || ''}</td>
        <td>${t.creador?.nombre || t.creador?.email || 'Mesa Central'}</td>
        <td>${t.asignado?.nombre || t.asignado?.email || 'Sin Asignar'}</td>
      </tr>
    `
  })

  tablaHtml += `</tbody></table></body></html>`

  const blob = new Blob([tablaHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const enlaceDescarga = document.createElement('a')
  const urlArchivo = URL.createObjectURL(blob)
  enlaceDescarga.setAttribute('href', urlArchivo)
  enlaceDescarga.setAttribute('download', `Reporte_Relant_Tickets_${fechaInicioReporte.value}_a_${fechaFinReporte.value}.xls`)
  enlaceDescarga.style.visibility = 'hidden'
  document.body.appendChild(enlaceDescarga)
  enlaceDescarga.click()
  document.body.removeChild(enlaceDescarga)
}

// --- 🔒 GRAPHQL API CENTRAL ---
const OBTENER_DATOS_DASHBOARD = gql`
  query GetDashboardData {
    me { id nombre email rol }
    todosUsuarios { id nombre email }
    misTickets {
      id titulo descripcion estado comentario_admin fecha_recibido fecha_trabajando fecha_completado fecha_evaluacion creadorId asignadoId chat archivo prioridad proyecto
      creador { email nombre }
      asignado { email nombre }
    }
  }
`
const { result, loading, error, refetch } = useQuery<{ me: any, todosUsuarios: Usuario[], misTickets: any[] }>(OBTENER_DATOS_DASHBOARD)

const CREAR_TICKET = gql`
  mutation NuevoTicket($titulo: String!, $descripcion: String!, $asignadoEmail: String, $archivo: String, $prioridad: String, $proyecto: String) {
    crearTicket(titulo: $titulo, descripcion: $descripcion, asignadoEmail: $asignadoEmail, archivo: $archivo, prioridad: $prioridad, proyecto: $proyecto) { id }
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

// --- ⏱️ FUNCIÓN DE TIEMPOS SLA ---
const convertirMinutosATexto = (totalMinutos: number): string => {
  if (totalMinutos <= 0) return "0 min"
  const MINUTOS_ANIO = 365 * 24 * 60
  const MINUTOS_MES = 30 * 24 * 60
  const MINUTOS_SEMANA = 7 * 24 * 60
  const MINUTOS_DIA = 24 * 60
  const MINUTOS_HORA = 60

  let restante = totalMinutos
  let partes: string[] = []

  const anios = Math.floor(restante / MINUTOS_ANIO)
  if (anios > 0) { partes.push(`${anios} ${anios === 1 ? 'año' : 'años'}`); restante %= MINUTOS_ANIO; }
  const meses = Math.floor(restante / MINUTOS_MES)
  if (meses > 0) { partes.push(`${meses} ${meses === 1 ? 'mes' : 'meses'}`); restante %= MINUTOS_MES; }
  const semanas = Math.floor(restante / MINUTOS_SEMANA)
  if (semanas > 0) { partes.push(`${semanas} ${semanas === 1 ? 'semana' : 'semanas'}`); restante %= MINUTOS_SEMANA; }
  const dias = Math.floor(restante / MINUTOS_DIA)
  if (dias > 0) { partes.push(`${dias} ${dias === 1 ? 'día' : 'días'}`); restante %= MINUTOS_DIA; }
  const horas = Math.floor(restante / MINUTOS_HORA)
  if (horas > 0) { partes.push(`${horas} ${horas === 1 ? 'hora' : 'horas'}`); restante %= MINUTOS_HORA; }
  const minutos = restante
  if (minutos > 0 || partes.length === 0) { partes.push(`${minutos} min`); }

  if (partes.length > 1) {
    const ultimaParte = partes.pop() || ''
    return partes.join(", ") + " y " + ultimaParte
  }
  return partes[0] || "0 min"
}

const formatearTiempoSLA = (ticket: any) => {
  if (!ticket || !ticket.fecha_recibido) return 'Sin registro'
  const inicio = parsearFecha(ticket.fecha_trabajando || ticket.fecha_recibido)
  const fin = ticket.fecha_completado ? parsearFecha(ticket.fecha_completado) : new Date()
  if (!inicio || !fin) return 'Sin registro'
  
  const minutosTotales = Math.floor((fin.getTime() - inicio.getTime()) / 1000 / 60)
  if (ticket.estado === 'RECIBIDO') return '⏳ Esperando Atención'
  
  const tiempoLegible = convertirMinutosATexto(minutosTotales)
  return ticket.fecha_completado ? `⏱️ Resuelto en: ${tiempoLegible}` : `🏃 En curso: ${tiempoLegible}`
}

const manejarEnviarTicket = async () => {
  if (!asuntoTicket.value || !cuerpoTicket.value) return
  try {
    await apiCrear({ 
      titulo: asuntoTicket.value, 
      descripcion: cuerpoTicket.value,
      asignadoEmail: correoDestinatario.value || null,
      archivo: archivoAdjuntoBase64.value,
      prioridad: prioridadTicket.value,
      proyecto: proyectoTicket.value || null
    })
    alert('📧 Requerimiento enrutado y guardado con éxito.')
    asuntoTicket.value = ''
    cuerpoTicket.value = ''
    correoDestinatario.value = ''
    proyectoTicket.value = ''
    prioridadTicket.value = 'BAJA'
    archivoAdjuntoBase64.value = null
    if (fileInputRef.value) fileInputRef.value.value = ''
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

// 🎯 FUNCIÓN PARA CERRAR EL WORKSPACE LIMPIANDO COMPLETAMENTE EL LOCALSTORAGE
const cerrarWorkspace = () => {
  ticketIdActivo.value = null
  localStorage.removeItem('relant_active_ticket_id')
}
</script>

<template>
  <div :class="esModoOscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'" class="flex min-h-screen transition-colors duration-200 relative overflow-x-hidden font-sans">
    
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
          <button @click="toggleTema" :class="esModoOscuro ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'" class="px-2.5 sm:px-4 py-1 sm:py-2 rounded-xl border text-[10px] sm:text-xs font-semibold cursor-pointer whitespace-nowrap">
            {{ esModoOscuro ? '☀️ Claro' : '🌙 Oscuro' }}
          </button>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8 w-full max-w-7xl mx-auto">
        
        <!-- 📱 WORKSPACE MODAL -->
        <div v-if="ticketActivoWorkspace" class="fixed inset-0 bg-zinc-950/80 backdrop-blur-md z-50 flex items-center justify-center p-0 sm:p-4">
          <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-800'" class="border-0 sm:border rounded-none sm:rounded-3xl w-full max-w-5xl h-full sm:h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-fadeIn">
            
            <div :class="esModoOscuro ? 'from-red-950/40 to-zinc-900 border-zinc-800' : 'from-red-50 to-slate-50 border-slate-200'" class="bg-linear-to-r p-4 sm:p-6 border-b flex justify-between items-center shrink-0">
              <div class="min-w-0 pr-2">
                <span class="text-[10px] font-bold text-red-400 uppercase tracking-widest block">Mesa de Trabajo de Alta Prioridad</span>
                <h3 :class="esModoOscuro ? 'text-white' : 'text-slate-900'" class="text-base sm:text-xl font-black mt-0.5 truncate">{{ ticketActivoWorkspace.titulo }}</h3>
              </div>
              
              <button @click="cerrarWorkspace" :class="esModoOscuro ? 'bg-zinc-800 text-zinc-400 hover:text-white' : 'bg-slate-200 text-slate-600 hover:text-slate-900'" class="font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs cursor-pointer shrink-0">
                ✕ Cerrar
              </button>
            </div>

            <div class="flex-1 p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 overflow-y-auto content-start">
              <div :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800/60' : 'bg-slate-50 border-slate-200'" class="border rounded-2xl p-4 sm:p-5 flex flex-col space-y-4">
                <h4 :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-500'" class="text-xs font-bold uppercase tracking-widest border-b pb-2" :style="{ borderColor: esModoOscuro ? '#27272a' : '#e2e8f0' }">Diagnóstico e Historial</h4>
                
                <div :class="esModoOscuro ? 'bg-zinc-900/30 border-zinc-800/50' : 'bg-slate-100 border-slate-200'" class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border">
                  <div class="min-w-0">
                    <label class="text-[9px] uppercase font-bold text-zinc-500 block">De (Creador)</label>
                    <p class="text-xs font-bold text-red-400 mt-0.5 truncate" :title="ticketActivoWorkspace.creador?.email ?? ''">
                      {{ ticketActivoWorkspace.creador?.nombre || ticketActivoWorkspace.creador?.email || 'Mesa Central' }}
                    </p>
                  </div>
                  <div class="min-w-0">
                    <label class="text-[9px] uppercase font-bold text-zinc-500 block">Para (Asignado)</label>
                    <p class="text-xs font-bold text-amber-400 mt-0.5 truncate" :title="ticketActivoWorkspace.asignado?.email ?? ''">
                      {{ ticketActivoWorkspace.asignado?.nombre || ticketActivoWorkspace.asignado?.email || 'Sin Asignar' }}
                    </p>
                  </div>
                </div>

                <div>
                  <label class="text-[10px] uppercase font-bold text-zinc-500 block">Instrucción y Descripción Inicial</label>
                  <p :class="esModoOscuro ? 'bg-zinc-900/40 border-zinc-800/40 text-zinc-300' : 'bg-white border-slate-200 text-slate-700'" class="text-sm whitespace-pre-line mt-1 p-3 sm:p-4 rounded-xl border leading-relaxed max-h-40 sm:max-h-48 overflow-y-auto font-sans">
                    {{ ticketActivoWorkspace.descripcion }}
                  </p>
                </div>

                <div v-if="ticketActivoWorkspace.archivo" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'" class="pt-4 border-t">
                  <label class="text-[10px] uppercase font-bold text-zinc-500 block mb-2">📎 Documento / Evidencia Adjunta</label>
                  <div :class="esModoOscuro ? 'border-zinc-800 bg-zinc-950/50' : 'border-slate-200 bg-slate-100'" class="rounded-xl overflow-hidden border flex justify-center p-2">
                    <img v-if="ticketActivoWorkspace.archivo.startsWith('data:image')" :src="ticketActivoWorkspace.archivo" alt="Evidencia" class="max-w-full max-h-48 object-contain rounded-lg shadow-md" />
                    <a v-else :href="ticketActivoWorkspace.archivo" download="evidencia_adjunta" class="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors w-full">
                      Descargar Archivo Adjunto
                    </a>
                  </div>
                </div>
              </div>

              <div :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800/60' : 'bg-slate-50 border-slate-200'" class="border rounded-2xl p-4 sm:p-5 flex flex-col justify-between overflow-hidden">
                <h4 :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-500'" class="text-xs font-bold uppercase tracking-widest border-b pb-2" :style="{ borderColor: esModoOscuro ? '#27272a' : '#e2e8f0' }">Línea de Tiempo / Chat</h4>
                <div class="flex-1 my-3 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
                  <div v-if="bitacoraProgresoAcumulada.length === 0" class="text-zinc-600 text-center py-12">No hay mensajes registrados.</div>
                  <div v-for="(log, i) in bitacoraProgresoAcumulada" :key="i" :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800/40 text-zinc-300' : 'bg-white border-slate-200 text-slate-700'" class="p-2 rounded-lg border wrap-break-word">
                    {{ log }}
                  </div>
                </div>

                <div v-if="ticketActivoWorkspace.estado === 'TRABAJANDO'" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'" class="space-y-3 pt-2 border-t shrink-0">
                  <div class="flex gap-2">
                    <input v-model="notaProgresoActual" @keyup.enter="registrarProgresoEnCaliente" type="text" placeholder="Escribe un avance..." :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-800'" class="rounded-xl px-3 py-2 text-xs flex-1 focus:outline-hidden" />
                    <button @click="registrarProgresoEnCaliente" class="bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs px-3 py-2 rounded-xl cursor-pointer">➕ Log</button>
                  </div>
                  <button @click="despacharAuditoriaAdmin" class="w-full bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-widest py-2.5 rounded-xl shadow-md transition cursor-pointer">🏁 Enviar a Validación</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- EXPORTAR REPORTES -->
        <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="w-full rounded-2xl border shadow-md overflow-hidden text-left">
          <div :class="esModoOscuro ? 'border-zinc-800 bg-zinc-950/40' : 'border-slate-200 bg-slate-50/50'" class="p-3 sm:p-4 border-b flex items-center justify-between">
            <h3 class="text-xs font-black tracking-wider uppercase">📊 Exportar Reporte Operacional</h3>
          </div>
          <div class="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div class="flex flex-col space-y-1">
              <label class="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Fecha de Inicio:</label>
              <input v-model="fechaInicioReporte" type="date" :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'" class="p-2.5 text-xs rounded-xl border focus:outline-hidden" />
            </div>
            <div class="flex flex-col space-y-1">
              <label class="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Fecha de Fin:</label>
              <input v-model="fechaFinReporte" type="date" :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'" class="p-2.5 text-xs rounded-xl border focus:outline-hidden" />
            </div>
            <button @click="descargarReporteExcel" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl cursor-pointer shadow-md">📥 Descargar Excel</button>
          </div>
        </div>

        <!-- GENERAR REQUERIMIENTO CON NUEVOS NIVELES Y PROYECTO -->
        <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="w-full rounded-2xl border shadow-md overflow-hidden text-left">
          <div class="bg-red-700 p-3 sm:p-4 text-white">
            <h3 class="text-xs font-black tracking-wider uppercase">Generar Requerimiento Dirigido</h3>
          </div>
          <form @submit.prevent="manejarEnviarTicket" class="p-4 sm:p-6 space-y-4">
            <div :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'" class="flex items-center border-b pb-2 relative">
              <label class="w-12 sm:w-16 text-xs font-bold text-zinc-400 uppercase">Para:</label>
              <div class="flex-1 relative">
                <input v-model="correoDestinatario" type="text" @focus="mostrarSugerencias = true" @blur="ocultarSugerenciasConRetraso" :class="esModoOscuro ? 'bg-transparent text-white placeholder-zinc-600' : 'bg-transparent text-slate-900 placeholder-slate-400'" class="w-full text-sm focus:outline-hidden" placeholder="correo@relant.com o Usuario" />
                <div v-if="mostrarSugerencias && usuariosSugeridos.length > 0" :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-800'" class="absolute left-0 right-0 top-full mt-1 border rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50 divide-y divide-zinc-800">
                  <div v-for="usuario in usuariosSugeridos" :key="usuario.id" @mousedown="seleccionarUsuarioSugerido(usuario)" class="p-2.5 text-xs cursor-pointer hover:bg-zinc-800/60 transition-colors flex flex-col">
                    <span class="font-bold">{{ usuario.nombre }}</span>
                    <span class="text-[10px] text-zinc-500 font-mono mt-0.5">{{ usuario.email }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b pb-3" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'">
              <div class="flex items-center">
                <label class="w-12 sm:w-16 text-xs font-bold text-zinc-400 uppercase">Prioridad:</label>
                <select v-model="prioridadTicket" :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-800'" class="flex-1 text-xs p-2 rounded-xl border focus:outline-hidden cursor-pointer">
                  <option value="BAJA">🟢 BAJA</option>
                  <option value="MEDIA">🔵 MEDIA</option>
                  <option value="ALTA">🟡 ALTA</option>
                  <option value="CRITICA">🔴 CRÍTICA</option>
                </select>
              </div>
              <div class="flex items-center">
                <label class="w-12 sm:w-16 text-xs font-bold text-zinc-400 uppercase">Proyecto:</label>
                <input v-model="proyectoTicket" type="text" :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-800'" class="flex-1 text-xs p-2 rounded-xl border focus:outline-hidden" placeholder="Ej. Marketplace, Kanban, ERP" />
              </div>
            </div>

            <div :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'" class="flex items-center border-b pb-2">
              <label class="w-12 sm:w-16 text-xs font-bold text-zinc-400 uppercase">Asunto:</label>
              <input v-model="asuntoTicket" type="text" required :class="esModoOscuro ? 'bg-transparent text-white font-bold' : 'bg-transparent text-slate-900 font-bold'" class="w-full text-sm focus:outline-hidden" placeholder="Folio o incidencia" />
            </div>
            
            <div :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'" class="flex items-center border-b pb-3">
              <label class="w-12 sm:w-16 text-xs font-bold text-zinc-400 uppercase">Adjunto:</label>
              <input type="file" ref="fileInputRef" @change="manejarSubidaArchivo" accept="image/*,.pdf,.doc,.docx" class="text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold cursor-pointer w-full" />
            </div>

            <textarea v-model="cuerpoTicket" rows="3" required :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200'" class="w-full p-3 sm:p-4 text-sm rounded-xl border focus:outline-hidden" placeholder="Especificaciones técnicas..."></textarea>
            <div class="flex justify-end"><button type="submit" class="w-full sm:w-auto bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-widest px-6 py-2.5 rounded-xl cursor-pointer">Despachar Ticket</button></div>
          </form>
        </div>

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
          <input v-model="busquedaQuery" type="text" placeholder="Buscar folio..." :class="esModoOscuro ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-slate-100 border-slate-200'" class="px-4 py-2 text-xs rounded-xl focus:outline-hidden w-full lg:w-64" />
        </div>

        <!-- LISTADO DE TICKETS CON ENLACES ETIQUETADOS -->
        <div class="space-y-4 sm:space-y-6">
          <div v-if="loading" class="text-center py-12 text-zinc-400 animate-pulse text-sm">Sincronizando registros con Prisma...</div>
          <div v-else-if="error" class="text-center py-12 text-red-500 text-sm font-semibold">Error de comunicación.</div>
          <div v-else-if="ticketsFiltradosConPrivacidad.length === 0" class="text-center py-16 rounded-2xl text-sm border" :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-white border-slate-200 text-slate-500'">Bandeja vacía en esta sección.</div>

          <div v-else v-for="ticket in ticketsFiltradosConPrivacidad" :key="ticket.id" :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="rounded-2xl border p-4 sm:p-6 space-y-4 transition-colors">
            
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b pb-3" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'">
              <div class="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs min-w-0">
                <span class="font-mono font-bold px-2 py-0.5 rounded-md border shrink-0" :class="esModoOscuro ? 'bg-zinc-950 text-zinc-300 border-zinc-800' : 'bg-slate-100 text-slate-800 border-slate-200'">{{ 'RLN-' + ticket.id.substring(0,6).toUpperCase() }}</span>
                <span class="font-semibold px-2 py-0.5 rounded-md border truncate max-w-full" :class="esModoOscuro ? 'bg-zinc-950/60 border-zinc-800 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-600'">
                  📩 De: <strong class="text-red-500" :title="ticket.creador?.email ?? ''">{{ ticket.creador?.nombre || 'Mesa' }}</strong>
                  <span class="text-zinc-600 font-black mx-0.5">➡️</span>
                  👤 Para: <strong class="text-amber-500" :title="ticket.asignado?.email ?? ''">{{ ticket.asignado?.nombre || 'Nadie' }}</strong>
                </span>
                
                <span v-if="ticket.prioridad" :class="obtenerColorPrioridad(ticket.prioridad)" class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">{{ ticket.prioridad }}</span>
                <span v-if="ticket.proyecto" class="bg-blue-950/50 border border-blue-900/40 text-blue-400 px-2 py-0.5 rounded-md text-[10px] font-bold">📁 {{ ticket.proyecto }}</span>
              </div>
              <span class="text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-lg border shrink-0" :class="esModoOscuro ? 'border-zinc-800 bg-zinc-950 text-zinc-300' : 'border-slate-200 bg-slate-50 text-slate-700'">{{ formatearTiempoSLA(ticket) }}</span>
            </div>

            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div class="flex-1 w-full min-w-0">
                <h4 class="text-base sm:text-lg font-black tracking-tight truncate text-left" :class="esModoOscuro ? 'text-white' : 'text-slate-900'">{{ ticket.titulo }}</h4>
                <p class="text-xs mt-2 whitespace-pre-line p-3 rounded-xl border leading-relaxed text-left" :class="esModoOscuro ? 'bg-zinc-950/40 border-zinc-800/40 text-zinc-300' : 'bg-slate-50 border-slate-200 text-slate-700'">{{ ticket.descripcion }}</p>
              </div>

              <div class="shrink-0 flex gap-2 w-full md:w-auto">
                <button v-if="ticket.estado === 'RECIBIDO'" @click="activarProcesamientoTicket(ticket)" class="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer w-full md:w-auto">🛠️ Procesar Requerimiento</button>
                <button v-if="ticket.estado === 'TRABAJANDO'" @click="ticketIdActivo = ticket.id" class="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer w-full md:w-auto">💼 Abrir Panel / Chat</button>
                <button v-if="ticket.estado === 'COMPLETADO'" @click="ticketIdActivo = ticket.id" class="bg-linear-to-r from-red-950 to-zinc-900 border border-red-900/40 text-red-400 text-xs font-black px-4 py-2.5 rounded-xl transition cursor-pointer w-full md:w-auto">{{ esAdmin ? '🛡️ Auditar Folio' : '⏳ En Revisión' }}</button>
                <button v-if="ticket.estado === 'APROBADO'" @click="ticketIdActivo = ticket.id" class="text-xs font-bold tracking-wider uppercase px-4 py-2.5 rounded-xl border border-dashed border-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer w-full md:w-auto">🔒 Liberado (Ver Chat)</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
.animate-fadeIn { animation: fadeIn 0.15s ease-out forwards; }
.scrollbar-none::-webkit-scrollbar { display: none; }
.scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
</style>