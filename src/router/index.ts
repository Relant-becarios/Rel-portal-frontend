import { createRouter, createWebHistory } from 'vue-router'
import { auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'

// Función auxiliar para esperar a que Firebase nos diga si hay sesión activa
const obtenerUsuarioActual = () => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe()
      resolve(user)
    })
  })
}

const routes = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('../views/HomeView.vue'),
    meta: { requiereAuth: true }
  },
  {
    path: '/tickets',
    name: 'Tickets',
    component: () => import('../views/DashboardView.vue'),
    meta: { requiereAuth: true }
  },
  {
    path: '/nuevo-ticket',
    name: 'NuevoTicket',
    component: () => import('../views/CreateTicketView.vue'),
    meta: { requiereAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { requiereInvitado: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Guardia de seguridad de las rutas (Navigation Guards)
router.beforeEach(async (to, from, next) => {
  const usuario = await obtenerUsuarioActual()

  if (to.meta.requiereAuth && !usuario) {
    next('/login') // Si no está logueado, directo a identificarse
  } else if (to.meta.requiereInvitado && usuario) {
    next('/home')  // Si ya tiene sesión activa, lo mandamos al Home de Relant
  } else {
    next()         // Camino libre
  }
})

export default router