import { createApp, provide, h } from 'vue'
import App from './App.vue'
import './style.css'

import { ApolloClient, createHttpLink, InMemoryCache } from '@apollo/client/core'
import { setContext } from '@apollo/client/link/context'
import { onError } from '@apollo/client/link/error' // 👈 Capturador de errores exactos
import { DefaultApolloClient } from '@vue/apollo-composable'

import { auth } from './firebase.ts'
import router from './router'

// 🚀 Backend URI
const backendUri = window.location.protocol === 'https:'
  ? 'https://rel-portal-backend-gitlab.onrender.com'
  : 'http://26.199.22.6:4000'

const httpLink = createHttpLink({
  uri: backendUri,
})

// 🔍 Manejador que imprime el texto exacto del error en lugar de URLs
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(
        `❌ [Error de GraphQL]: ${message}\n📍 Ubicación: ${JSON.stringify(locations)}\n📂 Ruta: ${path}`
      )
    })
  }
  if (networkError) {
    console.error(`🚨 [Error de Red/Conexión]:`, networkError)
  }
})

const authLink = setContext(async (_, { headers }) => {
  if (auth.authStateReady) {
    await auth.authStateReady()
  }
  
  const usuarioActual = auth.currentUser
  const token = usuarioActual ? await usuarioActual.getIdToken() : ''
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    }
  }
})

// 🔗 Unir los eslabones: Captura de errores -> Autenticación -> Conexión HTTP
export const apolloClient = new ApolloClient({
  link: errorLink.concat(authLink).concat(httpLink),
  cache: new InMemoryCache(),
})

const app = createApp({
  setup () {
    provide(DefaultApolloClient, apolloClient)
  },
  render: () => h(App),
})

app.use(router)
app.mount('#app')