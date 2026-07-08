<script setup lang="ts">
import { ref } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { useMutation } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'
import { useRouter } from 'vue-router'

const router = useRouter()
const esModoOscuro = ref(true)

// Campos estilo Correo Electrónico
const correoDestinatario = ref('')
const asuntoTicket = ref('')
const cuerpoTicket = ref('')
const archivoAdjuntoBase64 = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Procesar el archivo adjunto y pasarlo a texto Base64
const manejarSubidaArchivo = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) {
    archivoAdjuntoBase64.value = null
    return
  }

  // 🔒 Validación: Máximo 3MB por archivo
  if (file.size > 3 * 1024 * 1024) {
    alert('⚠️ El archivo supera el límite de 3MB. Por favor sube una captura o documento más ligero.')
    target.value = ''
    archivoAdjuntoBase64.value = null
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    archivoAdjuntoBase64.value = e.target?.result as string
  }
  reader.readAsDataURL(file)
}

// Mutación actualizada con soporte para destinatario y archivo adjunto
const CREAR_TICKET_MUTATION = gql`
  mutation NuevoTicket($titulo: String!, $descripcion: String!, $asignadoEmail: String, $archivo: String) {
    crearTicket(titulo: $titulo, descripcion: $descripcion, asignadoEmail: $asignadoEmail, archivo: $archivo) { 
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
      archivo: archivoAdjuntoBase64.value
    })
    
    alert('📧 Requerimiento generado y despachado con éxito.')
    router.push('/tickets')
  } catch (err: any) {
    alert('Error al despachar requerimiento: ' + err.message)
  }
}
</script>

<template>
  <div :class="esModoOscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'" class="flex min-h-screen transition-colors duration-200">
    <Sidebar :dark="esModoOscuro" />
    
    <div class="flex-1 flex flex-col min-w-0">
      <header :class="esModoOscuro ? 'bg-zinc-900 border-red-950/40' : 'bg-white border-slate-200'" class="h-16 border-b px-8 flex justify-between items-center shrink-0 transition-colors">
        <h2 class="text-sm font-black tracking-widest uppercase text-slate-400">Generador de Tareas e Incidencias</h2>
        <button @click="esModoOscuro = !esModoOscuro" :class="esModoOscuro ? 'bg-zinc-800 text-white' : 'bg-slate-100 text-slate-800'" class="text-xs px-4 py-1.5 rounded-xl font-bold transition">
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
            <span class="text-[9px] font-mono opacity-60">Relant Mail-To-Ticket Protocol</span>
          </div>

          <form @submit.prevent="manejarEnviarTicket" class="p-6 space-y-4">
            <div class="flex items-center border-b pb-2" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-100'">
              <label class="w-16 text-xs font-bold text-slate-400 uppercase tracking-wider">Para:</label>
              <input v-model="correoDestinatario" type="text" 
                     :class="esModoOscuro ? 'bg-transparent text-white placeholder-zinc-600' : 'bg-transparent text-slate-900'" 
                     class="w-full text-sm focus:outline-hidden" placeholder="empleado@relant.com o Nombre (O vacío para Mesa General)" />
            </div>

            <div class="flex items-center border-b pb-2" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-100'">
              <label class="w-16 text-xs font-bold text-slate-400 uppercase tracking-wider">Asunto:</label>
              <input v-model="asuntoTicket" type="text" required
                     :class="esModoOscuro ? 'bg-transparent text-white placeholder-zinc-600' : 'bg-transparent text-slate-900'" 
                     class="w-full text-sm font-bold focus:outline-hidden" placeholder="Título o asunto de la incidencia" />
            </div>

            <!-- 📎 NUEVA SECCIÓN DE ARCHIVO ADJUNTO -->
            <div class="flex items-center border-b pb-3" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-100'">
              <label class="w-16 text-xs font-bold text-slate-400 uppercase tracking-wider">Adjunto:</label>
              <input type="file" ref="fileInputRef" @change="manejarSubidaArchivo" accept="image/*,.pdf,.doc,.docx" 
                     class="text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700 cursor-pointer w-full" />
            </div>

            <div class="pt-2">
              <textarea v-model="cuerpoTicket" rows="8" required
                        :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white placeholder-zinc-600' : 'bg-slate-50 border-slate-200'" 
                        class="w-full p-4 text-sm rounded-xl border focus:outline-hidden focus:border-red-900/50 transition leading-relaxed" 
                        placeholder="Escribe aquí las especificaciones del requerimiento técnico..."></textarea>
            </div>

            <div class="flex justify-between items-center pt-4 border-t" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-100'">
              <span class="text-[10px] text-slate-400 font-medium">🔒 Protocolo TLS activo</span>
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