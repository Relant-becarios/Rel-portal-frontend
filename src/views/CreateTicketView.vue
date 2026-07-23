<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { useMutation, useQuery } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'
import { useRouter } from 'vue-router'

const router = useRouter()
const esModoOscuro = ref(true)

// Campos del formulario
const correoDestinatario = ref('')
const prioridadTicket = ref('BAJA')
const proyectoTicket = ref('')
const asuntoTicket = ref('')
const cuerpoTicket = ref('')
const archivoAdjuntoBase64 = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// --- LISTA DE PROYECTOS DESDE GESTOR DE PROYECTOS (FIREBASE) ---
const listaProyectos = ref<string[]>([])
const cargandoProyectos = ref(true)

const cargarProyectosFirebase = async () => {
  try {
    cargandoProyectos.value = true
    const res = await fetch('https://version-1-e3799-default-rtdb.firebaseio.com/projects.json')
    const data = await res.json()
    
    if (data) {
      // 🛡️ FILTRO: Solo incluimos los proyectos cuyo estado NO sea 'completed'
      const nombres = Object.values(data)
        .filter((p: any) => p && p.status !== 'completed') // 👈 Oculta los completados
        .map((p: any) => p.name)
        .filter((nombre: any) => typeof nombre === 'string' && nombre.trim() !== '')
      
      listaProyectos.value = Array.from(new Set(nombres)) // Quitar duplicados
    }
  } catch (err) {
    console.error('Error al consultar proyectos en Firebase:', err)
  } finally {
    cargandoProyectos.value = false
  }
}

// --- VARIABLES DEL AUTOCOMPLETADO INTELIGENTE ---
const mostrarSugerencias = ref(false)

onMounted(() => {
  const temaGuardado = localStorage.getItem('relant_theme')
  if (temaGuardado) {
    esModoOscuro.value = temaGuardado === 'oscuro'
  }
  
  // Cargar proyectos de la Realtime Database al iniciar la vista
  cargarProyectosFirebase()
})

// --- ⚙️ INTERFACES ESTRICTAS DE TYPESCRIPT ---
interface Usuario {
  id: string
  nombre: string
  email: string
}

// --- 🔒 GRAPHQL: TRAER USUARIOS DE LA BASE DE DATOS ---
const OBTENER_TODOS_USUARIOS = gql`
  query GetTodosUsuarios {
    todosUsuarios {
      id
      nombre
      email
    }
  }
`
const { result: usuariosResult } = useQuery<{ todosUsuarios: Usuario[] }>(OBTENER_TODOS_USUARIOS)

// Lógica reactiva para filtrar usuarios en tiempo real conforme escribes
const usuariosSugeridos = computed(() => {
  const query = correoDestinatario.value.trim().toLowerCase()
  if (!query) return []

  const listaCompleta = usuariosResult.value?.todosUsuarios || []
  return listaCompleta.filter((u: Usuario) => 
    u.nombre.toLowerCase().includes(query) || 
    u.email.toLowerCase().includes(query)
  )
})

const seleccionarUsuarioSugerido = (usuario: Usuario) => {
  correoDestinatario.value = usuario.email
  mostrarSugerencias.value = false
}

const ocultarSugerenciasConRetraso = () => {
  setTimeout(() => {
    mostrarSugerencias.value = false
  }, 200)
}

// Procesar el archivo adjunto y pasarlo a texto Base64
const manejarSubidaArchivo = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) {
    archivoAdjuntoBase64.value = null
    return
  }

  if (file.size > 3 * 1024 * 1024) {
    alert('⚠️ El archivo supera el límite de 3MB. Por favor sube una captura o documento más ligero.')
    target.value = ''
    archivoAdjuntoBase64.value = null
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    archivoAdjuntoBase64.value = reader.result as string
  }
  reader.readAsDataURL(file)
}

// Mutación de GraphQL con prioridad y proyecto integrados
const CREAR_TICKET_MUTATION = gql`
  mutation NuevoTicket($titulo: String!, $descripcion: String!, $asignadoEmail: String, $archivo: String, $prioridad: String, $proyecto: String) {
    crearTicket(titulo: $titulo, descripcion: $descripcion, asignadoEmail: $asignadoEmail, archivo: $archivo, prioridad: $prioridad, proyecto: $proyecto) { 
      id 
    }
  }
`
const { mutate: crearTicket } = useMutation(CREAR_TICKET_MUTATION)

const manejarEnviarTicket = async () => {
  if (!asuntoTicket.value || !cuerpoTicket.value) return
  try {
    await crearTicket({ 
      titulo: asuntoTicket.value, 
      descripcion: cuerpoTicket.value,
      asignadoEmail: correoDestinatario.value || null,
      archivo: archivoAdjuntoBase64.value,
      prioridad: prioridadTicket.value,
      proyecto: proyectoTicket.value || null
    })
    
    alert('📧 Requerimiento generado y despachado con éxito.')
    router.push('/tickets')
  } catch (err: unknown) {
    const errorMutation = err as Error
    alert('Error al despachar requerimiento: ' + errorMutation.message)
  }
}
</script>

<template>
  <div :class="esModoOscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'" class="flex min-h-screen transition-colors duration-200 font-sans">
    <Sidebar :dark="esModoOscuro" />
    
    <div class="flex-1 flex flex-col min-w-0">
      <header :class="esModoOscuro ? 'bg-zinc-900 border-red-950/40' : 'bg-white border-slate-200'" class="h-16 border-b px-8 flex justify-between items-center shrink-0 transition-colors">
        <h2 class="text-sm font-black tracking-widest uppercase text-slate-400">Generador de Tareas e Incidencias</h2>
        <button type="button" @click="esModoOscuro = !esModoOscuro" :class="esModoOscuro ? 'bg-zinc-800 text-white' : 'bg-slate-100 text-slate-800'" class="text-xs px-4 py-1.5 rounded-xl font-bold transition">
          {{ esModoOscuro ? '☀️ Modo Claro' : '🌙 Modo Oscuro' }}
        </button>
      </header>

      <main class="flex-1 overflow-y-auto p-8">
        <div :class="esModoOscuro ? 'bg-zinc-900 border-red-950/30' : 'bg-white border-slate-200'" class="max-w-3xl rounded-2xl border shadow-xl overflow-hidden">
          
          <div class="bg-gradient-to-r from-red-900 to-zinc-900 p-4 text-white flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="text-sm">✍️</span>
              <h3 class="text-xs font-black tracking-wider uppercase">Redactar Nuevo Requerimiento Interno</h3>
            </div>
            <span class="text-[9px] font-mono opacity-60">Relant Mail-To-Ticket Protocol</span>
          </div>

          <form @submit.prevent="manejarEnviarTicket" class="p-6 space-y-4 text-left">
            
            <!-- 👤 INPUT PARA DESTINATARIO -->
            <div class="flex items-center border-b pb-2 relative" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-100'">
              <label class="w-20 text-xs font-bold text-slate-400 uppercase tracking-wider">Para:</label>
              <div class="flex-1 relative">
                <input 
                  v-model="correoDestinatario" 
                  type="text" 
                  @focus="mostrarSugerencias = true"
                  @blur="ocultarSugerenciasConRetraso"
                  :class="esModoOscuro ? 'bg-transparent text-white placeholder-zinc-600' : 'bg-transparent text-slate-900 placeholder-slate-400'" 
                  class="w-full text-sm focus:outline-none" 
                  placeholder="empleado@relant.com o Nombre (O dejas vacío para Mesa General)" 
                />
                
                <div 
                  v-if="mostrarSugerencias && usuariosSugeridos.length > 0"
                  :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800 text-white divide-zinc-800' : 'bg-white border-slate-200 text-slate-800 divide-slate-100'"
                  class="absolute left-0 right-0 top-full mt-1 border rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50 divide-y"
                >
                  <div 
                    v-for="usuario in usuariosSugeridos" 
                    :key="usuario.id"
                    @mousedown="seleccionarUsuarioSugerido(usuario)"
                    :class="esModoOscuro ? 'hover:bg-zinc-800/60' : 'hover:bg-slate-100'"
                    class="p-2.5 text-xs cursor-pointer transition-colors flex flex-col text-left"
                  >
                    <span class="font-bold">{{ usuario.nombre }}</span>
                    <span :class="esModoOscuro ? 'text-zinc-500' : 'text-slate-400'" class="text-[10px] font-mono mt-0.5">{{ usuario.email }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 🎯 SELECCIÓN DE PRIORIDAD Y PROYECTO (DESPLEGABLE DE FIREBASE) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b pb-3" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-100'">
              <div class="flex items-center">
                <label class="w-20 text-xs font-bold text-slate-400 uppercase tracking-wider">Prioridad:</label>
                <select 
                  v-model="prioridadTicket" 
                  :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'" 
                  class="flex-1 text-xs p-2.5 rounded-xl border focus:outline-none cursor-pointer font-bold"
                >
                  <option value="BAJA">🟢 BAJA</option>
                  <option value="MEDIA">🔵 MEDIA</option>
                  <option value="ALTA">🟡 ALTA</option>
                  <option value="CRITICA">🔴 CRÍTICA</option>
                </select>
              </div>

              <div class="flex items-center">
                <label class="w-20 text-xs font-bold text-slate-400 uppercase tracking-wider">Proyecto:</label>
                <select 
                  v-model="proyectoTicket" 
                  :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'" 
                  class="flex-1 text-xs p-2.5 rounded-xl border focus:outline-none cursor-pointer font-bold truncate"
                >
                  <option value="">📂 General / Sin Proyecto</option>
                  <option v-if="cargandoProyectos" disabled>⏳ Cargando proyectos...</option>
                  <option v-else v-for="nombreProj in listaProyectos" :key="nombreProj" :value="nombreProj">
                    📁 {{ nombreProj }}
                  </option>
                </select>
              </div>
            </div>

            <!-- 🎟️ ASUNTO DEL TICKET (HITO) -->
            <div class="flex items-center border-b pb-2" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-100'">
              <label class="w-20 text-xs font-bold text-slate-400 uppercase tracking-wider">Asunto:</label>
              <input 
                v-model="asuntoTicket" 
                type="text" 
                required
                :class="esModoOscuro ? 'bg-transparent text-white placeholder-zinc-600' : 'bg-transparent text-slate-900'" 
                class="w-full text-sm font-bold focus:outline-none" 
                placeholder="Título del hito o incidencia a resolver..." 
              />
            </div>

            <!-- 📎 ARCHIVO ADJUNTO -->
            <div class="flex items-center border-b pb-3" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-100'">
              <label class="w-20 text-xs font-bold text-slate-400 uppercase tracking-wider">Adjunto:</label>
              <input 
                type="file" 
                ref="fileInputRef" 
                @change="manejarSubidaArchivo" 
                accept="image/*,.pdf,.doc,.docx" 
                class="text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700 cursor-pointer w-full" 
              />
            </div>

            <div class="pt-2">
              <textarea 
                v-model="cuerpoTicket" 
                rows="6" 
                required
                :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white placeholder-zinc-600' : 'bg-slate-50 border-slate-200'" 
                class="w-full p-4 text-sm rounded-xl border focus:outline-none focus:border-red-900/50 transition leading-relaxed" 
                placeholder="Escribe aquí las especificaciones detalladas de la tarea..."
              ></textarea>
            </div>

            <div class="flex justify-between items-center pt-4 border-t" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-100'">
              <span class="text-[10px] text-slate-400 font-medium">🔒 Sincronización en tiempo real habilitada</span>
              <div class="flex space-x-2">
                <button type="button" @click="router.push('/tickets')" class="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer">Descartar</button>
                <button type="submit" class="bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl shadow-lg transition cursor-pointer">Enviar Requerimiento</button>
              </div>
            </div>
          </form>

        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
.animate-fadeIn {
  animation: fadeIn 0.15s ease-out forwards;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>