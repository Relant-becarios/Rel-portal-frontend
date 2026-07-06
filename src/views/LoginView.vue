<script setup lang="ts">
import { ref } from 'vue'
import { auth } from '../firebase'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { useMutation } from '@vue/apollo-composable' // <-- CORREGIDO: Se eliminó el "vue-" extra
import { gql } from '@apollo/client/core'
import { useRouter } from 'vue-router'

const router = useRouter()
const esLogin = ref(true)
const email = ref('')
const password = ref('')
const nombre = ref('')
const rol = ref('EMPLEADO')

const REGISTRAR_USUARIO_MUTATION = gql`
  mutation NuevoUsuario($nombre: String!, $rol: Role!) {
    registrarUsuario(nombre: $nombre, rol: $rol) { id }
  }
`
const { mutate: registrarEnPostgres } = useMutation(REGISTRAR_USUARIO_MUTATION)

const manejarLogin = async () => {
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value)
    router.push('/home')
  } catch (err: any) {
    alert('Error al autenticar: ' + err.message)
  }
}

const manejarRegistro = async () => {
  if (!nombre.value || !email.value || !password.value) return
  try {
    await createUserWithEmailAndPassword(auth, email.value, password.value)
    await registrarEnPostgres({ nombre: nombre.value, rol: rol.value })
    alert('¡Cuenta de empleado creada con éxito!')
    esLogin.value = true
  } catch (err: any) {
    alert('Error en el registro: ' + err.message)
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-900 via-slate-950 to-blue-950 px-4">
    <div class="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-100 p-10 space-y-8 transition-all duration-300">
      <div class="text-center">
        <div class="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-2xl font-black mx-auto shadow-md shadow-indigo-600/20 mb-4">R</div>
        <h2 class="text-3xl font-black text-slate-900 tracking-tight">Relant Portal</h2>
        <p class="text-xs text-slate-400 font-bold uppercase tracking-wider mt-2">
          {{ esLogin ? 'Sistemas Centralizados' : 'Registro de Personal' }}
        </p>
      </div>
      
      <form v-if="esLogin" @submit.prevent="manejarLogin" class="space-y-5">
        <div>
          <label class="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Correo Corporativo</label>
          <input v-model="email" type="email" required class="mt-2 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-hidden focus:border-indigo-600 transition-all" placeholder="usuario@relant.com" />
        </div>
        <div>
          <label class="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Clave de Acceso</label>
          <input v-model="password" type="password" required class="mt-2 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-hidden focus:border-indigo-600 transition-all" placeholder="••••••••" />
        </div>
        <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl transition shadow-lg shadow-indigo-600/10 cursor-pointer">
          Autenticar e Ingresar
        </button>
        <p class="text-center text-xs text-slate-400 font-medium">
          ¿Nuevo miembro? 
          <button type="button" @click="esLogin = false" class="text-indigo-600 font-bold hover:underline">Crear cuenta corporativa</button>
        </p>
      </form>

      <form v-else @submit.prevent="manejarRegistro" class="space-y-5">
        <div>
          <label class="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Nombre Completo</label>
          <input v-model="nombre" type="text" required class="mt-2 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-hidden focus:border-indigo-600 transition-all" placeholder="Juan Pérez" />
        </div>
        <div>
          <label class="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Correo Institucional</label>
          <input v-model="email" type="email" required class="mt-2 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-hidden focus:border-indigo-600 transition-all" placeholder="usuario@relant.com" />
        </div>
        <div>
          <label class="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Contraseña Segura</label>
          <input v-model="password" type="password" required class="mt-2 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-hidden focus:border-indigo-600 transition-all" placeholder="Mínimo 6 caracteres" />
        </div>
        <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl transition shadow-lg shadow-emerald-600/10 cursor-pointer">
          Dar de Alta en Base de Datos
        </button>
        <p class="text-center text-xs text-slate-400 font-medium">
          ¿Ya tienes cuenta? 
          <button type="button" @click="esLogin = true" class="text-indigo-600 font-bold hover:underline">Volver al login</button>
        </p>
      </form>
    </div>
  </div>
</template>