<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { useQuery, useMutation } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'
import { useRouter } from 'vue-router'

const router = useRouter()
const esModoOscuro = ref(true)

const nombreUsuario = ref('')
const descripcionUsuario = ref('')
const fotoBase64 = ref('')
const fotoInputRef = ref<HTMLInputElement | null>(null)
const guardando = ref(false)

const toggleTema = () => {
  esModoOscuro.value = !esModoOscuro.value
  localStorage.setItem('relant_theme', esModoOscuro.value ? 'oscuro' : 'claro')
}

const OBTENER_MI_PERFIL = gql`
  query GetMiPerfil {
    me {
      id
      nombre
      email
      rol
      fotoUrl
      descripcion
    }
  }
`

const ACTUALIZAR_PERFIL_MUTATION = gql`
  mutation ActualizarPerfil($nombre: String!, $fotoUrl: String, $descripcion: String) {
    actualizarPerfil(nombre: $nombre, fotoUrl: $fotoUrl, descripcion: $descripcion) {
      id
      nombre
      fotoUrl
      descripcion
    }
  }
`

const { result, loading, refetch } = useQuery(OBTENER_MI_PERFIL)
const { mutate: apiActualizarPerfil } = useMutation(ACTUALIZAR_PERFIL_MUTATION)

const usuario = computed(() => result.value?.me || null)

watch(usuario, (val) => {
  if (val) {
    nombreUsuario.value = val.nombre || ''
    descripcionUsuario.value = val.descripcion || ''
    fotoBase64.value = val.fotoUrl || ''
  }
}, { immediate: true })

onMounted(() => {
  const temaGuardado = localStorage.getItem('relant_theme')
  esModoOscuro.value = temaGuardado ? temaGuardado === 'oscuro' : true
})

const seleccionarFoto = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (file.size > 5 * 1024 * 1024) {
    alert('⚠️ La imagen no debe superar los 5MB.')
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    fotoBase64.value = reader.result as string
  }
  reader.readAsDataURL(file)
}

const quitarFoto = () => {
  fotoBase64.value = ''
  if (fotoInputRef.value) fotoInputRef.value.value = ''
}

const guardarPerfil = async () => {
  if (!nombreUsuario.value.trim()) {
    alert('❌ El nombre no puede estar vacío.')
    return
  }

  guardando.value = true
  try {
    await apiActualizarPerfil({
      nombre: nombreUsuario.value.trim(),
      fotoUrl: fotoBase64.value,
      descripcion: descripcionUsuario.value.trim()
    })
    await refetch()
    alert('✅ ¡Perfil actualizado correctamente!')
  } catch (err: any) {
    alert('Error al guardar el perfil: ' + err.message)
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div :class="esModoOscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'" class="flex min-h-screen font-sans transition-colors duration-200">
    
    <Sidebar :dark="esModoOscuro" />

    <div class="flex-1 flex flex-col min-w-0 w-full relative">
      
      <!-- HEADER CON PERFIL HOMOGÉNEO (TOP-RIGHT) -->
      <header :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="h-16 border-b px-4 sm:px-8 flex items-center justify-between shrink-0">
        <div class="flex items-center space-x-3">
          <span class="text-xs font-black bg-red-700 text-white px-2 py-0.5 rounded-md tracking-wider">RELANT HQ</span>
          <h2 class="text-base sm:text-lg font-black tracking-tight truncate">Configuración de Perfil</h2>
        </div>

        <!-- 👤 TARJETA DE PERFIL (TOP-RIGHT) -->
        <div 
          @click="router.push('/perfil')" 
          :class="esModoOscuro ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800/80 text-white' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800'"
          class="flex items-center space-x-3 px-3 py-1.5 rounded-2xl border cursor-pointer transition-all shadow-sm group"
          title="Ver y Configurar mi Perfil"
        >
          <div class="w-8 h-8 rounded-full overflow-hidden border-2 border-red-600 bg-zinc-800 flex items-center justify-center shrink-0 shadow-sm">
            <img v-if="usuario?.fotoUrl" :src="usuario.fotoUrl" alt="Avatar" class="w-full h-full object-cover" />
            <span v-else class="text-xs font-black text-white">
              {{ usuario?.nombre?.charAt(0).toUpperCase() || '👤' }}
            </span>
          </div>

          <div class="hidden sm:flex flex-col text-left min-w-0">
            <span class="text-xs font-bold truncate group-hover:text-red-500 transition-colors">
              {{ usuario?.nombre || 'Mi Perfil' }}
            </span>
            <span class="text-[9px] font-mono text-emerald-500 font-bold leading-none">
              ● Operador Activo
            </span>
          </div>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 max-w-4xl mx-auto w-full pb-24">
        <div v-if="loading" class="text-center py-20 text-zinc-400 animate-pulse text-sm">👤 Cargando información de perfil...</div>

        <form v-else @submit.prevent="guardarPerfil" :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'" class="rounded-3xl border overflow-hidden p-6 sm:p-8 space-y-8 text-left">
          
          <div class="flex flex-col sm:flex-row items-center gap-6 border-b pb-8" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'">
            <div class="relative group cursor-pointer" @click="fotoInputRef?.click()">
              <div class="w-28 h-28 rounded-full overflow-hidden border-4 border-red-700 bg-zinc-800 flex items-center justify-center shadow-xl">
                <img v-if="fotoBase64" :src="fotoBase64" alt="Foto de Perfil" class="w-full h-full object-cover" />
                <span v-else class="text-4xl font-black text-white">{{ nombreUsuario.charAt(0).toUpperCase() || '👤' }}</span>
              </div>
              <div class="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold">
                📷 Cambiar
              </div>
              <input ref="fotoInputRef" type="file" accept="image/*" class="hidden" @change="seleccionarFoto" />
            </div>

            <div class="text-center sm:text-left space-y-1">
              <h3 class="text-xl font-black">{{ usuario?.nombre }}</h3>
              <p class="text-xs font-mono text-zinc-400">{{ usuario?.email }}</p>
              <span class="inline-block text-[10px] font-bold uppercase tracking-wider bg-red-700/20 text-red-500 border border-red-500/30 px-2.5 py-0.5 rounded-md mt-1">
                ROL: {{ usuario?.rol }}
              </span>
            </div>

            <div v-if="fotoBase64" class="sm:ml-auto">
              <button type="button" @click="quitarFoto" class="text-xs text-red-500 hover:underline font-bold">✕ Eliminar foto</button>
            </div>
          </div>

          <div class="space-y-5">
            <div class="space-y-1.5">
              <label class="text-xs font-bold uppercase tracking-wider" :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-600'">Nombre Completo / Apodo Operativo:</label>
              <input v-model="nombreUsuario" type="text" required :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'" class="w-full p-3.5 text-sm rounded-xl border focus:outline-none font-semibold" placeholder="Ej. Eder Chávez" />
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold uppercase tracking-wider" :class="esModoOscuro ? 'text-zinc-500' : 'text-slate-400'">Correo Electrónico (Protegido):</label>
              <input :value="usuario?.email" type="email" disabled :class="esModoOscuro ? 'bg-zinc-950/50 border-zinc-800/50 text-zinc-500' : 'bg-slate-200/60 border-slate-300 text-slate-500'" class="w-full p-3.5 text-sm rounded-xl border focus:outline-none font-mono cursor-not-allowed" />
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold uppercase tracking-wider" :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-600'">Descripción de Cargo / Presentación:</label>
              <textarea v-model="descripcionUsuario" rows="4" :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'" class="w-full p-3.5 text-sm rounded-xl border focus:outline-none leading-relaxed" placeholder="Escribe una breve descripción de tu rol o especialidad en Relant..."></textarea>
            </div>
          </div>

          <div class="flex justify-end pt-4 border-t" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'">
            <button type="submit" :disabled="guardando" class="w-full sm:w-auto bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-widest px-8 py-3.5 rounded-xl cursor-pointer shadow-md transition-all">
              {{ guardando ? '💾 Guardando...' : 'Guardar Cambios de Perfil' }}
            </button>
          </div>
        </form>
      </main>

      <!-- ☀️/🌙 BOTÓN FLOTANTE (BOTTOM-RIGHT) -->
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