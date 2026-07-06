<script setup>
import { ref, onMounted } from 'vue'
import { auth } from './firebase'
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth'
import { useQuery, useMutation } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'

// 1. ESTADOS REACTIVOS
const usuario = ref(null)
const cargandoAuth = ref(true)
const email = ref('')
const password = ref('')

// Formulario de nuevo ticket
const tituloTicket = ref('')
const descripcionTicket = ref('')

// 2. CONSULTAS Y MUTACIONES GRAPHQL
// Query para traer los tickets del usuario logueado
const OBTENER_TICKETS = gql`
  query GetMisTickets {
    misTickets {
      id
      titulo
      descripcion
      estado
      fecha_recibido
    }
  }
`
const { result, loading, error, refetch } = useQuery(OBTENER_TICKETS)

// Mutation para crear un ticket nuevo
const CREAR_TICKET_MUTATION = gql`
  mutation NuevoTicket($titulo: String!, $descripcion: String!) {
    crearTicket(titulo: $titulo, descripcion: $descripcion) {
      id
      titulo
    }
  }
`
const { mutate: crearTicket } = useMutation(CREAR_TICKET_MUTATION)

// 3. LOGICA DE AUTENTICACIÓN
onMounted(() => {
  // Escucha si el usuario entra o sale de la app
  onAuthStateChanged(auth, (user) => {
    usuario.value = user
    cargandoAuth.value = false
    if (user) refetch() // Si entra, refresca los tickets del backend
  })
})

const manejarLogin = async () => {
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value)
    email.value = ''
    password.value = ''
  } catch (err) {
    alert('Error al iniciar sesión: ' + err.message)
  }
}

const manejarCerrarSesion = () => {
  signOut(auth)
}

// 4. LOGICA DE TICKETS
const manejarCrearTicket = async () => {
  if (!tituloTicket.value || !descripcionTicket.value) return
  try {
    await crearTicket({
      titulo: tituloTicket.value,
      descripcion: descripcionTicket.value
    })
    tituloTicket.value = ''
    descripcionTicket.value = ''
    refetch() // Recarga la lista de tickets en pantalla
    alert('¡Ticket creado con éxito!')
  } catch (err) {
    alert('Error al crear ticket: ' + err.message)
  }
}
</script>

<template>
  <div v-if="cargandoAuth" class="min-h-screen flex items-center justify-center bg-gray-100">
    <p class="text-gray-500 font-semibold animate-pulse">Cargando portal empresarial...</p>
  </div>

  <div v-else>
    <div v-if="!usuario" class="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div class="text-center">
          <h2 class="text-3xl font-extrabold text-slate-800">Portal Interno</h2>
          <p class="text-sm text-gray-500 mt-2">Inicia sesión para gestionar tus pedidos y tickets</p>
        </div>
        
        <form @submit.prevent="manejarLogin" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Correo Corporativo</label>
            <input v-model="email" type="email" required class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-slate-900" placeholder="empleado@empresa.com" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Contraseña</label>
            <input v-model="password" type="password" required class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-slate-900" placeholder="••••••••" />
          </div>
          <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 shadow-md">
            Ingresar al Portal
          </button>
        </form>
      </div>
    </div>

    <div v-else class="min-h-screen bg-gray-50 text-slate-800">
      <nav class="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <h1 class="text-xl font-bold text-slate-900">🏢 Portal de Tickets e Intranet</h1>
        <div class="flex items-center space-y-0 space-x-4">
          <span class="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full font-medium">{{ usuario.email }}</span>
          <button @click="manejarCerrarSesion" class="bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold py-2 px-4 rounded-lg transition">
            Cerrar Sesión
          </button>
        </div>
      </nav>

      <main class="max-w-7xl mx-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <section class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4 h-fit">
          <h2 class="text-lg font-bold text-slate-900 border-b pb-2">Crear Nuevo Pedido / Ticket</h2>
          <form @submit.prevent="manejarCrearTicket" class="space-y-4">
            <div>
              <label class="text-sm font-semibold">Título del Pedido</label>
              <input v-model="tituloTicket" type="text" required class="mt-1 w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" placeholder="Ej: Falla en servidor / Pedido papelería" />
            </div>
            <div>
              <label class="text-sm font-semibold">Descripción Detallada</label>
              <textarea v-model="descripcionTicket" rows="4" required class="mt-1 w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" placeholder="Describe qué necesitas y a quién va dirigido..."></textarea>
            </div>
            <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg shadow transition">
              Enviar Ticket
            </button>
          </form>
        </section>

        <section class="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 class="text-lg font-bold text-slate-900 border-b pb-2 mb-4">Mis Tickets Solicitados / Asignados</h2>
          
          <div v-if="loading" class="text-gray-500">Cargando tickets desde el servidor...</div>
          <div v-else-if="error" class="text-red-500">Error al conectar con el backend: {{ error.message }}</div>
          
          <div v-else-if="result?.misTickets?.length === 0" class="text-gray-400 py-8 text-center">
            No tienes tickets registrados en este momento.
          </div>

          <div v-else class="space-y-4">
            <div v-for="ticket in result.misTickets" :key="ticket.id" class="p-4 border border-gray-100 rounded-xl bg-gray-50 flex justify-between items-start hover:shadow-sm transition">
              <div>
                <h3 class="font-bold text-slate-900 text-base">{{ ticket.titulo }}</h3>
                <p class="text-sm text-gray-600 mt-1">{{ ticket.descripcion }}</p>
                <span class="text-xs text-gray-400 block mt-2">Creado el: {{ new Date(Number(ticket.fecha_recibido)).toLocaleString() }}</span>
              </div>
              <span :class="{
                'bg-blue-100 text-blue-700': ticket.estado === 'RECIBIDO',
                'bg-amber-100 text-amber-700': ticket.estado === 'TRABAJANDO',
                'bg-purple-100 text-purple-700': ticket.estado === 'COMPLETADO',
                'bg-emerald-100 text-emerald-700': ticket.estado === 'APROBADO',
                'bg-red-100 text-red-700': ticket.estado === 'RECHAZADO',
              }" class="text-xs font-bold px-3 py-1 rounded-full uppercase">
                {{ ticket.estado }}
              </span>
            </div>
          </div>
        </section>

      </main>
    </div>
  </div>
</template>