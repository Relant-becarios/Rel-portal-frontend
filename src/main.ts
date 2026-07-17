import { createApp, provide, h } from 'vue'
import App from './App.vue'
import './style.css'

// Herramientas de GraphQL
import { ApolloClient, createHttpLink, InMemoryCache } from '@apollo/client/core'
import { setContext } from '@apollo/client/link/context'
import { DefaultApolloClient } from '@vue/apollo-composable'

// Conexión a Firebase y Router del Frontend
import { auth } from './firebase.ts'
import router from './router'

// 1. Conexión base a tu servidor Node.js (Puerto 4000)
const httpLink = createHttpLink({
  uri: 'https://rel-portal-backend-gitlab.onrender.com',
})

// 2. Middleware para inyectar el Token (JWT) de Firebase en los Headers de forma asíncrona
const authLink = setContext(async (_, { headers }) => {
  const usuarioActual = auth.currentUser;
  const token = usuarioActual ? await usuarioActual.getIdToken() : '';
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    }
  }
})

// 3. Inicializar el cliente Apollo uniendo el link de autenticación
const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
})

// 4. Configurar la instancia de la aplicación de Vue
const app = createApp({
  setup () {
    provide(DefaultApolloClient, apolloClient)
  },
  render: () => h(App),
})

// 5. Acoplar el sistema de enrutamiento y montar la aplicación en el DOM
app.use(router)
app.mount('#app')