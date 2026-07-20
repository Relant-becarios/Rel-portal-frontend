<script setup lang="ts">
import { auth } from '../firebase'
import { signOut } from 'firebase/auth'
import { useRouter, useRoute } from 'vue-router'

defineProps<{
  dark: boolean
}>()

const router = useRouter()
const route = useRoute()

const manejarCerrarSesion = async () => {
  await signOut(auth)
  router.push('/login')
}
</script>

<template>
  <aside :class="dark ? 'bg-zinc-900 border-red-950/50 text-zinc-400' : 'bg-white border-slate-200 text-slate-500'" 
         class="w-64 flex flex-col justify-between shrink-0 border-r transition-colors duration-200">
    <div>
      <div :class="dark ? 'border-red-950/30 bg-zinc-950/40' : 'border-slate-100 bg-slate-50/50'" class="h-16 flex items-center px-6 border-b">
        <div class="w-7 h-7 bg-red-700 rounded-lg flex items-center justify-center text-white font-black text-sm mr-3">R</div>
        <span :class="dark ? 'text-white' : 'text-slate-800'" class="font-bold text-base tracking-wide">Relant Portal</span>
      </div>
      
      <nav class="p-4 space-y-1">
        <router-link to="/home" 
          :class="route.path === '/home' 
            ? 'bg-red-700 text-white font-semibold shadow-md shadow-red-700/10' 
            : (dark ? 'hover:bg-zinc-800 hover:text-white' : 'hover:bg-slate-100 text-slate-700')" 
          class="flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm transition font-medium">
          <span>🏠</span> <span>Inicio</span>
        </router-link>
        
        <router-link to="/tickets" 
          :class="route.path === '/tickets' 
            ? 'bg-red-700 text-white font-semibold shadow-md shadow-red-700/10' 
            : (dark ? 'hover:bg-zinc-800 hover:text-white' : 'hover:bg-slate-100 text-slate-700')" 
          class="flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm transition font-medium">
          <span>🎫</span> <span>Tickets</span>
        </router-link>
      </nav>
    </div>

    <!-- 🌐 ACCESO EXTERNO A RELANT API -->
<a 
  href="https://relantapi.netlify.app/" 
  target="_blank" 
  rel="noopener noreferrer"
  class="flex items-center space-x-3 px-4 py-3 rounded-xl transition text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/80 group"
>
  <span class="text-base group-hover:scale-110 transition-transform">🌐</span>
  <span>Relant API</span>
  <span class="text-[9px] bg-red-950 border border-red-900 text-red-400 px-1.5 py-0.5 rounded font-mono ml-auto">
    EXT ↗
  </span>
</a>
    
    <div :class="dark ? 'border-red-950/30 bg-zinc-950/20' : 'border-slate-100 bg-slate-50/50'" class="p-4 border-t flex flex-col space-y-3">
      <div class="flex items-center space-x-3">
        <div class="w-9 h-9 rounded-lg bg-red-700/10 text-red-400 flex items-center justify-center font-bold text-sm border border-red-700/20 uppercase">
          {{ auth.currentUser?.email?.substring(0,2) }}
        </div>
        <div class="truncate max-w-37.5">
          <p :class="dark ? 'text-white' : 'text-slate-800'" class="text-xs font-semibold truncate">{{ auth.currentUser?.email }}</p>
          <p class="text-[10px] text-red-400 font-bold uppercase tracking-wider">Operador Activo</p>
        </div>
      </div>
      <button @click="manejarCerrarSesion" :class="dark ? 'bg-zinc-800 text-zinc-300 hover:bg-red-950 hover:text-red-400' : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600'" class="w-full text-xs font-bold py-2 rounded-lg transition text-center cursor-pointer">
        Desconectar Sistema
      </button>
    </div>
  </aside>
</template>