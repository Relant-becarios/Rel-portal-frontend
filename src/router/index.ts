import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'

const obtenerUsuarioActual = () => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe()
      resolve(user)
    })
  })
}

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('../views/HomeView.vue'),
    meta: { requiereAuth: true, titulo: 'Inicio - Relant Portal' }
  },
  {
    path: '/tickets',
    name: 'Tickets',
    component: () => import('../views/DashboardView.vue'),
    meta: { requiereAuth: true, titulo: 'Tickets - Relant Portal' }
  },
  {
    path: '/nuevo-ticket',
    name: 'NuevoTicket',
    component: () => import('../views/CreateTicketView.vue'),
    meta: { requiereAuth: true, titulo: 'Nuevo Ticket - Relant Portal' }
  },
  {
    path: '/graficas',
    name: 'Graficas',
    component: () => import('../views/GraficasView.vue'),
    meta: { requiereAuth: true, titulo: 'Gráficas - Relant Portal' }
  },
  {
    path: '/perfil',
    name: 'Perfil',
    component: () => import('../views/PerfilView.vue'),
    meta: { requiereAuth: true, titulo: 'Mi Perfil - Relant Portal' }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { requiereInvitado: true, titulo: 'Iniciar Sesión - Relant Portal' }
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: () => import('../views/ForgotPasswordView.vue'),
    meta: { requiereInvitado: true, titulo: 'Recuperar Contraseña - Relant Portal' }
  },
  // 🔄 Redirección automática si escriben una URL desconocida
  {
    path: '/:pathMatch(.*)*',
    redirect: '/home'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach(async (to, from, next) => {
  const usuario = await obtenerUsuarioActual()

  // 🏷️ Actualizar el título de la pestaña del navegador
  if (to.meta.titulo) {
    document.title = to.meta.titulo as string
  }

  if (to.meta.requiereAuth && !usuario) {
    next('/login')
  } else if (to.meta.requiereInvitado && usuario) {
    next('/home')
  } else {
    next()
  }
})

export default router