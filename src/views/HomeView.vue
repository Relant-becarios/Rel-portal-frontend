<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { useQuery } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'

const esModoOscuro = ref(true)
const menuMovilAbierto = ref(false) // 🍔 Control del menú en teléfonos

const OBTENER_USUARIO_LOGUEADO = gql`
  query GetMe {
    me {
      id
      nombre
      email
      rol
    }
  }
`
const { result, loading } = useQuery(OBTENER_USUARIO_LOGUEADO)
</script>

<template>
  <div :class="esModoOscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'" class="flex min-h-screen transition-colors duration-200 relative overflow-x-hidden">
    
    <!-- 📱 SIDEBAR RESPONSIVA: Oculta en celular y fija en laptops/PC -->
    <div :class="[
      menuMovilAbierto ? 'translate-x-0' : '-translate-x-full',
      'lg:translate-x-0 fixed lg:sticky top-0 left-0 h-screen z-50 transition-transform duration-300 ease-in-out shrink-0'
    ]">
      <Sidebar :dark="esModoOscuro" />
    </div>

    <!-- Fondo traslúcido para cerrar el menú en móviles al picar afuera -->
    <div v-if="menuMovilAbierto" @click="menuMovilAbierto = false" class="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-40"></div>

    <div class="flex-1 flex flex-col min-w-0 w-full">
      
      <!-- HEADER RESPONSIVO -->
      <header :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="h-16 border-b px-4 sm:px-8 flex justify-between items-center shrink-0 transition-colors">
        <div class="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <!-- 🍔 Botón Hamburguesa móvil -->
          <button @click="menuMovilAbierto = !menuMovilAbierto" class="lg:hidden p-1.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer mr-1 shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          <span class="text-[10px] sm:text-xs font-black bg-red-700 text-white px-2 py-0.5 rounded-md tracking-wider shrink-0">RELANT HQ</span>
          <h2 class="text-sm sm:text-lg font-black tracking-tight truncate">Portal de Operaciones</h2>
        </div>
        <div class="flex items-center space-x-4">
          <button @click="esModoOscuro = !esModoOscuro" class="px-3 py-1.5 rounded-xl border border-zinc-800 text-xs font-semibold cursor-pointer whitespace-nowrap">
            {{ esModoOscuro ? '☀️ Claro' : '🌙 Oscuro' }}
          </button>
        </div>
      </header>

      <!-- SECCIÓN BIENVENIDA ADAPTADA (PC / CELULAR) -->
      <main class="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div :class="esModoOscuro ? 'from-red-950/40 to-zinc-900 border-zinc-800' : 'from-red-50 to-white border-slate-200'" class="bg-linear-to-b border w-full max-w-2xl p-6 sm:p-10 rounded-3xl shadow-xl text-center space-y-4 sm:space-y-6">
          
          <div class="inline-flex p-3 bg-red-700/10 text-red-500 rounded-2xl border border-red-500/20 text-3xl sm:text-4xl">
            👋
          </div>
          
          <div class="space-y-2">
            <span class="text-[10px] sm:text-xs font-bold text-red-500 uppercase tracking-widest block">Acceso Central Autenticado</span>
            <h1 class="text-2xl sm:text-4xl font-black tracking-tight text-white">
              ¡Hola, <span class="text-red-500">{{ loading ? 'Cargando...' : (result?.me?.nombre || 'Operador') }}</span>!
            </h1>
            <p class="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
              Tienes un canal directo y seguro hacia la Mesa de Ayuda. Monitorea requerimientos, actualiza el progreso en tus folios asignados y coordina en tiempo real.
            </p>
          </div>

          <div class="pt-2">
            <router-link to="/tickets" class="inline-flex w-full sm:w-auto justify-center items-center space-x-2 bg-red-700 hover:bg-red-800 text-white text-xs font-black uppercase tracking-widest px-8 py-3.5 rounded-xl shadow-md transition cursor-pointer">
              <span>🎟️ Ir a Panel de Tickets</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </router-link>
          </div>

        </div>
      </main>
    </div>
  </div>
</template>