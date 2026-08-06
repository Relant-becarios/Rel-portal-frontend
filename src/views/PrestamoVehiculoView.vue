<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const esModoOscuro = ref(true)

const toggleTema = () => {
  esModoOscuro.value = !esModoOscuro.value
  localStorage.setItem('relant_theme', esModoOscuro.value ? 'oscuro' : 'claro')
}

onMounted(() => {
  const temaGuardado = localStorage.getItem('relant_theme')
  esModoOscuro.value = temaGuardado ? temaGuardado === 'oscuro' : true
})
</script>

<template>
  <div :class="esModoOscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'" class="flex h-screen overflow-hidden transition-colors duration-200 font-sans">
    
    <Sidebar :dark="esModoOscuro" />

    <div class="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
      
      <!-- HEADER -->
      <header :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="h-16 border-b px-4 sm:px-8 flex justify-between items-center shrink-0">
        <div class="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <span class="text-[10px] sm:text-xs font-black bg-red-700 text-white px-2 py-0.5 rounded-md tracking-wider">RELANT HQ</span>
          <h2 class="text-sm sm:text-lg font-black tracking-tight truncate">Préstamo de Vehículos</h2>
        </div>
      </header>

      <!-- ÁREA PRINCIPAL CENTRADA CON EL BLOQUE "PROXIMAMENTE" -->
      <main class="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
        
        <div 
          :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-800 shadow-xl'" 
          class="max-w-lg w-full border rounded-3xl p-8 sm:p-12 text-center space-y-6 relative overflow-hidden"
        >
          <!-- Banner Decorativo Superior -->
          <div class="absolute top-0 left-0 right-0 h-2 bg-linear-to-r from-red-700 via-orange-600 to-red-900"></div>

          <!-- Icono / Ilustración -->
          <div class="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center mx-auto text-4xl shadow-inner">
            🚗
          </div>

          <!-- Títulos y Etiqueta -->
          <div class="space-y-2">
            <span class="inline-block text-[10px] font-black uppercase tracking-widest bg-red-700/20 text-red-500 border border-red-500/30 px-3 py-1 rounded-full">
              🚧 Módulo en Desarrollo
            </span>
            <h3 class="text-2xl sm:text-3xl font-black tracking-tight pt-1">
              Próximamente
            </h3>
            <p class="text-xs sm:text-sm text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Estamos trabajando en este apartado. Muy pronto podrás solicitar, agendar y gestionar el préstamo de vehículos de la flota de la empresa desde aquí.
            </p>
          </div>

          <!-- Botón para regresar a tickets -->
          <div class="pt-4">
            <button 
              @click="router.push('/tickets')" 
              class="bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-widest px-8 py-3.5 rounded-xl cursor-pointer shadow-lg transition-all hover:scale-105"
            >
              ⬅️ Volver a Tickets
            </button>
          </div>

        </div>

      </main>

      <!-- ☀️/🌙 BOTÓN FLOTANTE DE TEMA -->
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