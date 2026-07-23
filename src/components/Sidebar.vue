<script setup lang="ts">
import { useRouter } from 'vue-router'
import { auth } from '../firebase'
import { signOut } from 'firebase/auth'

defineProps<{
  dark?: boolean
}>()

const router = useRouter()
const usuarioActual = auth.currentUser

const cerrarSesion = async () => {
  try {
    await signOut(auth)
    router.push('/login')
  } catch (error) {
    console.error('Error al cerrar sesión:', error)
  }
}
</script>

<template>
  <aside 
    :class="dark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-800'"
    class="w-64 h-screen border-r flex flex-col justify-between p-4 shrink-0 select-none font-sans"
  >
    <!-- 🔝 SECCIÓN SUPERIOR: LOGO Y BOTONES -->
    <div class="space-y-6">
      
      <!-- Logo Relant -->
      <div class="flex items-center space-x-3 px-2 pt-2">
        <div class="w-8 h-8 bg-red-700 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-md">
          R
        </div>
        <span class="font-black tracking-tight text-base">Relant Portal</span>
      </div>

      <!-- 📂 MENÚ DE NAVEGACIÓN -->
      <nav class="space-y-1.5">
        <router-link 
          to="/home" 
          class="flex items-center space-x-3 px-4 py-3 rounded-xl transition text-xs font-bold"
          :class="dark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/80' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'"
          active-class="bg-red-700 !text-white font-black shadow-lg"
        >
          <span class="text-base">🏠</span>
          <span>Inicio</span>
        </router-link>

        <router-link 
          to="/tickets" 
          class="flex items-center space-x-3 px-4 py-3 rounded-xl transition text-xs font-bold"
          :class="dark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/80' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'"
          active-class="bg-red-700 !text-white font-black shadow-lg"
        >
          <span class="text-base">🎫</span>
          <span>Tickets</span>
        </router-link>

        <a 
          href="https://relantapi.netlify.app/" 
          target="_blank" 
          rel="noopener noreferrer"
          class="flex items-center space-x-3 px-4 py-3 rounded-xl transition text-xs font-bold"
          :class="dark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/80' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'"
        >
          <span class="text-base">🌐</span>
          <span class="flex-1">Relant API</span>
          <span class="text-[9px] bg-red-950/80 border border-red-900/60 text-red-400 px-1.5 py-0.5 rounded font-mono">EXT ↗</span>
        </a>
      </nav>
    </div>

    <!-- 🔻 SECCIÓN INFERIOR: USUARIO Y CERRAR SESIÓN -->
    <div class="space-y-3 border-t pt-4" :class="dark ? 'border-zinc-800' : 'border-slate-100'">
      <div class="flex items-center space-x-3 p-2 rounded-xl" :class="dark ? 'bg-zinc-950/60 border border-zinc-800/80' : 'bg-slate-50 border border-slate-200'">
        <div class="w-8 h-8 rounded-lg bg-red-950/80 border border-red-900/60 text-red-400 flex items-center justify-center text-xs font-black shrink-0">
          {{ usuarioActual?.email ? usuarioActual.email.substring(0, 2).toUpperCase() : 'OP' }}
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-[11px] font-bold truncate" :class="dark ? 'text-zinc-200' : 'text-slate-800'" :title="usuarioActual?.email || ''">
            {{ usuarioActual?.email || 'operador@relant.com' }}
          </p>
          <span class="text-[9px] font-black uppercase text-red-500 tracking-wider block">OPERADOR ACTIVO</span>
        </div>
      </div>

      <button 
        @click="cerrarSesion"
        class="w-full py-2.5 px-4 rounded-xl text-xs font-bold transition cursor-pointer text-center"
        :class="dark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'"
      >
        Desconectar Sistema
      </button>
    </div>

  </aside>
</template>