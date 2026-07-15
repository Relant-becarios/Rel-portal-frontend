<template>
  <div :class="esModoOscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'" class="flex min-h-screen items-center justify-center p-4 transition-colors duration-200 font-sans">
    
    <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="w-full max-w-md border p-6 sm:p-8 rounded-3xl shadow-xl space-y-6 transition-colors">
      
      <!-- Encabezado del Formulario corporativo -->
      <div class="text-center space-y-2">
        <span class="text-[10px] font-black bg-red-700 text-white px-2 py-0.5 rounded-md tracking-wider uppercase">
          Relant Security
        </span>
        <h2 :class="esModoOscuro ? 'text-white' : 'text-slate-900'" class="text-xl sm:text-2xl font-black tracking-tight mt-2">
          ¿Olvidaste tu contraseña?
        </h2>
        <p :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-500'" class="text-xs leading-relaxed max-w-xs mx-auto">
          Introduce tu correo electrónico institucional para enviarte una solicitud de restablecimiento cifrada.
        </p>
      </div>

      <!-- Formulario interactivo -->
      <form @submit.prevent="enviarSolicitudReset" class="space-y-4">
        <div :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200'" class="flex flex-col border-b pb-2">
          <label :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-500'" class="text-[10px] font-bold uppercase tracking-wider mb-1">
            Correo Electrónico
          </label>
          <input 
            v-model="correoUsuario" 
            type="email" 
            required 
            :disabled="cargando"
            :class="esModoOscuro ? 'bg-transparent text-white placeholder-zinc-700' : 'bg-transparent text-slate-900 placeholder-slate-400'" 
            class="w-full text-sm focus:outline-hidden font-medium" 
            placeholder="ejemplo@relant.com.mx" 
          />
        </div>

        <!-- Banners Dinámicos de Respuesta del Servidor -->
        <div v-if="mensajeExito" class="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 text-xs text-left leading-relaxed">
          {{ mensajeExito }}
        </div>

        <div v-if="mensajeError" class="p-3 rounded-xl bg-red-950/20 border border-red-900/40 text-red-400 text-xs text-left leading-relaxed">
          {{ mensajeError }}
        </div>

        <!-- Botón de Despacho -->
        <button 
          type="submit" 
          :disabled="cargando || !correoUsuario.trim()"
          :class="[
            cargando || !correoUsuario.trim()
              ? 'bg-zinc-800 text-zinc-500 border-zinc-700/40 cursor-not-allowed'
              : 'bg-red-700 hover:bg-red-800 text-white cursor-pointer shadow-md',
            'w-full border font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition duration-200 text-center block'
          ]"
        >
          {{ cargando ? 'Despachando Enlace...' : 'Enviar Enlace de Recuperación' }}
        </button>
      </form>

      <!-- Retorno al Sistema de Login -->
      <div :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-100'" class="pt-4 border-t text-center">
        <button 
          @click="regresarAlLogin" 
          :class="esModoOscuro ? 'text-zinc-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'" 
          class="text-xs font-bold tracking-wide transition cursor-pointer bg-transparent border-0"
        >
          ← Volver al Inicio de Sesión
        </button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../firebase' // 👈 Heredamos la misma instancia de Firebase configurada en tu enrutador
import { sendPasswordResetEmail } from 'firebase/auth'

const router = useRouter()
const esModoOscuro = ref(true)

const correoUsuario = ref('')
const cargando = ref(false)
const mensajeExito = ref('')
const mensajeError = ref('')

onMounted(() => {
  const temaGuardado = localStorage.getItem('relant_theme')
  if (temaGuardado) {
    esModoOscuro.value = temaGuardado === 'oscuro'
  }
})

const enviarSolicitudReset = async () => {
  if (!correoUsuario.value.trim()) return
  
  cargando.value = true
  mensajeExito.value = ''
  mensajeError.value = ''
  
  try {
    // 🚀 Firebase procesa el token y envía el correo cifrado de forma nativa
    await sendPasswordResetEmail(auth, correoUsuario.value.trim().toLowerCase())
    
    mensajeExito.value = `🔒 Enlace generado con éxito. Las instrucciones de restablecimiento han sido enviadas al correo institucional ingresado. Por favor, revisa tu bandeja de entrada o la carpeta de spam.`
    correoUsuario.value = ''
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string }
    
    if (firebaseError.code === 'auth/user-not-found') {
      mensajeError.value = '❌ El correo electrónico ingresado no coincide con ningún operador registrado en la plataforma.'
    } else if (firebaseError.code === 'auth/invalid-email') {
      mensajeError.value = '❌ El formato del correo electrónico ingresado es incorrecto.'
    } else {
      mensajeError.value = `❌ Error en el servicio de autenticación: ${firebaseError.message || 'Inténtelo más tarde.'}`
    }
  } finally {
    cargando.value = false
  }
}

const regresarAlLogin = () => {
  router.push('/login')
}
</script>