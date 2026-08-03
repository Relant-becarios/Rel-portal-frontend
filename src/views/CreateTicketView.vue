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
const listaArchivosBase64 = ref<{ nombre: string; data: string }[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)

// Lista de proyectos de Firebase
const listaProyectos = ref<string[]>([])
const cargandoProyectos = ref(true)

const cargarProyectosFirebase = async () => {
  try {
    cargandoProyectos.value = true
    const res = await fetch('https://version-1-e3799-default-rtdb.firebaseio.com/projects.json')
    const data = await res.json()
    
    if (data) {
      const nombres = Object.values(data)
        .filter((p: any) => p && p.status !== 'completed')
        .map((p: any) => p.name)
        .filter((nombre: any) => typeof nombre === 'string' && nombre.trim() !== '')
      
      listaProyectos.value = Array.from(new Set(nombres))
    }
  } catch (err) {
    console.error('Error al consultar proyectos en Firebase:', err)
  } finally {
    cargandoProyectos.value = false
  }
}

const mostrarSugerencias = ref(false)

onMounted(() => {
  const temaGuardado = localStorage.getItem('relant_theme')
  if (temaGuardado) esModoOscuro.value = temaGuardado === 'oscuro'
  cargarProyectosFirebase()
})

interface Usuario { id: string; nombre: string; email: string }

const OBTENER_TODOS_USUARIOS = gql`
  query GetTodosUsuarios {
    todosUsuarios { id nombre email }
  }
`
const { result: usuariosResult } = useQuery<{ todosUsuarios: Usuario[] }>(OBTENER_TODOS_USUARIOS)

const usuariosSugeridos = computed(() => {
  const partes = correoDestinatario.value.split(',')
  const ultimoTexto = partes[partes.length - 1]?.trim().toLowerCase() || ''

  if (!ultimoTexto) return []

  const listaCompleta = usuariosResult.value?.todosUsuarios || []
  return listaCompleta.filter((u: Usuario) => 
    u.nombre.toLowerCase().includes(ultimoTexto) || 
    u.email.toLowerCase().includes(ultimoTexto)
  )
})

const seleccionarUsuarioSugerido = (usuario: Usuario) => {
  const partes = correoDestinatario.value.split(',')
  partes.pop()
  partes.push(' ' + usuario.email)
  
  correoDestinatario.value = partes.join(',').trimStart() + ', '
  mostrarSugerencias.value = false
}

const ocultarSugerenciasConRetraso = () => {
  setTimeout(() => { mostrarSugerencias.value = false }, 200)
}

const manejarSubidaArchivosMultiples = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  Array.from(files).forEach((file) => {
    if (file.size > 10 * 1024 * 1024) {
      alert(`⚠️ El archivo "${file.name}" supera el límite de 10MB.`)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      listaArchivosBase64.value.push({
        nombre: file.name,
        data: reader.result as string
      })
    }
    reader.readAsDataURL(file)
  })
}

const abrirSelectorArchivos = () => {
  fileInputRef.value?.click()
}

const descartarTodo = () => {
  asuntoTicket.value = ''
  cuerpoTicket.value = ''
  correoDestinatario.value = ''
  proyectoTicket.value = ''
  prioridadTicket.value = 'BAJA'
  listaArchivosBase64.value = []
  if (fileInputRef.value) fileInputRef.value.value = ''
  router.push('/tickets')
}

const CREAR_TICKET_MUTATION = gql`
  mutation NuevoTicket($titulo: String!, $descripcion: String!, $asignadosEmails: [String], $archivos: [String], $prioridad: String, $proyecto: String) {
    crearTicket(titulo: $titulo, descripcion: $descripcion, asignadosEmails: $asignadosEmails, archivos: $archivos, prioridad: $prioridad, proyecto: $proyecto) { id }
  }
`
const { mutate: crearTicket } = useMutation(CREAR_TICKET_MUTATION)

const manejarEnviarTicket = async () => {
  if (!asuntoTicket.value || !cuerpoTicket.value) return

  const arregloArchivosEnviables = listaArchivosBase64.value.map(f => JSON.stringify(f))
  const listaCorreos = correoDestinatario.value.split(',').map(c => c.trim()).filter(c => c.length > 0)

  try {
    await crearTicket({ 
      titulo: asuntoTicket.value, 
      descripcion: cuerpoTicket.value,
      asignadosEmails: listaCorreos,
      archivos: arregloArchivosEnviables,
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
      <header :class="esModoOscuro ? 'bg-zinc-900 border-red-950/40' : 'bg-white border-slate-200'" class="h-16 border-b px-8 flex justify-between items-center shrink-0">
        <h2 class="text-sm font-black tracking-widest uppercase text-slate-400">Generador de Tareas e Incidencias</h2>
        <button type="button" @click="esModoOscuro = !esModoOscuro" class="text-xs px-4 py-1.5 rounded-xl font-bold transition" :class="esModoOscuro ? 'bg-zinc-800 text-white' : 'bg-slate-100 text-slate-800'">
          {{ esModoOscuro ? '☀️ Modo Claro' : '🌙 Modo Oscuro' }}
        </button>
      </header>

      <main class="flex-1 overflow-y-auto p-8">
        <div :class="esModoOscuro ? 'bg-zinc-900 border-red-950/30' : 'bg-white border-slate-200'" class="max-w-3xl rounded-2xl border shadow-xl overflow-hidden">
          
          <div class="bg-linear-to-r from-red-900 to-zinc-900 p-4 text-white flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="text-sm">✍️</span>
              <h3 class="text-xs font-black tracking-wider uppercase">Redactar Nuevo Requerimiento Interno</h3>
            </div>
            <span class="text-[9px] font-mono opacity-60">Relant Protocol</span>
          </div>

          <form @submit.prevent="manejarEnviarTicket" class="p-6 space-y-4 text-left">
            
            <div class="flex items-center border-b pb-2 relative border-zinc-800">
              <label class="w-20 text-xs font-bold text-slate-400 uppercase tracking-wider">Para:</label>
              <div class="flex-1 relative">
                <input v-model="correoDestinatario" type="text" @focus="mostrarSugerencias = true" @blur="ocultarSugerenciasConRetraso" class="w-full text-sm focus:outline-none bg-transparent text-white placeholder-zinc-600" placeholder="operador1@relant.com, operador2@relant.com (Separa por comas)" />
                <div v-if="mostrarSugerencias && usuariosSugeridos.length > 0" class="absolute left-0 right-0 top-full mt-1 border rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50 bg-zinc-900 border-zinc-800 text-white divide-y divide-zinc-800">
                  <div v-for="usuario in usuariosSugeridos" :key="usuario.id" @mousedown="seleccionarUsuarioSugerido(usuario)" class="p-2.5 text-xs cursor-pointer hover:bg-zinc-800/60 transition flex flex-col">
                    <span class="font-bold">{{ usuario.nombre }}</span>
                    <span class="text-[10px] text-zinc-500 font-mono mt-0.5">{{ usuario.email }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b pb-3 border-zinc-800">
              <div class="flex items-center">
                <label class="w-20 text-xs font-bold text-slate-400 uppercase tracking-wider">Prioridad:</label>
                <select v-model="prioridadTicket" class="flex-1 text-xs p-2.5 rounded-xl border focus:outline-none cursor-pointer font-bold bg-zinc-950 border-zinc-800 text-white">
                  <option value="BAJA">🟢 BAJA</option>
                  <option value="MEDIA">🔵 MEDIA</option>
                  <option value="ALTA">🟡 ALTA</option>
                  <option value="CRITICA">🔴 CRÍTICA</option>
                </select>
              </div>

              <div class="flex items-center">
                <label class="w-20 text-xs font-bold text-slate-400 uppercase tracking-wider">Proyecto:</label>
                <select v-model="proyectoTicket" class="flex-1 text-xs p-2.5 rounded-xl border focus:outline-none cursor-pointer font-bold truncate bg-zinc-950 border-zinc-800 text-white">
                  <option value="">📂 General / Sin Proyecto</option>
                  <option v-if="cargandoProyectos" disabled>⏳ Cargando proyectos...</option>
                  <option v-else v-for="nombreProj in listaProyectos" :key="nombreProj" :value="nombreProj">
                    📁 {{ nombreProj }}
                  </option>
                </select>
              </div>
            </div>

            <div class="flex items-center border-b pb-2 border-zinc-800">
              <label class="w-20 text-xs font-bold text-slate-400 uppercase tracking-wider">Asunto:</label>
              <input v-model="asuntoTicket" type="text" required class="w-full text-sm font-bold focus:outline-none bg-transparent text-white" placeholder="Título del hito o incidencia a resolver..." />
            </div>

            <!-- 📎 SOLO EL CLIP DE ADJUNTOS -->
            <div class="flex items-center gap-2 border-b pb-3 border-zinc-800">
              <input type="file" ref="fileInputRef" multiple accept="*" @change="manejarSubidaArchivosMultiples" class="hidden" />
              <button type="button" @click="abrirSelectorArchivos" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition cursor-pointer">
                <span>📎</span>
                <span>Adjuntar archivos</span>
              </button>
              <span v-if="listaArchivosBase64.length > 0" class="text-xs text-zinc-400 font-mono font-semibold">
                ({{ listaArchivosBase64.length }} seleccionado(s))
              </span>
            </div>

            <div v-if="listaArchivosBase64.length > 0" class="flex flex-wrap gap-2 pt-1">
              <span v-for="(f, i) in listaArchivosBase64" :key="i" class="bg-zinc-800 text-zinc-200 text-[10px] font-mono px-2.5 py-1 rounded-lg border border-zinc-700 flex items-center gap-1.5">
                📦 {{ f.nombre }}
                <button type="button" @click="listaArchivosBase64.splice(i, 1)" class="text-red-400 font-bold hover:text-red-300 ml-1 cursor-pointer">✕</button>
              </span>
            </div>

            <div class="pt-2">
              <textarea v-model="cuerpoTicket" rows="6" required class="w-full p-4 text-sm rounded-xl border focus:outline-none bg-zinc-950 border-zinc-800 text-white" placeholder="Escribe aquí las especificaciones detalladas de la tarea..."></textarea>
            </div>

            <div class="flex justify-between items-center pt-4 border-t border-zinc-800">
              <span class="text-[10px] text-slate-400 font-medium">🔒 Sincronización en tiempo real habilitada</span>
              <div class="flex space-x-2">
                <button type="button" @click="descartarTodo" class="bg-zinc-800 text-zinc-300 font-semibold text-xs px-5 py-2.5 rounded-xl cursor-pointer">Descartar</button>
                <button type="submit" class="bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl shadow-lg cursor-pointer">Enviar Requerimiento</button>
              </div>
            </div>
          </form>

        </div>
      </main>
    </div>
  </div>
</template>