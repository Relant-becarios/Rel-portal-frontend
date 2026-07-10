<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { useQuery } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'

const esModoOscuro = ref(true)
const menuMovilAbierto = ref(false) // 🍔 Control del menú en teléfonos

// ☀️/🌙 Recuperar y recordar el tema seleccionado por el usuario en localStorage
onMounted(() => {
  const temaGuardado = localStorage.getItem('relant_theme')
  if (temaGuardado) {
    esModoOscuro.value = temaGuardado === 'oscuro'
  } else {
    esModoOscuro.value = true
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

// 🔒 OBTENER DATOS DEL HOME (Usuario y Tickets para contar pendientes)
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
      estado
      fecha_recibido
      creadorId
      asignadoId
    }
  }
`
const { result, loading } = useQuery(OBTENER_DATOS_HOME)

// ⏱️ Lógica inteligente para calcular el estatus y el tiempo del pendiente más antiguo
const estadoPendientes = computed(() => {
  const tickets = result.value?.misTickets || []
  const miIdPrisma = result.value?.me?.id || ''
  const soyAdmin = result.value?.me?.rol === 'ADMIN'

  let filtrados = [...tickets]

  // Filtro de privacidad operacional
  if (!soyAdmin) {
    filtrados = filtrados.filter((t: any) => t.asignadoId === miIdPrisma || t.creadorId === miIdPrisma)
  }

  // Los pendientes son los que están en RECIBIDO o TRABAJANDO
  const pendientes = filtrados.filter((t: any) => t.estado === 'RECIBIDO' || t.estado === 'TRABAJANDO')
  
  if (pendientes.length === 0) {
    return {
      cantidad: 0,
      mensaje: 'Hoy no tienes pendientes operacionales.',
      detalle: '¡Excelente! Tienes la mesa limpia y todo está al día.'
    }
  }

  // Encontrar el ticket pendiente más antiguo en la base de datos
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

  // Formatear el tiempo de espera de forma natural
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
    mensaje: `Tienes pendientes acumulados desde hace ${tiempoTexto}.`,
    detalle: `Actualmente hay ${pendientes.length} requerimiento(s) activo(s) esperando atención.`
  }
})
</script>

<template>
  <div :class="esModoOscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'" class="flex min-h-screen transition-colors duration-200 relative overflow-x-hidden">
    
    <!-- 📱 SIDEBAR RESPONSIVA -->
    <div :class="[
      menuMovilAbierto ? 'translate-x-0' : '-translate-x-full',
      'lg:translate-x-0 fixed lg:sticky top-0 left-0 h-screen z-50 transition-transform duration-300 ease-in-out shrink-0'
    ]">
      <Sidebar :dark="esModoOscuro" />
    </div>

    <!-- Fondo traslúcido para móviles -->
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

      <!-- SECCIÓN BIENVENIDA MULTI-DISPOSITIVO (PC / LAP / CELULAR) -->
      <main class="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 w-full max-w-5xl">
          
          <!-- 🏠 Tarjeta Izquierda: Bienvenida -->
          <div :class="esModoOscuro ? 'from-red-950/40 to-zinc-900 border-zinc-800' : 'from-red-50/50 to-white border-slate-200'" class="bg-linear-to-b border lg:col-span-7 p-6 sm:p-10 rounded-3xl shadow-xl flex flex-col justify-between space-y-6">
            <div class="space-y-4">
              <div class="inline-flex p-3 bg-red-700/10 text-red-500 rounded-2xl border border-red-500/20 text-3xl sm:text-4xl">
                👋
              </div>
              
              <div class="space-y-2 text-left">
                <span class="text-[10px] sm:text-xs font-bold text-red-500 uppercase tracking-widest block">Acceso Central Autenticado</span>
                <h1 class="text-2xl sm:text-4xl font-black tracking-tight" :class="esModoOscuro ? 'text-white' : 'text-slate-900'">
                  ¡Hola, <span class="text-red-500">{{ loading ? 'Cargando...' : (result?.me?.nombre || 'Operador') }}</span>!
                </h1>
                <p :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-600'" class="text-xs sm:text-sm leading-relaxed">
                  Tienes un canal directo y seguro hacia la Mesa de Ayuda. Monitorea requerimientos, actualiza el progreso en tus folios asignados y coordina en tiempo real.
                </p>
              </div>
            </div>

            <div class="pt-2 text-left">
              <router-link to="/tickets" class="inline-flex w-full sm:w-auto justify-center items-center space-x-2 bg-red-700 hover:bg-red-800 text-white text-xs font-black uppercase tracking-widest px-8 py-3.5 rounded-xl shadow-md transition cursor-pointer">
                <span>🎟️ Ir a Panel de Tickets</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
              </router-link>
            </div>
          </div>

          <!-- ⏳ Tarjeta Derecha: Requerimientos Activos (Pendientes con tiempo real) -->
          <div :class="esModoOscuro ? 'from-zinc-900 to-zinc-950 border-zinc-800' : 'from-slate-100/50 to-white border-slate-200'" class="bg-linear-to-b border lg:col-span-5 p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col justify-between space-y-6">
            <div class="space-y-4 text-left">
              <span class="text-[10px] sm:text-xs font-bold text-amber-500 uppercase tracking-widest block font-sans">Mesa de Control Central</span>
              <h3 class="text-lg sm:text-xl font-black" :class="esModoOscuro ? 'text-white' : 'text-slate-900'">
                Requerimientos Activos
              </h3>
              
              <!-- Círculo Contador de Pendientes -->
              <div class="py-5 flex flex-col items-center justify-center rounded-2xl border" :class="esModoOscuro ? 'border-zinc-800 bg-zinc-950/40' : 'border-slate-200 bg-slate-50'">
                <span class="text-5xl sm:text-6xl font-black text-red-500" :class="estadoPendientes.cantidad > 0 ? 'animate-pulse' : ''">
                  {{ loading ? '...' : estadoPendientes.cantidad }}
                </span>
                <span :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-500'" class="text-xs font-bold uppercase tracking-wider mt-2">Pendientes</span>
              </div>

              <div class="space-y-1">
                <!-- 💬 MENSAJE REQUERIDO POR EL USUARIO (TIEMPO DE ESPERA EN VIVO) -->
                <p class="text-xs sm:text-sm font-bold" :class="estadoPendientes.cantidad > 0 ? 'text-amber-500' : (esModoOscuro ? 'text-zinc-300' : 'text-slate-800')">
                  {{ loading ? 'Sincronizando tiempos...' : estadoPendientes.mensaje }}
                </p>
                <p :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-500'" class="text-[11px] sm:text-xs leading-relaxed">
                  {{ estadoPendientes.detalle }}
                </p>
              </div>
            </div>

            <div class="pt-2">
              <router-link to="/tickets" class="inline-flex w-full justify-center items-center space-x-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black uppercase tracking-widest px-6 py-3.5 rounded-xl border border-zinc-700 transition cursor-pointer">
                <span>⚡ Ver Mis Pendientes</span>
              </router-link>
            </div>
          </div>

        </div>
      </main>
    </div>
  </div>
</template>