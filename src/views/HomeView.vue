<script setup lang="ts">
import { ref, computed } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { auth } from '../firebase'
import { useQuery } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'

const esModoOscuro = ref(true)
const nombreUsuario = auth.currentUser?.email?.split('@')[0] || 'Colaborador'

// --- CONNECTAMOS GRAPHQL AL HOME PARA ANALIZAR TUS DATOS EN TIEMPO REAL ---
const OBTENER_TICKETS_HOME = gql`
  query GetTicketsHome {
    misTickets {
      id
      estado
    }
  }
`
const { result, loading } = useQuery(OBTENER_TICKETS_HOME)

// Calculamos cuántos tickets tiene pendientes este usuario para personalizar el saludo
const ticketsPendientes = computed(() => {
  return result.value?.misTickets?.filter((t: any) => t.estado === 'RECIBIDO' || t.estado === 'TRABAJANDO').length || 0
})

const comunicados = [
  { id: 1, categoria: '🔴 URGENTE', titulo: 'Actualización de Seguridad', texto: 'Se implementó el doble factor de autenticación obligatorio. Actualizar credenciales inmediatamente.', fecha: 'Hoy' },
  { id: 2, categoria: '⚙️ INFRAESTRUCTURA', titulo: 'Mantenimiento Marketplace', texto: 'El portal de compras estará fuera de servicio este viernes por migración de nodos en PostgreSQL a las 23:00 hrs.', fecha: 'Ayer' }
]
</script>

<template>
  <div :class="esModoOscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'" class="flex min-h-screen transition-colors duration-200">
    <Sidebar :dark="esModoOscuro" />

    <div class="flex-1 flex flex-col min-w-0">
      <header :class="esModoOscuro ? 'bg-zinc-900 border-red-950/40' : 'bg-white border-slate-200'" class="h-16 border-b px-8 flex justify-between items-center transition-colors shrink-0">
        <div class="flex items-center space-x-2.5">
          <span class="w-2.5 h-2.5 rounded-full bg-red-700 animate-pulse"></span>
          <h2 class="text-sm font-black tracking-widest uppercase text-slate-400">Relant Operations Hub</h2>
        </div>
        <button @click="esModoOscuro = !esModoOscuro" :class="esModoOscuro ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-slate-100 text-slate-800'" class="text-xs px-4 py-1.5 rounded-xl font-bold transition cursor-pointer select-none">
          {{ esModoOscuro ? '☀️ Interfaz Clara' : '🌙 Interfaz Oscura' }}
        </button>
      </header>

      <main class="p-8 space-y-8 overflow-y-auto flex-1">
        
        <section class="relative bg-linear-to-br from-red-800 via-red-900 to-zinc-950 rounded-3xl p-10 overflow-hidden shadow-2xl shadow-slate-950/20 text-white">
          <div class="relative z-10 max-w-2xl space-y-3">
            <span class="text-[10px] font-black tracking-widest bg-white/20 px-2.5 py-1 rounded-md uppercase">Consola de Mando Central</span>
            <h1 class="text-4xl font-black tracking-tight">¡Hola, {{ nombreUsuario }}! 👋</h1>
            
            <p v-if="loading" class="text-red-200 text-sm animate-pulse">Sincronizando estatus de tus asignaciones operativas...</p>
            <p v-else-if="ticketsPendientes > 0" class="text-red-200 text-base leading-relaxed">
              Tienes <strong class="text-white underline decoration-red-400 decoration-2">{{ ticketsPendientes }} requerimientos operativos activos</strong> en tu Mesa de Ayuda esperando atención técnica. Revisa los folios para mantener los tiempos de SLA en rango óptimo.
            </p>
            <p v-else class="text-red-200 text-base leading-relaxed">
              ✨ <strong class="text-white underline decoration-emerald-400 decoration-2">¡Mesa de control despejada!</strong> No tienes folios pendientes asignados en este momento. Buen trabajo manteniendo la eficiencia operacional de Relant.
            </p>

            <div class="mt-6 flex flex-wrap gap-3 pt-2">
              <router-link to="/tickets" class="bg-white text-red-800 hover:bg-slate-100 px-6 py-2.5 rounded-xl font-bold text-xs shadow-xl transition text-center">
                📊 Abrir Mesa de Ayuda
              </router-link>
              <button class="bg-red-950/20 hover:bg-red-950/30 border border-red-900/10 px-6 py-2.5 rounded-xl font-bold text-xs transition cursor-not-allowed select-none text-red-300/60 text-center">
                🛒 Marketplace de Insumos (Próximamente)
              </button>
            </div>
          </div>
          <div class="absolute -right-20 -top-20 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>
          <div class="absolute -right-10 -bottom-10 w-60 h-60 bg-red-950/10 rounded-full blur-2xl"></div>
        </section>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div class="lg:col-span-2 space-y-4">
            <h3 class="text-sm font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">📢 Comunicados de Intranet</h3>
            <div class="space-y-4">
              <div v-for="item in comunicados" :key="item.id" 
                   :class="esModoOscuro ? 'bg-zinc-900 border-red-950/40' : 'bg-white border-slate-200'"
                   class="p-6 rounded-2xl border transition hover:border-red-900/40 cursor-pointer">
                <div class="flex flex-wrap justify-between items-center gap-2 mb-2.5">
                  <div class="flex items-center space-x-2 text-xs">
                    <span class="font-mono text-[10px] font-bold bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-md border border-red-950">{{ item.categoria }}</span>
                    <h4 :class="esModoOscuro ? 'text-white' : 'text-slate-900'" class="font-extrabold text-base tracking-tight">{{ item.titulo }}</h4>
                  </div>
                  <span class="text-[10px] uppercase font-black text-slate-500 tracking-widest">{{ item.fecha }}</span>
                </div>
                <p :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-600'" class="text-sm leading-relaxed">{{ item.texto }}</p>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <h3 class="text-sm font-black text-slate-400 uppercase tracking-wider">🖥️ Core Infrastructure</h3>
            
            <div :class="esModoOscuro ? 'bg-zinc-900 border-red-950/40' : 'bg-white border-slate-200'" class="p-6 rounded-2xl border space-y-5 transition-colors">
              <div v-for="service in [
                { name: 'PostgreSQL Database Cluster', status: 'Online', meta: 'Uptime: 99.99%', color: 'bg-emerald-500 shadow-emerald-500/50' },
                { name: 'Firebase Auth & Security Link', status: 'Online', meta: 'Ping: 12ms', color: 'bg-emerald-500 shadow-emerald-500/50' },
                { name: 'Relant Marketplace API', status: 'Mantenimiento', meta: 'Despliegue v1.2', color: 'bg-amber-500 shadow-amber-500/50' }
              ]" :key="service.name" class="flex items-center justify-between border-b last:border-0 pb-3 last:pb-0 border-zinc-800/40">
                <div>
                  <p :class="esModoOscuro ? 'text-zinc-200' : 'text-slate-800'" class="text-xs font-bold">{{ service.name }}</p>
                  <p class="text-[10px] text-zinc-400 font-semibold mt-0.5">{{ service.meta }}</p>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="text-[9px] font-black uppercase tracking-wider text-slate-500">{{ service.status }}</span>
                  <div :class="service.color" class="w-2 h-2 rounded-full shadow-[0_0_8px]"></div>
                </div>
              </div>
            </div>
            
            <div class="bg-linear-to-br from-zinc-900 to-zinc-950 rounded-2xl p-6 border border-red-900/15 text-center space-y-3.5 shadow-lg shadow-slate-950/50">
              <div class="w-10 h-10 bg-red-700/10 border border-red-900/20 text-red-400 rounded-xl flex items-center justify-center text-lg mx-auto shadow-xs">🛒</div>
              <div>
                <h4 class="font-bold text-sm text-white tracking-tight">Relant Marketplace</h4>
                <p class="text-[11px] text-zinc-400 mt-1 px-4 leading-relaxed">Adquiere insumos, equipos de cómputo y licencias de forma automatizada y con cargo directo al departamento.</p>
              </div>
              <div class="space-y-1 pt-1">
                <div class="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div class="bg-red-700 w-[65%] h-full transition-all duration-1000"></div>
                </div>
                <div class="flex justify-between text-[9px] font-black text-red-400 uppercase tracking-widest px-0.5">
                  <span>Core dev</span>
                  <span>65% completado</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  </div>
</template>