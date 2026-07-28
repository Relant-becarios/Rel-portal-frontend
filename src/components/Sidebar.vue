<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { auth } from '../firebase'
import { signOut } from 'firebase/auth'
import { apolloClient } from '../main'

defineProps<{ dark?: boolean }>()

const router = useRouter()
const route = useRoute()

// 🍔 Estado colapsado / desplegado del menú
const colapsado = ref(false)

const toggleColapsar = () => {
  colapsado.value = !colapsado.value
}

const cerrarSesion = async () => {
  try {
    await apolloClient.clearStore()
    await signOut(auth)
    router.push('/login')
  } catch (error) {
    console.error('Error al cerrar sesión:', error)
  }
}
</script>

<template>
  <aside 
    :class="[
      colapsado ? 'w-20' : 'w-64',
      'bg-zinc-900 border-zinc-800 text-zinc-100 h-screen border-r flex flex-col justify-between p-4 shrink-0 select-none font-sans transition-all duration-300 relative'
    ]"
  >
    <div class="space-y-6">
      
      <!-- Encabezado con Botón Hamburguesa -->
      <div class="flex items-center justify-between px-2 pt-2">
        <div v-if="!colapsado" class="flex items-center space-x-3 truncate">
          <div class="w-8 h-8 bg-red-700 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-md shrink-0">
            R
          </div>
          <span class="font-black tracking-tight text-base truncate">Relant Portal</span>
        </div>

        <!-- 🍔 BOTÓN HAMBURGUESA -->
        <button 
          @click="toggleColapsar" 
          class="p-2 rounded-xl transition cursor-pointer hover:bg-zinc-800 text-zinc-400 hover:text-white shrink-0 mx-auto"
          title="Colapsar / Desplegar menú"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>
      </div>

      <!-- Menú de Navegación -->
      <nav class="space-y-1.5">
        <router-link 
          to="/home" 
          class="flex items-center space-x-3 px-4 py-3 rounded-xl transition text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/80"
          active-class="bg-red-700 !text-white font-black shadow-lg"
          :title="colapsado ? 'Inicio' : ''"
        >
          <span class="text-base shrink-0">🏠</span>
          <span v-if="!colapsado" class="truncate">Inicio</span>
        </router-link>

        <router-link 
          to="/tickets" 
          class="flex items-center space-x-3 px-4 py-3 rounded-xl transition text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/80"
          active-class="bg-red-700 !text-white font-black shadow-lg"
          :title="colapsado ? 'Tickets' : ''"
        >
          <span class="text-base shrink-0">🎫</span>
          <span v-if="!colapsado" class="truncate">Tickets</span>
        </router-link>

        <a 
          href="https://relantapi.netlify.app/" 
          target="_blank" 
          rel="noopener noreferrer"
          class="flex items-center space-x-3 px-4 py-3 rounded-xl transition text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/80"
          :title="colapsado ? 'Gestor de proyectos' : ''"
        >
          <span class="text-base shrink-0">🌐</span>
          <span v-if="!colapsado" class="flex-1 truncate">Gestor de proyectos</span>
          <span v-if="!colapsado" class="text-[9px] bg-red-950/80 border border-red-900/60 text-red-400 px-1.5 py-0.5 rounded font-mono shrink-0">EXT ↗</span>
        </a>

        <router-link 
          to="/graficas" 
          class="flex items-center space-x-3 px-4 py-3 rounded-xl transition text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/80"
          active-class="bg-red-700 !text-white font-black shadow-lg"
          :title="colapsado ? 'Métricas y Gráficas' : ''"
        >
          <span class="text-base shrink-0">📊</span>
          <span v-if="!colapsado" class="truncate">Métricas y Gráficas</span>
        </router-link>
      </nav>
    </div>

    <!-- Desconectar -->
    <div class="space-y-3 border-t border-zinc-800 pt-4">
      <button 
        @click="cerrarSesion"
        class="w-full py-2.5 px-4 rounded-xl text-xs font-bold transition cursor-pointer text-center bg-zinc-800/50 hover:bg-red-950/40 text-zinc-400 hover:text-red-400"
        :title="colapsado ? 'Desconectar Sistema' : ''"
      >
        <span v-if="!colapsado">Desconectar Sistema</span>
        <span v-else>🚪</span>
      </button>
    </div>

  </aside>
</template>