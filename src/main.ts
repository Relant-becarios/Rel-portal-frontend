import { createApp, provide, h } from 'vue'
import App from './App.vue'
import './style.css'

import { ApolloClient, createHttpLink, InMemoryCache } from '@apollo/client/core'
import { setContext } from '@apollo/client/link/context'
import { DefaultApolloClient } from '@vue/apollo-composable'

import { auth } from './firebase.ts'
import router from './router'

// 🧠 Detecta automáticamente la URL del Backend (Vercel/HTTPS vs Red Local/HTTP)
const backendUri = window.location.protocol === 'https:'
  ? 'https://rel-portal-backend.onrender.com'
  : 'http://26.199.22.6:4000'

const httpLink = createHttpLink({
  uri: backendUri,
})

const authLink = setContext(async (_, { headers }) => {
  if (auth.authStateReady) {
    await auth.authStateReady();
  }
  
  const usuarioActual = auth.currentUser;
  const token = usuarioActual ? await usuarioActual.getIdToken() : '';
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    }
  }
})

export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
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