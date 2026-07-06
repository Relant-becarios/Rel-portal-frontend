// src/main.js
import { createApp, provide, h } from 'vue'
import App from './App.vue'
import './style.css'

// Importaciones de Apollo (GraphQL)
import { ApolloClient, createHttpLink, InMemoryCache } from '@apollo/client/core'
import { setContext } from '@apollo/client/link/context'
import { DefaultApolloClient } from '@vue/apollo-composable'

// Importación de nuestra configuración de Firebase
import { auth } from './firebase'

// 1. Conexión base a tu servidor Node.js (Puerto 4000)
const httpLink = createHttpLink({
  uri: 'http://localhost:4000/',
})

// 2. Middleware mágico: Agarra el token de Firebase y lo mete en los Headers
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

// 3. Crear el cliente de Apollo
const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
})

// 4. Arrancar la app de Vue inyectando GraphQL
const app = createApp({
  setup () {
    provide(DefaultApolloClient, apolloClient)
  },
  render: () => h(App),
})

app.mount('#app')