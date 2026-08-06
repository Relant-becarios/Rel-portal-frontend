<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { useQuery, useMutation } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'
import { useRouter } from 'vue-router'

const router = useRouter()

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

// Campos del formulario
const correoDestinatario = ref('')
const asuntoTicket = ref('')
const cuerpoTicket = ref('')
const horasObjetivoTicket = ref(10)
const listaArchivosBase64 = ref<{ nombre: string; data: string }[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
const prioridadTicket = ref('BAJA')
const proyectoTicket = ref('')
const usarHitoManual = ref(false)

// Modal de Eliminación
const ticketAEliminar = ref<any | null>(null)
const mostrarModalEliminar = ref(false)

// Reportes
const fechaInicioReporte = ref(obtenerFechaHoyLocal())
const fechaFinReporte = ref(obtenerFechaHoyLocal())

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
  const partes = correoDestinatario.value.split(',')
  const ultimoTexto = partes[partes.length - 1]?.trim().toLowerCase() || ''

  if (!ultimoTexto) return []

  const listaCompleta = result.value?.todosUsuarios || []
  return listaCompleta.filter((u: Usuario) => 
    u.nombre.toLowerCase().includes(ultimoTexto) || 
    u.email.toLowerCase().includes(ultimoTexto)
  )
})

const seleccionarUsuarioSugerido = (usuario: Usuario) => {
  const partes = correoDestinatario.value.split(',')
  partes.pop()
  partes.push(' ' + usuario.email)
  
  correoDestinatario.value = partes.join(',').trimStart() + ', '
  mostrarSugerencias.value = false
}

const ocultarSugerenciasConRetraso = () => {
  setTimeout(() => { mostrarSugerencias.value = false }, 200)
}

const toggleTema = () => {
  esModoOscuro.value = !esModoOscuro.value
  localStorage.setItem('relant_theme', esModoOscuro.value ? 'oscuro' : 'claro')
}

const parsearFecha = (fecha: any) => {
  if (!fecha) return null
  if (!isNaN(Number(fecha))) return new Date(Number(fecha))
  return new Date(fecha)
}

const formatearFechaVisual = (fechaStr: string) => {
  if (!fechaStr) return ''
  const partes = fechaStr.split('-')
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`
  return fechaStr
}

const obtenerColorPrioridad = (prioridad: string) => {
  switch (prioridad?.toUpperCase()) {
    case 'CRITICA': return 'bg-red-500/20 text-red-500 border-red-500/40'
    case 'ALTA': return 'bg-amber-500/20 text-amber-500 border-amber-500/40'
    case 'MEDIA': return 'bg-blue-500/20 text-blue-500 border-blue-500/40'
    default: return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/40'
  }
}

const obtenerResumenTiempoSla = (ticket: any) => {
  if (!ticket || !ticket.fecha_recibido) return { textoTiempo: 'Sin registro', tiempoEsperaTexto: '0m', aTiempo: true, badgeColor: 'bg-zinc-800 text-zinc-400' }

  const fechaRecibido = parsearFecha(ticket.fecha_recibido)?.getTime() || Date.now()
  const fechaTrabajando = ticket.fecha_trabajando ? parsearFecha(ticket.fecha_trabajando)?.getTime() : null
  const fechaFin = ticket.fecha_completado || ticket.fecha_evaluacion
    ? (parsearFecha(ticket.fecha_completado || ticket.fecha_evaluacion)?.getTime() || Date.now())
    : Date.now()

  const msEspera = (fechaTrabajando ? fechaTrabajando : (ticket.estado === 'RECIBIDO' ? Date.now() : fechaFin)) - fechaRecibido
  const minsEsperaTotal = Math.floor(Math.max(0, msEspera) / (1000 * 60))
  const horasEspera = Math.floor(minsEsperaTotal / 60)
  const minsEsperaResto = minsEsperaTotal % 60
  const tiempoEsperaTexto = horasEspera > 0 ? `${horasEspera}h ${minsEsperaResto}m` : `${minsEsperaResto}m`

  if (!fechaTrabajando && ticket.estado === 'RECIBIDO') {
    return {
      horasUsadas: '0.0',
      horasLimite: ticket.horasEstimadas || 10,
      textoTiempo: 'Sin iniciar',
      tiempoEsperaTexto,
      aTiempo: true,
      badgeColor: esModoOscuro.value ? 'bg-amber-950/60 border-amber-800/80 text-amber-400' : 'bg-amber-50 border-amber-300 text-amber-700'
    }
  }

  const inicioAtencion = fechaTrabajando || fechaRecibido
  const msAtencion = Math.max(0, fechaFin - inicioAtencion)
  const horasUsadas = msAtencion / (1000 * 60 * 60)
  const horasLimite = ticket.horasEstimadas || 10

  const horasEnteras = Math.floor(horasUsadas)
  const minutos = Math.floor((horasUsadas - horasEnteras) * 60)

  const esConcluido = ticket.estado === 'COMPLETADO' || ticket.estado === 'APROBADO' || ticket.estado === 'RECHAZADO'
  const aTiempo = horasUsadas <= horasLimite

  let textoTiempo = `${horasEnteras}h ${minutos}m`
  if (!esConcluido) {
    textoTiempo += ' (En curso)'
  }

  return {
    horasUsadas: horasUsadas.toFixed(1),
    horasLimite,
    textoTiempo,
    tiempoEsperaTexto,
    aTiempo,
    badgeColor: aTiempo 
      ? (esModoOscuro.value ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-400' : 'bg-emerald-50 border-emerald-300 text-emerald-700')
      : (esModoOscuro.value ? 'bg-red-950/60 border-red-800/80 text-red-400 font-bold' : 'bg-red-50 border-red-300 text-red-700 font-bold')
  }
}

const manejarSubidaArchivosMultiples = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  Array.from(files).forEach((file) => {
    if (file.size > 10 * 1024 * 1024) {
      alert(`⚠️ El archivo "${file.name}" supera el límite de 10MB.`)
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

const abrirSelectorArchivos = () => {
  fileInputRef.value?.click()
}

const limpiarFormularioCompleto = () => {
  asuntoTicket.value = ''
  cuerpoTicket.value = ''
  correoDestinatario.value = ''
  proyectoTicket.value = ''
  prioridadTicket.value = 'BAJA'
  horasObjetivoTicket.value = 10
  listaArchivosBase64.value = []
  if (fileInputRef.value) fileInputRef.value.value = ''
}

onMounted(() => {
  const temaGuardado = localStorage.getItem('relant_theme')
  esModoOscuro.value = temaGuardado ? temaGuardado === 'oscuro' : true
  const guardado = localStorage.getItem('relant_active_ticket_id')
  if (guardado) ticketIdActivo.value = guardado
  cargarProyectosFirebase()
})

// GRAPHQL
const OBTENER_DATOS_DASHBOARD = gql`
  query GetDashboardData {
    me { id nombre email rol fotoUrl }
    todosUsuarios { id nombre email }
    misTickets {
      id titulo descripcion estado comentario_admin fecha_recibido fecha_trabajando fecha_completado fecha_evaluacion creadorId asignadoId chat archivo archivos prioridad proyecto horasEstimadas devoluciones
      creador { email nombre }
      asignado { email nombre }
    }
  }
`
const { result, loading, refetch } = useQuery<{ me: any, todosUsuarios: Usuario[], misTickets: any[] }>(OBTENER_DATOS_DASHBOARD)

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
const ELIMINAR_TICKET_MUTATION = gql`
  mutation EliminarTicket($ticketId: String!) {
    eliminarTicket(ticketId: $ticketId)
  }
`

const { mutate: apiCrear } = useMutation(CREAR_TICKET)
const { mutate: apiIniciar } = useMutation(INICIAR_TRABAJO)
const { mutate: apiCompletar } = useMutation(COMPLETAR_TRABAJO)
const { mutate: apiEvaluar } = useMutation(EVALUAR_TICKET)
const { mutate: apiChat } = useMutation(ENVIAR_MENSAJE_CHAT)
const { mutate: apiCambiarPrioridad } = useMutation(CAMBIAR_PRIORIDAD_MUTATION)
const { mutate: apiEliminarTicket } = useMutation(ELIMINAR_TICKET_MUTATION)

const esAdmin = computed(() => result.value?.me?.rol === 'ADMIN')

const abrirModalEliminar = (ticket: any) => {
  ticketAEliminar.value = ticket
  mostrarModalEliminar.value = true
}

const confirmarEliminarTicket = async () => {
  if (!ticketAEliminar.value) return
  try {
    await apiEliminarTicket({ ticketId: ticketAEliminar.value.id })
    mostrarModalEliminar.value = false
    ticketAEliminar.value = null
    refetch()
  } catch (err: any) {
    alert('Error al eliminar ticket: ' + err.message)
  }
}

const ejecutarCambioPrioridad = async (ticketId: string, nuevaPrioridad: string) => {
  try {
    await apiCambiarPrioridad({ ticketId, prioridad: nuevaPrioridad })
    refetch()
  } catch (err: any) { alert('Error: ' + err.message) }
}

const obtenerTicketsFiltradosReporte = () => {
  const tickets = result.value?.misTickets || []
  const miIdPrisma = result.value?.me?.id || ''
  const miEmail = result.value?.me?.email?.toLowerCase() || ''
  const miNombre = result.value?.me?.nombre?.toLowerCase() || ''

  let baseTickets = tickets.filter((t: any) => 
    t.asignadoId === miIdPrisma || 
    t.creadorId === miIdPrisma ||
    (miEmail && (t.creador?.email?.toLowerCase() === miEmail || t.asignado?.email?.toLowerCase() === miEmail)) ||
    (miNombre && (t.creador?.nombre?.toLowerCase() === miNombre || t.asignado?.nombre?.toLowerCase() === miNombre))
  )

  const inicioDate = new Date(fechaInicioReporte.value + 'T00:00:00')
  const finDate = new Date(fechaFinReporte.value + 'T23:59:59')

  return baseTickets.filter((t: any) => {
    const fechaTicket = parsearFecha(t.fecha_recibido)
    return fechaTicket && fechaTicket >= inicioDate && fechaTicket <= finDate
  })
}

const descargarReporteExcel = () => {
  if (!fechaInicioReporte.value || !fechaFinReporte.value) {
    alert('❌ Seleccione el rango de fechas.')
    return
  }

  const filtrados = obtenerTicketsFiltradosReporte()
  if (filtrados.length === 0) {
    alert('⚠️ No hay tickets en el rango de fechas seleccionado.')
    return
  }

  let tablaHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8" /></head>
    <body>
      <table>
        <thead>
          <tr>
            <th>Folio</th><th>Título</th><th>Descripción</th><th>Prioridad</th><th>Proyecto</th><th>Espera Previa</th><th>Atención Real</th><th>Meta SLA</th><th>Estado</th><th>Fecha Recibido</th><th>Creador</th><th>Asignado</th>
          </tr>
        </thead>
        <tbody>
  `

  filtrados.forEach((t: any) => {
    const folio = 'RLN-' + t.id.substring(0, 6).toUpperCase()
    const infoSla = obtenerResumenTiempoSla(t)
    tablaHtml += `
      <tr>
        <td>${folio}</td><td>${t.titulo || ''}</td><td>${t.descripcion || ''}</td><td>${t.prioridad || 'BAJA'}</td><td>${t.proyecto || 'General'}</td><td>${infoSla.tiempoEsperaTexto}</td><td>${infoSla.textoTiempo}</td><td>${infoSla.horasLimite}h</td><td>${t.estado || ''}</td><td>${parsearFecha(t.fecha_recibido)?.toLocaleString() || ''}</td><td>${t.creador?.nombre || t.creador?.email || ''}</td><td>${t.asignado?.nombre || t.asignado?.email || ''}</td>
      </tr>
    `
  })

  tablaHtml += `</tbody></table></body></html>`
  const blob = new Blob([tablaHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(blob)
  enlace.download = `Reporte_Relant_${fechaInicioReporte.value}_a_${fechaFinReporte.value}.xls`
  enlace.click()
}

const descargarReportePdf = () => {
  if (!fechaInicioReporte.value || !fechaFinReporte.value) {
    alert('❌ Seleccione el rango de fechas.')
    return
  }

  const filtrados = obtenerTicketsFiltradosReporte()
  if (filtrados.length === 0) {
    alert('⚠️ No hay tickets en el rango de fechas seleccionado.')
    return
  }

  const periodoVisual = `${formatearFechaVisual(fechaInicioReporte.value)} – ${formatearFechaVisual(fechaFinReporte.value)}`
  let itemsHtml = ''
  
  filtrados.forEach((t: any, index: number) => {
    const folio = 'RLN-' + t.id.substring(0, 6).toUpperCase()
    const infoSla = obtenerResumenTiempoSla(t)
    itemsHtml += `
      <div style="margin-bottom: 15px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
        <strong>#${index + 1} ${folio} - ${t.titulo}</strong> (${t.estado})<br>
        <small>De: ${t.creador?.nombre || 'Mesa'} | Para: ${t.asignado?.nombre || 'Sin asignar'} | Espera: ${infoSla.tiempoEsperaTexto} | Atención Real: ${infoSla.textoTiempo} (SLA: ${infoSla.horasLimite}h)</small>
        <p style="margin: 5px 0;">${t.descripcion}</p>
      </div>
    `
  })

  const doc = window.open('', '', 'width=800,height=600')
  if (doc) {
    doc.document.write(`<html><head><title>Reporte de Tickets RELANT</title></head><body style="font-family:sans-serif; padding:20px;"><h2>Reporte de Tickets RELANT</h2><p>Periodo: ${periodoVisual}</p><hr>${itemsHtml}</body></html>`)
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
      proyecto: proyectoTicket.value || null,
      horasEstimadas: Number(horasObjetivoTicket.value) || 10
    })
    alert('📧 Requerimiento despachado con éxito.')
    limpiarFormularioCompleto()
    refetch()
  } catch (err: any) { alert('Error: ' + err.message) }
}

// 🎯 BÚSQUEDA Y FILTRADO (SOLO ADMINS VEN TODOS LOS TICKETS EN VALIDACIÓN)
const ticketsFiltradosConPrivacidad = computed(() => {
  const tickets = result.value?.misTickets || []
  const miIdPrisma = result.value?.me?.id || ''
  const miEmail = result.value?.me?.email?.toLowerCase() || ''
  const miNombre = result.value?.me?.nombre?.toLowerCase() || ''
  const soyAdmin = result.value?.me?.rol === 'ADMIN'

  let filtrados = tickets.filter((t: any) => {
    const esCreadorId = t.creadorId === miIdPrisma
    const esAsignadoId = t.asignadoId === miIdPrisma
    const esCreadorEmail = miEmail && t.creador?.email?.toLowerCase() === miEmail
    const esAsignadoEmail = miEmail && t.asignado?.email?.toLowerCase() === miEmail
    const esCreadorNombre = miNombre && t.creador?.nombre?.toLowerCase() === miNombre
    const esAsignadoNombre = miNombre && t.asignado?.nombre?.toLowerCase() === miNombre
    
    // 🎯 Únicamente los administradores ven todos los tickets en la pestaña de Validación
    const esEnValidacionAdmin = soyAdmin && t.estado === 'COMPLETADO'

    return esCreadorId || esAsignadoId || esCreadorEmail || esAsignadoEmail || esCreadorNombre || esAsignadoNombre || esEnValidacionAdmin
  })

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
      t.titulo?.toLowerCase().includes(query)
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
  <div :class="esModoOscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'" class="flex h-screen overflow-hidden transition-colors duration-200 relative font-sans">
    
    <Sidebar :dark="esModoOscuro" />

    <div class="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
      
      <!-- HEADER -->
      <header :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="h-16 border-b px-4 sm:px-8 flex justify-between items-center shrink-0">
        <div class="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <span class="text-[10px] sm:text-xs font-black bg-red-700 text-white px-2 py-0.5 rounded-md tracking-wider">RELANT HQ</span>
          <h2 class="text-sm sm:text-lg font-black tracking-tight truncate">Tickets</h2>
        </div>

        <div 
          @click="router.push('/perfil')" 
          :class="esModoOscuro ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800/80 text-white' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800'"
          class="flex items-center space-x-3 px-3 py-1.5 rounded-2xl border cursor-pointer transition-all shadow-sm group"
          title="Ver y Configurar mi Perfil"
        >
          <div class="w-8 h-8 rounded-full overflow-hidden border-2 border-red-600 bg-zinc-800 flex items-center justify-center shrink-0 shadow-sm">
            <img v-if="result?.me?.fotoUrl" :src="result.me.fotoUrl" alt="Avatar" class="w-full h-full object-cover" />
            <span v-else class="text-xs font-black text-white">
              {{ result?.me?.nombre?.charAt(0).toUpperCase() || '👤' }}
            </span>
          </div>

          <div class="hidden sm:flex flex-col text-left min-w-0">
            <span class="text-xs font-bold truncate group-hover:text-red-500 transition-colors">
              {{ result?.me?.nombre || 'Mi Perfil' }}
            </span>
            <span class="text-[9px] font-mono text-emerald-500 font-bold leading-none">
              ● Operador Activo
            </span>
          </div>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto w-full">
        <main class="p-4 sm:p-8 space-y-6 sm:space-y-8 w-full max-w-7xl mx-auto pb-24">
          
          <!-- VENTANA FLOTANTE CENTRADA PARA BORRAR TICKET -->
          <div v-if="mostrarModalEliminar" class="fixed inset-0 bg-zinc-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-800'" class="border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-6">
              <div class="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto text-3xl">
                ⚠️
              </div>
              
              <div class="space-y-2">
                <h3 class="text-lg sm:text-xl font-black">¿Estás seguro(a) de eliminar este ticket?</h3>
                <p class="text-xs text-zinc-400">Esta acción borrará el requerimiento de forma permanente del portal y de la base de datos.</p>
              </div>

              <div class="flex items-center justify-center gap-4 pt-2">
                <button @click="confirmarEliminarTicket" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-3 rounded-xl cursor-pointer shadow-lg transition-all hover:scale-105">
                  Sí, acepto
                </button>
                <button @click="mostrarModalEliminar = false; ticketAEliminar = null" class="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-6 py-3 rounded-xl cursor-pointer shadow-lg transition-all hover:scale-105">
                  No, volver
                </button>
              </div>
            </div>
          </div>

          <!-- WORKSPACE MODAL -->
          <div v-if="ticketActivoWorkspace" class="fixed inset-0 bg-zinc-950/80 backdrop-blur-md z-50 flex items-center justify-center p-0 sm:p-4">
            <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-800'" class="border-0 sm:border rounded-none sm:rounded-3xl w-full max-w-5xl h-full sm:h-[85vh] flex flex-col overflow-hidden shadow-2xl">
              <div :class="esModoOscuro ? 'from-red-950/40 to-zinc-900 border-zinc-800' : 'from-red-50 to-slate-50 border-slate-200'" class="bg-linear-to-r p-4 sm:p-6 border-b flex justify-between items-center shrink-0">
                <div class="min-w-0 pr-2">
                  <span class="text-[10px] font-bold text-red-500 uppercase tracking-widest block">Mesa de Trabajo</span>
                  <h3 class="text-base sm:text-xl font-black mt-0.5 truncate">{{ ticketActivoWorkspace.titulo }}</h3>
                </div>
                <button @click="cerrarWorkspace" class="font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs cursor-pointer bg-zinc-800 text-zinc-400 hover:text-white">✕ Cerrar</button>
              </div>

              <div class="flex-1 p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 overflow-y-auto content-start">
                <div :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800/60' : 'bg-slate-50 border-slate-200'" class="border rounded-2xl p-4 sm:p-5 flex flex-col space-y-4">
                  <h4 class="text-xs font-bold uppercase tracking-widest border-b pb-2" :class="esModoOscuro ? 'text-zinc-400 border-zinc-800' : 'text-slate-500 border-slate-200'">Diagnóstico e Historial</h4>
                  
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border" :class="esModoOscuro ? 'bg-zinc-900/30 border-zinc-800/50' : 'bg-white border-slate-200'">
                    <div class="min-w-0">
                      <label class="text-[9px] uppercase font-bold text-zinc-500 block">De (Creador)</label>
                      <p class="text-xs font-bold text-red-500 mt-0.5 truncate">{{ ticketActivoWorkspace.creador?.nombre || ticketActivoWorkspace.creador?.email || 'Mesa Central' }}</p>
                    </div>
                    <div class="min-w-0">
                      <label class="text-[9px] uppercase font-bold text-zinc-500 block">Para (Asignado)</label>
                      <p class="text-xs font-bold text-amber-500 mt-0.5 truncate">{{ ticketActivoWorkspace.asignado?.nombre || ticketActivoWorkspace.asignado?.email || 'Sin Asignar' }}</p>
                    </div>
                  </div>

                  <div class="p-3 rounded-xl border flex flex-col gap-1.5" :class="obtenerResumenTiempoSla(ticketActivoWorkspace).badgeColor">
                    <div class="flex justify-between items-center text-xs">
                      <span class="font-bold">⌛ Espera previa de atención:</span>
                      <span class="font-mono font-black">{{ obtenerResumenTiempoSla(ticketActivoWorkspace).tiempoEsperaTexto }}</span>
                    </div>
                    <div class="flex justify-between items-center text-xs border-t pt-1" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'">
                      <span class="font-bold">⏱️ Tiempo de atención real (SLA {{ obtenerResumenTiempoSla(ticketActivoWorkspace).horasLimite }}h):</span>
                      <span class="font-mono font-black">{{ obtenerResumenTiempoSla(ticketActivoWorkspace).textoTiempo }}</span>
                    </div>
                  </div>

                  <div>
                    <label class="text-[10px] uppercase font-bold text-zinc-500 block">Descripción Inicial</label>
                    <p :class="esModoOscuro ? 'bg-zinc-950/40 border-zinc-800/40 text-zinc-300' : 'bg-white border-slate-200 text-slate-700'" class="text-sm whitespace-pre-line mt-1 p-3 sm:p-4 rounded-xl border leading-relaxed max-h-40 overflow-y-auto">{{ ticketActivoWorkspace.descripcion }}</p>
                  </div>

                  <div v-if="ticketActivoWorkspace.archivos && ticketActivoWorkspace.archivos.length > 0" class="pt-4 border-t" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'">
                    <label class="text-[10px] uppercase font-bold text-zinc-500 block mb-2">📎 Documentos / Archivos Adjuntos ({{ ticketActivoWorkspace.archivos.length }})</label>
                    <div class="grid grid-cols-1 gap-2">
                      <div v-for="(archivoItem, index) in ticketActivoWorkspace.archivos" :key="index" :class="esModoOscuro ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-slate-200'" class="rounded-xl border p-3">
                        <template v-if="archivoItem.includes('{')">
                          <div class="flex justify-between items-center text-xs">
                            <span class="font-mono font-bold truncate pr-2" :class="esModoOscuro ? 'text-zinc-300' : 'text-slate-700'">📦 {{ JSON.parse(archivoItem).nombre }}</span>
                            <a :href="JSON.parse(archivoItem).data" :download="JSON.parse(archivoItem).nombre" class="bg-red-700 hover:bg-red-800 text-white font-bold px-3 py-1 rounded-lg text-[10px] uppercase tracking-wider shrink-0 transition">Descargar 💾</a>
                          </div>
                        </template>
                        <template v-else-if="archivoItem.startsWith('data:image')">
                          <img :src="archivoItem" alt="Evidencia" class="max-w-full max-h-48 object-contain rounded-lg shadow-md mx-auto" />
                        </template>
                        <template v-else>
                          <a :href="archivoItem" download="adjunto_ticket" class="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition w-full">📄 Descargar Archivo {{ Number(index) + 1 }}</a>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>

                <div :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800/60' : 'bg-slate-50 border-slate-200'" class="border rounded-2xl p-4 sm:p-5 flex flex-col justify-between overflow-hidden">
                  <h4 class="text-xs font-bold uppercase tracking-widest border-b pb-2" :class="esModoOscuro ? 'text-zinc-400 border-zinc-800' : 'text-slate-500 border-slate-200'">Línea de Tiempo / Chat</h4>
                  <div class="flex-1 my-3 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
                    <div v-for="(log, i) in bitacoraProgresoAcumulada" :key="i" :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800/40 text-zinc-300' : 'bg-white border-slate-200 text-slate-700'" class="p-2 rounded-lg border wrap-break-word">{{ log }}</div>
                  </div>

                  <div v-if="ticketActivoWorkspace.estado === 'TRABAJANDO'" class="space-y-3 pt-2 border-t" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'">
                    <div class="flex gap-2">
                      <input v-model="notaProgresoActual" @keyup.enter="registrarProgresoEnCaliente" type="text" placeholder="Escribe un avance..." :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-300 text-slate-800'" class="rounded-xl px-3 py-2 text-xs flex-1 border focus:outline-none" />
                      <button @click="registrarProgresoEnCaliente" class="bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs px-3 py-2 rounded-xl cursor-pointer">➕ Log</button>
                    </div>
                    <button @click="despacharAuditoriaAdmin" class="w-full bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-widest py-2.5 rounded-xl shadow-md cursor-pointer">🏁 Enviar a Validación</button>
                  </div>

                  <div v-if="ticketActivoWorkspace.estado === 'COMPLETADO' && esAdmin" class="space-y-3 pt-2 border-t" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'">
                    <div>
                      <label class="text-[10px] uppercase font-bold block mb-1" :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-500'">Comentario de Dictamen (Obligatorio)</label>
                      <input v-model="comentarioAdmin" type="text" placeholder="Razones de aprobación o rechazo..." :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-300 text-slate-800'" class="rounded-xl px-3 py-2 text-xs w-full border focus:outline-none" />
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <button @click="ejecutarDictamenAdmin(true)" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer">✓ Aprobar y Liberar</button>
                      <button @click="ejecutarDictamenAdmin(false)" class="bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer">✕ Rechazar</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 📊 REPORTES -->
          <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'" class="w-full rounded-2xl border overflow-hidden text-left">
            <div :class="esModoOscuro ? 'border-zinc-800 bg-zinc-950/40' : 'border-slate-200 bg-slate-50/50'" class="p-3 sm:p-4 border-b flex items-center justify-between">
              <h3 class="text-xs font-black tracking-wider uppercase">📊 Exportar Reporte Operacional</h3>
            </div>
            <div class="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div class="flex flex-col space-y-1">
                <label class="text-[10px] font-black uppercase tracking-wider" :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-500'">Fecha de Inicio:</label>
                <input v-model="fechaInicioReporte" type="date" :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'" class="p-2.5 text-xs rounded-xl border focus:outline-none" />
              </div>
              <div class="flex flex-col space-y-1">
                <label class="text-[10px] font-black uppercase tracking-wider" :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-500'">Fecha de Fin:</label>
                <input v-model="fechaFinReporte" type="date" :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'" class="p-2.5 text-xs rounded-xl border focus:outline-none" />
              </div>
              <button @click="descargarReporteExcel" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl cursor-pointer shadow-md transition-all">📥 Descargar Excel</button>
              <button @click="descargarReportePdf" class="w-full bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl cursor-pointer shadow-md transition-all">📄 Descargar PDF</button>
            </div>
          </div>

          <!-- FORMULARIO DE TICKET -->
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
                  <select v-model="prioridadTicket" :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'" class="flex-1 text-xs p-2.5 rounded-xl border focus:outline-none font-bold cursor-pointer">
                    <option value="BAJA">🟢 BAJA</option>
                    <option value="MEDIA">🔵 MEDIA</option>
                    <option value="ALTA">🟡 ALTA</option>
                    <option value="CRITICA">🔴 CRÍTICA</option>
                  </select>
                </div>

                <div class="flex items-center">
                  <label class="w-16 text-xs font-bold uppercase" :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-500'">Proyecto:</label>
                  <select v-model="proyectoTicket" :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'" class="flex-1 text-xs p-2.5 rounded-xl border focus:outline-none font-bold cursor-pointer truncate">
                    <option value="">📂 General / Sin Proyecto</option>
                    <option v-for="nombreProj in listaProyectos" :key="nombreProj" :value="nombreProj">📁 {{ nombreProj }}</option>
                  </select>
                </div>

                <div class="flex items-center">
                  <label class="w-20 text-xs font-bold uppercase" :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-500'">Horas SLA:</label>
                  <input v-model.number="horasObjetivoTicket" type="number" min="1" max="500" :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'" class="flex-1 text-xs p-2.5 rounded-xl border focus:outline-none font-bold" placeholder="Ej. 10" />
                </div>
              </div>

              <div class="flex flex-col sm:flex-row sm:items-center border-b pb-2 gap-2" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'">
                <label class="w-16 text-xs font-bold uppercase" :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-500'">Asunto:</label>
                <div v-if="hitosDelProyectoSeleccionado.length > 0 && !usarHitoManual" class="flex-1 flex gap-2 items-center">
                  <select v-model="asuntoTicket" required :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'" class="flex-1 text-xs p-2.5 rounded-xl border focus:outline-none font-bold cursor-pointer">
                    <option value="" disabled>-- Selecciona un hito del proyecto --</option>
                    <option v-for="hito in hitosDelProyectoSeleccionado" :key="hito.id" :value="hito.title">
                      {{ hito.completed ? '✅ [Completado]' : '⏳ [Pendiente]' }} {{ hito.title }}
                    </option>
                  </select>
                  <button type="button" @click="usarHitoManual = true" class="text-[11px] font-bold text-red-500 underline whitespace-nowrap">✏️ Otro</button>
                </div>
                <div v-else class="flex-1 flex gap-2 items-center">
                  <input v-model="asuntoTicket" type="text" required :class="esModoOscuro ? 'text-white' : 'text-slate-800'" class="flex-1 text-sm focus:outline-none bg-transparent font-bold" placeholder="Título del hito o incidencia" />
                </div>
              </div>

              <!-- 📎 SOLO BOTÓN DE CLIP PARA ADJUNTAR ARCHIVOS -->
              <div class="flex items-center gap-2 border-b pb-3" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'">
                <input type="file" ref="fileInputRef" multiple accept="*" @change="manejarSubidaArchivosMultiples" class="hidden" />
                <button type="button" @click="abrirSelectorArchivos" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition cursor-pointer">
                  <span>📎</span>
                  <span>Adjuntar archivos</span>
                </button>
                <span v-if="listaArchivosBase64.length > 0" class="text-xs text-zinc-400 font-mono font-semibold">
                  ({{ listaArchivosBase64.length }} seleccionado(s))
                </span>
              </div>

              <div v-if="listaArchivosBase64.length > 0" class="flex flex-wrap gap-2 pt-1">
                <span v-for="(f, i) in listaArchivosBase64" :key="i" class="bg-zinc-800 text-zinc-200 text-[10px] font-mono px-2.5 py-1 rounded-lg border border-zinc-700 flex items-center gap-1.5">
                  📦 {{ f.nombre }}
                  <button type="button" @click="listaArchivosBase64.splice(i, 1)" class="text-red-400 font-bold hover:text-red-300 ml-1 cursor-pointer">✕</button>
                </span>
              </div>

              <textarea v-model="cuerpoTicket" rows="3" required :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'" class="w-full p-3 sm:p-4 text-sm rounded-xl border focus:outline-none" placeholder="Especificaciones técnicas..."></textarea>
              
              <div class="flex justify-end">
                <button type="submit" class="w-full sm:w-auto bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-widest px-6 py-2.5 rounded-xl cursor-pointer shadow-md">Despachar Ticket</button>
              </div>
            </form>
          </div>

          <!-- 📂 FILTROS Y BÚSQUEDA EXCLUSIVA POR TÍTULO -->
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

            <input v-model="busquedaQuery" type="text" placeholder="Buscar por Título / Asunto..." :class="esModoOscuro ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'" class="px-4 py-2 text-xs rounded-xl focus:outline-none w-full lg:w-64 border" />
          </div>

          <!-- LISTADO DE TICKETS -->
          <div class="space-y-4 sm:space-y-6">
            <div v-if="loading" class="text-center py-12 text-zinc-400 animate-pulse text-sm">Sincronizando registros...</div>
            <div v-else-if="ticketsFiltradosConPrivacidad.length === 0" :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-white border-slate-200 text-slate-500'" class="text-center py-16 rounded-2xl text-sm border">No tienes requerimientos en esta sección.</div>

            <div v-else v-for="ticket in ticketsFiltradosConPrivacidad" :key="ticket.id" :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-800 shadow-sm'" class="rounded-2xl border p-4 sm:p-6 space-y-4 relative">
              <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b pb-3" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'">
                <div class="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs min-w-0 pr-8">
                  <span :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-slate-100 border-slate-300 text-slate-700'" class="font-mono font-bold px-2 py-0.5 rounded-md border">{{ 'RLN-' + ticket.id.substring(0,6).toUpperCase() }}</span>
                  <span :class="esModoOscuro ? 'bg-zinc-950/60 border-zinc-800 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-600'" class="font-semibold px-2 py-0.5 rounded-md border truncate max-w-full">
                    📩 De: <strong class="text-red-500">{{ ticket.creador?.nombre || ticket.creador?.email || 'Mesa' }}</strong>
                    <span class="opacity-40 mx-0.5">➡️</span>
                    👤 Para: <strong class="text-amber-500">{{ ticket.asignado?.nombre || ticket.asignado?.email || 'Sin Asignar' }}</strong>
                  </span>

                  <!-- FECHA DE CREACIÓN DEL TICKET -->
                  <span class="bg-zinc-950/60 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md text-[10px] font-bold" title="Fecha y hora de creación">
                    📅 Creado: {{ parsearFecha(ticket.fecha_recibido)?.toLocaleString([], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || 'Sin fecha' }}
                  </span>
                  
                  <select :value="ticket.prioridad || 'BAJA'" @change="(e) => ejecutarCambioPrioridad(ticket.id, (e.target as HTMLSelectElement).value)" :class="obtenerColorPrioridad(ticket.prioridad)" class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase cursor-pointer border">
                    <option value="BAJA">🟢 BAJA</option>
                    <option value="MEDIA">🔵 MEDIA</option>
                    <option value="ALTA">🟡 ALTA</option>
                    <option value="CRITICA">🔴 CRÍTICA</option>
                  </select>

                  <span class="bg-zinc-950 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md text-[10px] font-bold">
                    ⌛ Espera: {{ obtenerResumenTiempoSla(ticket).tiempoEsperaTexto }}
                  </span>

                  <span 
                    :class="obtenerResumenTiempoSla(ticket).badgeColor" 
                    class="px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1"
                  >
                    ⏱️ Atención SLA ({{ obtenerResumenTiempoSla(ticket).horasLimite }}h): {{ obtenerResumenTiempoSla(ticket).textoTiempo }}
                    <span>{{ obtenerResumenTiempoSla(ticket).aTiempo ? '🟢' : '🚨 Excedido' }}</span>
                  </span>

                  <span v-if="ticket.proyecto" class="bg-blue-500/10 border border-blue-500/30 text-blue-500 px-2 py-0.5 rounded-md text-[10px] font-bold">📁 {{ ticket.proyecto }}</span>
                  <span v-if="ticket.devoluciones > 0" class="bg-red-500/10 border border-red-500/30 text-red-500 px-2 py-0.5 rounded-md text-[10px] font-bold">⚠️ {{ ticket.devoluciones }} Devolución(es)</span>
                </div>

                <!-- BOTÓN '✕' PARA DESPLEGAR MODAL DE ELIMINACIÓN -->
                <button 
                  @click.stop="abrirModalEliminar(ticket)" 
                  class="absolute top-4 right-4 sm:static text-orange-500 hover:text-red-500 hover:bg-red-500/10 font-black text-xl w-8 h-8 rounded-xl flex items-center justify-center transition cursor-pointer"
                  title="Eliminar este ticket"
                >
                  ✕
                </button>
              </div>

              <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div class="flex-1 w-full min-w-0">
                  <h4 class="text-base sm:text-lg font-black tracking-tight truncate text-left">{{ ticket.titulo }}</h4>
                  <p :class="esModoOscuro ? 'bg-zinc-950/40 border-zinc-800/40 text-zinc-300' : 'bg-slate-50 border-slate-200 text-slate-700'" class="text-xs mt-2 whitespace-pre-line p-3 rounded-xl border leading-relaxed text-left">{{ ticket.descripcion }}</p>
                </div>

                <div class="shrink-0 flex gap-2 w-full md:w-auto">
                  <button v-if="ticket.estado === 'RECIBIDO'" @click="activarProcesamientoTicket(ticket)" class="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer w-full md:w-auto">🛠️ Procesar Requerimiento</button>
                  <button v-if="ticket.estado === 'TRABAJANDO'" @click="ticketIdActivo = ticket.id" class="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer w-full md:w-auto">💼 Abrir Panel / Chat</button>
                  <button v-if="ticket.estado === 'COMPLETADO'" @click="ticketIdActivo = ticket.id" class="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer w-full md:w-auto">{{ esAdmin ? '🛡️ Auditar Folio' : '⏳ En Revisión / Chat' }}</button>
                  <button v-if="ticket.estado === 'APROBADO'" @click="ticketIdActivo = ticket.id" class="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-zinc-700 cursor-pointer w-full md:w-auto">🔒 Concluido (Ver Chat)</button>
                  <button v-if="ticket.estado === 'RECHAZADO'" @click="ticketIdActivo = ticket.id" class="bg-red-950/60 border border-red-800 text-red-400 text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer w-full md:w-auto">✕ Devuelto (Ver Chat)</button>
                </div>
              </div>
            </div>
          </div>

        </main>
      </div>

      <!-- ☀️/🌙 BOTÓN FLOTANTE -->
      <button 
        @click="toggleTema" 
        :class="esModoOscuro ? 'bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800' : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'"
        class="fixed bottom-6 right-6 z-40 px-4 py-2.5 rounded-2xl border shadow-2xl text-xs font-black flex items-center gap-2 cursor-pointer transition-all hover:scale-105"
        title="Cambiar tema de la aplicación"
      >
        <span>{{ esModoOscuro ? '☀️' : '🌙' }}</span>
        <span>{{ esModoOscuro ? 'Claro' : 'Oscuro' }}</span>
      </button>

    </div>
  </div>
</template>