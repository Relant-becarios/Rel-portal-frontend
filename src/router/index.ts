import { createRouter, createWebHistory } from 'vue-router'
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
    path: '/graficas',
    name: 'Graficas',
    component: () => import('../views/GraficasView.vue'),
    meta: { requiereAuth: true }
  },
  {
    path: '/perfil',
    name: 'Perfil',
    component: () => import('../views/PerfilView.vue'),
    meta: { requiereAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { requiereInvitado: true }
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: () => import('../views/ForgotPasswordView.vue'),
    meta: { requiereInvitado: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  const usuario = await obtenerUsuarioActual()

  if (to.meta.requiereAuth && !usuario) {
    next('/login')
  } else if (to.meta.requiereInvitado && usuario) {
    next('/home')
  } else {
    next()
  }
})

export default router