<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { useQuery, useMutation } from '@vue/apollo-composable' // 📊 Importamos useMutation junto a useQuery
import { gql } from '@apollo/client/core'
import { useRouter } from 'vue-router'
import { messaging } from '../firebase' // 📱 Importamos la conexión centralizada de Firebase
import { getToken } from 'firebase/messaging' // 📡 Importamos el generador de tokens de Google

const router = useRouter()
const esModoOscuro = ref(true)
const menuMovilAbierto = ref(false) // 🍔 Control del menú en teléfonos

// ☀️/🌙 Recuperar y recordar el tema seleccionado por el usuario en localStorage
onMounted(async () => {
  const temaGuardado = localStorage.getItem('relant_theme')
  if (temaGuardado) {
    esModoOscuro.value = temaGuardado === 'oscuro'
  } else {
    esModoOscuro.value = true
  }

  // 🚀 PROTOCOLO AUTOMÁTICO DE SOLICITUD DE PERMISOS PUSH (PC Y TELÉFONO)
  try {
    const permiso = await Notification.requestPermission()
    if (permiso === 'granted') {
      // Solicita a los servidores de Google el identificador único de este dispositivo
      // 💡 NOTA: Reemplaza 'TU_CLAVE_VAPID_PUBLICA_AQUI' por tu clave pública de Firebase Console (Configuración del proyecto > Mensajería)
      const tokenDispositivo = await getToken(messaging, { 
        vapidKey: 'TU_CLAVE_VAPID_PUBLICA_AQUI' 
      })
      
      if (tokenDispositivo) {
        // Le enviamos el identificador al backend para guardarlo en PostgreSQL
        await vincularTokenDispositivo({ token: tokenDispositivo })
        console.log('✓ Dispositivo sincronizado con éxito para alertas en tiempo real.')
      }
    }
  } catch (error) {
    console.log('Notificaciones push en espera de llaves VAPID válidas corporativas.')
  }
})

const toggleTema = () => {
  esModoOscuro.value = !esModoOscuro.value
  localStorage.setItem('relant_theme', esModoOscuro.value ? 'oscuro' : 'claro')
}

// Helper para parsear las fechas de PostgreSQL de forma segura
const parsearFecha = (fecha: any) => {
  if (!fecha) return null
  if (!isNaN(Number(fecha))) return new Date(Number(fecha))
  return new Date(fecha)
}

// Helper para dar color estilizado a los badges de prioridad
const obtenerColorPrioridad = (prioridad: string) => {
  switch (prioridad?.toUpperCase()) {
    case 'CRITICA': return 'bg-red-950/60 border border-red-900 text-red-400'
    case 'ALTA': return 'bg-amber-950/60 border border-amber-900 text-amber-400'
    case 'MEDIA': return 'bg-blue-950/60 border border-blue-900 text-blue-400'
    default: return 'bg-zinc-800 border border-zinc-700 text-zinc-400'
  }
}

// 🔒 OBTENER DATOS DEL HOME (Sincronizado con Prioridad, Proyecto y Creador)
const OBTENER_DATOS_HOME = gql`
  query GetHomeData {
    me {
      id
      nombre
      email
      rol
    }
    misTickets {
      id
      titulo
      estado
      fecha_recibido
      creadorId
      asignadoId
      prioridad
      proyecto
      creador {
        nombre
        email
      }
    }
  }
`
const { result, loading } = useQuery(OBTENER_DATOS_HOME)

// 📱 MUTACIÓN PARA REGISTRAR DISPOSITIVO LOGUEADO
const GUARDAR_TOKEN_DISPOSITIVO_MUTATION = gql`
  mutation GuardarToken($token: String!) {
    guardarTokenDispositivo(token: $token) { id }
  }
`
const { mutate: vincularTokenDispositivo } = useMutation(GUARDAR_TOKEN_DISPOSITIVO_MUTATION)

// --- 📊 LÓGICA DE FILTRADO Y MÉTRICAS DE CONTADORES ---
const ticketsFiltradosConPrivacidad = computed(() => {
  const tickets = result.value?.misTickets || []
  const miIdPrisma = result.value?.me?.id || ''
  const soyAdmin = result.value?.me?.rol === 'ADMIN'

  let filtrados = [...tickets]

  if (!soyAdmin) {
    filtrados = filtrados.filter((t: any) => t.asignadoId === miIdPrisma || t.creadorId === miIdPrisma)
  }

  return filtrados
})

const totalTickets = computed(() => ticketsFiltradosConPrivacidad.value.length)
const ticketsCompletadosCount = computed(() => ticketsFiltradosConPrivacidad.value.filter((t: any) => t?.estado === 'APROBADO').length)

// Obtener el array limpio de los tickets que están en desarrollo
const listaTicketsPendientes = computed(() => {
  return ticketsFiltradosConPrivacidad.value.filter((t: any) => t.estado === 'RECIBIDO' || t.estado === 'TRABAJANDO')
})

// 🚀 ACCESO DIRECTO INTERACTIVO: Guarda el ID en memoria y abre el espacio de trabajo
const irATicketDirecto = (id: string) => {
  localStorage.setItem('relant_active_ticket_id', id)
  router.push('/tickets')
}

// ⏱️ Lógica inteligente para calcular el estatus y el tiempo del pendiente más antiguo
const estadoPendientes = computed(() => {
  const pendientes = listaTicketsPendientes.value
  
  if (pendientes.length === 0) {
    return {
      cantidad: 0,
      mensaje: 'Hoy no tienes pendientes operacionales.',
      detalle: '¡Excelente! Tienes la mesa limpia y todo está al día.'
    }
  }

  let masAntiguo = pendientes[0]
  pendientes.forEach(t => {
    const fechaT = parsearFecha(t.fecha_recibido)
    const fechaMasAntiguo = parsearFecha(masAntiguo.fecha_recibido)
    if (fechaT && fechaMasAntiguo && fechaT.getTime() < fechaMasAntiguo.getTime()) {
      masAntiguo = t
    }
  })

  const fechaCreacion = parsearFecha(masAntiguo.fecha_recibido)
  if (!fechaCreacion) {
    return {
      cantidad: pendientes.length,
      mensaje: `Tienes ${pendientes.length} pendientes activos.`,
      detalle: 'Esperando procesamiento en la mesa de ayuda.'
    }
  }

  const ahora = new Date()
  const diffMs = ahora.getTime() - fechaCreacion.getTime()
  const diffMins = Math.floor(diffMs / 1000 / 60)
  const diffHoras = Math.floor(diffMins / 60)
  const diffDias = Math.floor(diffHoras / 24)

  let tiempoTexto = ''
  if (diffDias > 0) {
    tiempoTexto = `${diffDias} día${diffDias > 1 ? 's' : ''}`
  } else if (diffHoras > 0) {
    tiempoTexto = `${diffHoras} hora${diffHoras > 1 ? 's' : ''}`
  } else if (diffMins > 0) {
    tiempoTexto = `${diffMins} minuto${diffMins > 1 ? 's' : ''}`
  } else {
    tiempoTexto = 'unos instantes'
  }

  return {
    cantidad: pendientes.length,
    mensaje: `Tienes tareas acumuladas desde hace ${tiempoTexto}.`,
    detalle: `Actualmente hay ${pendientes.length} requerimiento(s) activo(s) esperando atención.`
  }
})
</script>

<template>
  <div :class="esModoOscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'" class="flex min-h-screen transition-colors duration-200 relative overflow-x-hidden font-sans">
    
    <!-- 📱 SIDEBAR RESPONSIVA -->
    <div :class="[
      menuMovilAbierto ? 'translate-x-0' : '-translate-x-full',
      'lg:translate-x-0 fixed lg:sticky top-0 left-0 h-screen z-50 transition-transform duration-300 ease-in-out shrink-0'
    ]">
      <Sidebar :dark="esModoOscuro" />
    </div>

    <div v-if="menuMovilAbierto" @click="menuMovilAbierto = false" class="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-40"></div>

    <div class="flex-1 flex flex-col min-w-0 w-full">
      
      <!-- HEADER RESPONSIVO -->
      <header :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="h-16 border-b px-4 sm:px-8 flex justify-between items-center shrink-0 transition-colors">
        <div class="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <button @click="menuMovilAbierto = !menuMovilAbierto" class="lg:hidden p-1.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer mr-1 shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          <span class="text-[10px] sm:text-xs font-black bg-red-700 text-white px-2 py-0.5 rounded-md tracking-wider shrink-0">RELANT HQ</span>
          <h2 class="text-sm sm:text-lg font-black tracking-tight truncate">Portal de Operaciones</h2>
        </div>
        <div class="flex items-center space-x-4">
          <button @click="toggleTema" :class="esModoOscuro ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'" class="px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer whitespace-nowrap">
            {{ esModoOscuro ? '☀️ Claro' : '🌙 Oscuro' }}
          </button>
        </div>
      </header>

      <!-- SECCIÓN GENERAL DE TRABAJO -->
      <main class="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center justify-start space-y-4 pt-2 sm:pt-4">
        
        <!-- 🎯 FILA DE KPIS OPTIMIZADA (3 COLUMNAS) -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-5xl mx-auto">
          <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="p-4 sm:p-5 rounded-2xl border border-solid flex items-center justify-between transition-colors text-left">
            <div>
              <p class="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider">Volumen Monitoreado</p>
              <p class="text-red-400 text-2xl font-black mt-0.5">{{ loading ? '...' : totalTickets }}</p>
            </div>
          </div>
          <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="p-4 sm:p-5 rounded-2xl border border-solid flex items-center justify-between transition-colors text-left">
            <div>
              <p class="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider">Tus Cierres</p>
              <p class="text-emerald-400 text-2xl font-black mt-0.5">{{ loading ? '...' : ticketsCompletadosCount }}</p>
            </div>
          </div>
          <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="p-4 rounded-2xl border border-solid flex items-center justify-between transition-colors text-left">
            <p class="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider">⚡ Canal Activo</p>
            <span class="text-[10px] font-mono text-zinc-500">PostgreSQL + SSL</span>
          </div>
        </div>

        <!-- RECUADROS CENTRALES -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 w-full max-w-5xl">
          
          <!-- 🏠 Tarjeta Izquierda: Bienvenida -->
          <div :class="esModoOscuro ? 'from-red-950/30 to-zinc-900 border-zinc-800' : 'from-red-50/40 to-white border-slate-200'" class="bg-linear-to-b border lg:col-span-6 p-4 sm:p-6 rounded-2xl shadow-lg flex flex-col justify-between space-y-4">
            <div class="space-y-3">
              <div class="inline-flex p-2 bg-red-700/10 text-red-500 rounded-xl border border-red-500/20 text-2xl">
                👋
              </div>
              <div class="space-y-1 text-left">
                <span class="text-[9px] font-bold text-red-500 uppercase tracking-widest block">Acceso Central Autenticado</span>
                <h1 class="text-xl sm:text-2xl font-black tracking-tight" :class="esModoOscuro ? 'text-white' : 'text-slate-900'">
                  ¡Hola, <span class="text-red-500">{{ loading ? 'Cargando...' : (result?.me?.nombre || 'Operador') }}</span>!
                </h1>
                <p :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-600'" class="text-xs leading-relaxed">
                  Tienes un canal directo y seguro hacia la Mesa de Ayuda. Monitorea requerimientos, actualiza el progreso en tus folios asignados y coordina en tiempo real.
                </p>
              </div>
            </div>
            <div class="pt-1 text-left">
              <router-link to="/tickets" class="inline-flex w-full sm:w-auto justify-center items-center space-x-2 bg-red-700 hover:bg-red-800 text-white text-[11px] font-black uppercase tracking-widest px-5 py-2.5 rounded-xl shadow-md transition cursor-pointer">
                <span>🎟️ Ir a Panel de Tickets</span>
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
              </router-link>
            </div>
          </div>

          <!-- ⏳ Tarjeta Derecha: Requerimientos Activos + LISTADO INTEGRADO -->
          <div :class="esModoOscuro ? 'from-zinc-900 to-zinc-950 border-zinc-800' : 'from-slate-100/50 to-white border-slate-200'" class="bg-linear-to-b border lg:col-span-6 p-4 sm:p-6 rounded-2xl shadow-lg flex flex-col justify-between space-y-4">
            <div class="space-y-3 text-left">
              <span class="text-[9px] font-bold text-amber-500 uppercase tracking-widest block font-sans">Mesa de Control Central</span>
              <h3 class="text-base sm:text-lg font-black" :class="esModoOscuro ? 'text-white' : 'text-slate-900'">
                Requerimientos Activos
              </h3>
              
              <!-- Círculo Contador Principal -->
              <div class="py-3 flex flex-col items-center justify-center rounded-xl border" :class="esModoOscuro ? 'border-zinc-800 bg-zinc-950/40' : 'border-slate-200 bg-slate-50'">
                <span class="text-4xl font-black text-red-500" :class="estadoPendientes.cantidad > 0 ? 'animate-pulse' : ''">
                  {{ loading ? '...' : estadoPendientes.cantidad }}
                </span>
                <span :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-500'" class="text-[10px] font-bold uppercase tracking-wider mt-1">Pendientes</span>
              </div>

              <div class="space-y-0.5">
                <p class="text-xs font-bold" :class="estadoPendientes.cantidad > 0 ? 'text-amber-500' : (esModoOscuro ? 'text-zinc-300' : 'text-slate-800')">
                  {{ loading ? 'Sincronizando tiempos...' : estadoPendientes.mensaje }}
                </p>
              </div>

              <!-- ⚡ ACCESOS DIRECTOS DETALLADOS -->
              <div v-if="listaTicketsPendientes.length > 0" class="pt-2 border-t" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'">
                <label class="text-[9px] uppercase font-bold text-zinc-500 block mb-1.5 tracking-wider">⚡ ACCESOS DIRECTOS A PENDIENTES:</label>
                <div class="space-y-2 max-h-40 overflow-y-auto pr-1">
                  <div 
                    v-for="ticket in listaTicketsPendientes" 
                    :key="ticket.id"
                    @click="irATicketDirecto(ticket.id)"
                    :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800/80 hover:bg-zinc-850 text-zinc-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'"
                    class="p-3 rounded-xl border text-xs cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left shadow-xs"
                  >
                    <div class="min-w-0 flex-1 space-y-1">
                      <div class="flex items-center space-x-2 truncate">
                        <span class="font-mono font-bold text-red-500">[RLN-{{ ticket.id.substring(0,6).toUpperCase() }}]</span>
                        <span class="font-semibold truncate">{{ ticket.titulo }}</span>
                      </div>
                      
                      <!-- Datos de Origen, Prioridad y Proyecto -->
                      <div class="text-[10px] text-zinc-500 flex flex-wrap gap-1.5 items-center">
                        <span class="bg-zinc-900/40 px-1.5 py-0.5 rounded border border-zinc-800/60">
                          📩 De: <strong :class="esModoOscuro ? 'text-zinc-300' : 'text-slate-700'">{{ ticket.creador?.nombre || ticket.creador?.email || 'Mesa Central' }}</strong>
                        </span>
                        <span v-if="ticket.prioridad" :class="obtenerColorPrioridad(ticket.prioridad)" class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                          {{ ticket.prioridad }}
                        </span>
                        <span v-if="ticket.proyecto" class="bg-blue-950/40 border border-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded text-[9px] font-bold">
                          📁 {{ ticket.proyecto }}
                        </span>
                      </div>
                    </div>
                    <span class="text-[9px] font-bold shrink-0 opacity-70 text-amber-500 self-end sm:self-auto">Gestionar →</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="pt-1">
              <router-link to="/tickets" class="inline-flex w-full justify-center items-center space-x-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border border-zinc-700 transition cursor-pointer">
                <span>👁️ Ver Todo el Historial</span>
              </router-link>
            </div>
          </div>

        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-none::-webkit-scrollbar { display: none; }
.scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
</style>