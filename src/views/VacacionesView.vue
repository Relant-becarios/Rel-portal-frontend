<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { useQuery, useMutation } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'

const esModoOscuro = ref(true)

// FORMULARIO SOLICITUD DE PERMISO
const duracionDia = ref('DIA_COMPLETO') // DIA_COMPLETO, PRIMERA_MITAD, SEGUNDA_MITAD
const tipoPermiso = ref('Licencia No Pagada')
const categoria = ref('VACACIONES') // VACACIONES, ENFERMEDAD, INCAPACIDAD, PERSONAL, MATERNIDAD_PATERNIDAD
const numDias = ref<number>(1)
const fechaInicio = ref('2026-08-19')
const fechaFin = ref('')
const motivoSolicitud = ref('')
const enviandoSolicitud = ref(false)

// CALENDARIO DE AGOSTO 2026
const mesActual = ref('Agosto 2026')
const diasCalendario = ref([
  { dia: 26, otroMes: true }, { dia: 27, otroMes: true }, { dia: 28, otroMes: true }, { dia: 29, otroMes: true }, { dia: 30, otroMes: true }, { dia: 31, otroMes: true }, { dia: 1, otroMes: false },
  { dia: 2, otroMes: false }, { dia: 3, otroMes: false }, { dia: 4, otroMes: false }, { dia: 5, otroMes: false }, { dia: 6, otroMes: false }, { dia: 7, otroMes: false }, { dia: 8, otroMes: false },
  { dia: 9, otroMes: false }, { dia: 10, otroMes: false }, { dia: 11, otroMes: false }, { dia: 12, otroMes: false }, { dia: 13, otroMes: false }, { dia: 14, otroMes: false }, { dia: 15, otroMes: false },
  { dia: 16, otroMes: false }, { dia: 17, otroMes: false }, { dia: 18, otroMes: false }, { dia: 19, seleccionado: true, otroMes: false }, { dia: 20, otroMes: false }, { dia: 21, otroMes: false }, { dia: 22, otroMes: false },
  { dia: 23, otroMes: false }, { dia: 24, otroMes: false }, { dia: 25, otroMes: false }, { dia: 26, otroMes: false }, { dia: 27, otroMes: false }, { dia: 28, otroMes: false }, { dia: 29, otroMes: false },
  { dia: 30, otroMes: false }, { dia: 31, otroMes: false }, { dia: 1, otroMes: true }, { dia: 2, otroMes: true }, { dia: 3, otroMes: true }, { dia: 4, otroMes: true }, { dia: 5, otroMes: true }
])

const toggleTema = () => {
  esModoOscuro.value = !esModoOscuro.value
  localStorage.setItem('relant_theme', esModoOscuro.value ? 'oscuro' : 'claro')
}

// GRAPHQL
const OBTENER_VACACIONES_DATOS = gql`
  query GetVacacionesDatos {
    me {
      id
      nombre
      email
      rol
      diasVacaciones
    }
    obtenerSolicitudesPermisos {
      id
      duracionDia
      tipoPermiso
      categoria
      numDias
      fechaInicio
      fechaFin
      motivo
      estado
      fechaSolicitud
      solicitante { id nombre email diasVacaciones }
    }
  }
`

const CREAR_SOLICITUD_MUTATION = gql`
  mutation CrearSolicitudPermiso(
    $duracionDia: DuracionDia!,
    $tipoPermiso: String!,
    $categoria: CategoriaPermiso!,
    $numDias: Float!,
    $fechaInicio: String!,
    $fechaFin: String,
    $motivo: String!
  ) {
    crearSolicitudPermiso(
      duracionDia: $duracionDia,
      tipoPermiso: $tipoPermiso,
      categoria: $categoria,
      numDias: $numDias,
      fechaInicio: $fechaInicio,
      fechaFin: $fechaFin,
      motivo: $motivo
    ) {
      id
      estado
    }
  }
`

const EVALUAR_SOLICITUD_MUTATION = gql`
  mutation EvaluarSolicitudPermiso($solicitudId: String!, $aprobado: Boolean!) {
    evaluarSolicitudPermiso(solicitudId: $solicitudId, aprobado: $aprobado) {
      id
      estado
    }
  }
`

const { result, loading, refetch } = useQuery(OBTENER_VACACIONES_DATOS, null, {
  fetchPolicy: 'network-only',
  pollInterval: 4000
})

const { mutate: apiCrearSolicitud } = useMutation(CREAR_SOLICITUD_MUTATION)
const { mutate: apiEvaluarSolicitud } = useMutation(EVALUAR_SOLICITUD_MUTATION)

const usuarioActual = computed(() => result.value?.me)
const solicitudes = computed(() => result.value?.obtenerSolicitudesPermisos || [])

const esAdminOJefe = computed(() => {
  const rol = usuarioActual.value?.rol
  return ['ADMIN', 'OWNER', 'JEFE'].includes(rol)
})

const seleccionarDia = (diaItem: any) => {
  if (diaItem.otroMes) return
  diasCalendario.value.forEach(d => d.seleccionado = false)
  diaItem.seleccionado = true
  const diaPad = String(diaItem.dia).padStart(2, '0')
  fechaInicio.value = `2026-08-${diaPad}`
}

const enviarFormulario = async () => {
  if (!motivoSolicitud.value.trim()) {
    alert('❌ Ingresa el motivo de la solicitud.')
    return
  }

  enviandoSolicitud.value = true
  try {
    await apiCrearSolicitud({
      duracionDia: duracionDia.value,
      tipoPermiso: tipoPermiso.value,
      categoria: categoria.value,
      numDias: Number(numDias.value),
      fechaInicio: fechaInicio.value,
      fechaFin: fechaFin.value || null,
      motivo: motivoSolicitud.value.trim()
    })

    alert('✅ Solicitud enviada correctamente.')
    motivoSolicitud.value = ''
    numDias.value = 1
    refetch()
  } catch (err: any) {
    alert('Error al enviar la solicitud: ' + err.message)
  } finally {
    enviandoSolicitud.value = false
  }
}

const evaluarSolicitud = async (solicitudId: string, aprobado: Boolean) => {
  try {
    await apiEvaluarSolicitud({ solicitudId, aprobado })
    alert(aprobado ? '✅ Solicitud APROBADA.' : '🚫 Solicitud RECHAZADA.')
    refetch()
  } catch (err: any) {
    alert('Error al evaluar solicitud: ' + err.message)
  }
}

onMounted(() => {
  const temaGuardado = localStorage.getItem('relant_theme')
  esModoOscuro.value = temaGuardado ? temaGuardado === 'oscuro' : true
})
</script>

<template>
  <div :class="esModoOscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'" class="flex h-screen overflow-hidden font-sans">
    <Sidebar :dark="esModoOscuro" />

    <div class="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
      <header :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="h-16 border-b px-8 flex justify-between items-center shrink-0">
        <div class="flex items-center space-x-3">
          <span class="text-xs font-black bg-red-700 text-white px-2.5 py-0.5 rounded-md tracking-wider">RELANT HR</span>
          <h2 class="text-lg font-black tracking-tight">Vacaciones, Permisos e Incidencias</h2>
        </div>

        <!-- 🏖️ TARJETA DÍAS DISPONIBLES DE VACACIONES -->
        <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'" class="border px-4 py-1.5 rounded-2xl flex items-center gap-3">
          <span class="text-xl">🏖️</span>
          <div class="text-left">
            <span class="text-[10px] uppercase font-bold text-red-500 block leading-tight">Días de Vacaciones Disponibles</span>
            <span class="text-sm font-black font-mono" :class="esModoOscuro ? 'text-white' : 'text-slate-800'">{{ usuarioActual?.diasVacaciones ?? '--' }} días</span>
          </div>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto p-6 space-y-8 max-w-7xl mx-auto w-full pb-24">

        <!-- 📅 MÓDULO SOLICITUD DE PERMISO / VACACIONES -->
        <section :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-800 shadow-xl'" class="rounded-3xl border p-8 relative">
          
          <form @submit.prevent="enviarFormulario" class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            <!-- COLUMNA IZQUIERDA: CALENDARIO INTERACTIVO -->
            <div class="lg:col-span-5 space-y-4 border-r pr-0 lg:pr-6" :class="esModoOscuro ? 'border-zinc-800' : 'border-slate-200/60'">
              <div class="flex justify-between items-center">
                <h3 class="font-bold text-lg" :class="esModoOscuro ? 'text-white' : 'text-slate-800'">{{ mesActual }}</h3>
                <div class="flex items-center gap-1">
                  <button type="button" :class="esModoOscuro ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'" class="font-bold px-3 py-1 rounded-lg text-xs cursor-pointer">Hoy</button>
                  <button type="button" :class="esModoOscuro ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'" class="font-bold px-2 py-1 rounded-lg text-xs cursor-pointer">❮</button>
                  <button type="button" :class="esModoOscuro ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'" class="font-bold px-2 py-1 rounded-lg text-xs cursor-pointer">❯</button>
                </div>
              </div>

              <!-- GRILLA DÍAS SEMANA -->
              <div class="grid grid-cols-7 gap-1 text-center font-bold text-xs pb-2" :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-600'">
                <span>Do</span><span>Lu</span><span>Ma</span><span>Mi</span><span>Ju</span><span>Vi</span><span>Sa</span>
              </div>

              <!-- GRILLA DÍAS DEL MES -->
              <div class="grid grid-cols-7 gap-1 text-center text-xs font-semibold">
                <div 
                  v-for="(item, idx) in diasCalendario" 
                  :key="idx" 
                  @click="seleccionarDia(item)"
                  :class="[
                    item.otroMes ? (esModoOscuro ? 'text-zinc-700' : 'text-slate-300') : (esModoOscuro ? 'text-zinc-200 hover:bg-zinc-800 cursor-pointer' : 'text-slate-700 hover:bg-red-50 cursor-pointer'),
                    item.seleccionado ? 'bg-red-700 text-white font-bold rounded-lg shadow-md hover:bg-red-800' : ''
                  ]"
                  class="py-2.5 transition-all"
                >
                  {{ item.dia }}
                </div>
              </div>
            </div>

            <!-- COLUMNA DERECHA: FORMULARIO OPCIONES Y CATEGORÍAS -->
            <div class="lg:col-span-7 space-y-5 text-left">
              
              <!-- SELECCIÓN RADIO DE DURACIÓN DEL DÍA -->
              <div class="flex flex-wrap gap-6 items-center pt-1">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" v-model="duracionDia" value="DIA_COMPLETO" class="w-4 h-4 accent-red-600" />
                  <span class="text-xs font-bold" :class="esModoOscuro ? 'text-zinc-300' : 'text-slate-700'">Día completo</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" v-model="duracionDia" value="PRIMERA_MITAD" class="w-4 h-4 accent-red-600" />
                  <span class="text-xs font-bold" :class="esModoOscuro ? 'text-zinc-300' : 'text-slate-700'">Primera mitad</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" v-model="duracionDia" value="SEGUNDA_MITAD" class="w-4 h-4 accent-red-600" />
                  <span class="text-xs font-bold" :class="esModoOscuro ? 'text-zinc-300' : 'text-slate-700'">Segunda mitad</span>
                </label>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- TIPO DE PERMISO -->
                <div>
                  <label class="text-xs font-bold block mb-1" :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-700'">Tipo de Permiso <span class="text-red-500">*</span></label>
                  <select v-model="tipoPermiso" required :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-slate-300 text-slate-800'" class="w-full p-3 text-xs rounded-xl border focus:outline-none font-medium">
                    <option value="Licencia No Pagada" :class="esModoOscuro ? 'bg-zinc-900' : ''">Licencia No Pagada</option>
                    <option value="Licencia Con Goce de Sueldo" :class="esModoOscuro ? 'bg-zinc-900' : ''">Licencia Con Goce de Sueldo</option>
                    <option value="Permiso Médico / Especial" :class="esModoOscuro ? 'bg-zinc-900' : ''">Permiso Médico / Especial</option>
                  </select>
                </div>

                <!-- CATEGORÍA -->
                <div>
                  <label class="text-xs font-bold block mb-1" :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-700'">Categoría <span class="text-red-500">*</span></label>
                  <select v-model="categoria" required :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-slate-300 text-slate-800'" class="w-full p-3 text-xs rounded-xl border focus:outline-none font-medium">
                    <option value="VACACIONES" :class="esModoOscuro ? 'bg-zinc-900' : ''">Vacaciones</option>
                    <option value="ENFERMEDAD" :class="esModoOscuro ? 'bg-zinc-900' : ''">Enfermedad</option>
                    <option value="INCAPACIDAD" :class="esModoOscuro ? 'bg-zinc-900' : ''">Incapacidad</option>
                    <option value="PERSONAL" :class="esModoOscuro ? 'bg-zinc-900' : ''">Personal</option>
                    <option value="MATERNIDAD_PATERNIDAD" :class="esModoOscuro ? 'bg-zinc-900' : ''">Maternidad / Paternidad</option>
                  </select>
                </div>
              </div>

              <!-- DÍAS -->
              <div>
                <label class="text-xs font-bold block mb-1" :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-700'">Días <span class="text-red-500">*</span></label>
                <input v-model.number="numDias" type="number" step="0.5" min="0.5" required :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-slate-300 text-slate-800'" class="w-full p-3 text-xs rounded-xl border font-bold focus:outline-none" />
              </div>

              <!-- MOTIVO DE SOLICITUD -->
              <div>
                <label class="text-xs font-bold block mb-1" :class="esModoOscuro ? 'text-zinc-400' : 'text-slate-700'">Motivo de solicitud</label>
                <textarea v-model="motivoSolicitud" rows="3" required placeholder="Escribe la justificación..." :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white placeholder-zinc-600' : 'bg-white border-slate-300 text-slate-800'" class="w-full p-3 text-xs rounded-xl border focus:outline-none"></textarea>
              </div>

              <!-- BOTONES CONFIRMAR Y CANCELAR -->
              <div class="flex justify-end gap-3 pt-2">
                <button type="button" @click="motivoSolicitud = ''" :class="esModoOscuro ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700' : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300'" class="font-bold text-xs px-6 py-2.5 rounded-xl border cursor-pointer transition">
                  Cancelar
                </button>
                <button type="submit" :disabled="enviandoSolicitud" class="bg-red-700 hover:bg-red-800 text-white font-black text-xs px-8 py-2.5 rounded-xl shadow-md cursor-pointer disabled:opacity-50 transition">
                  {{ enviandoSolicitud ? '⏳ Enviando...' : 'Confirmar' }}
                </button>
              </div>

            </div>

          </form>
        </section>

        <!-- 📋 BITÁCORA Y EVALUACIÓN DE SOLICITUDES -->
        <section class="space-y-4 text-left">
          <h3 class="text-xs font-black uppercase tracking-wider text-zinc-400">📋 Solicitudes e Historial de Permisos</h3>

          <div v-if="loading" class="text-xs text-zinc-500 animate-pulse">Cargando solicitudes...</div>
          <div v-else class="space-y-3">
            <div 
              v-for="s in solicitudes" 
              :key="s.id" 
              :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'" 
              class="rounded-2xl border p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div class="space-y-1 text-left">
                <div class="flex items-center gap-2">
                  <span class="font-black text-sm">{{ s.categoria }} ({{ s.tipoPermiso }})</span>
                  <span 
                    :class="{
                      'bg-amber-500/20 text-amber-400 border-amber-500/30': s.estado === 'PENDIENTE',
                      'bg-emerald-500/20 text-emerald-400 border-emerald-500/30': s.estado === 'APROBADO',
                      'bg-red-500/20 text-red-400 border-red-500/30': s.estado === 'RECHAZADO'
                    }"
                    class="text-[10px] font-bold px-2 py-0.5 rounded uppercase border"
                  >
                    {{ s.estado }}
                  </span>
                </div>
                <p class="text-xs text-zinc-400">👤 Solicitante: <strong :class="esModoOscuro ? 'text-white' : 'text-slate-800'">{{ s.solicitante?.nombre }}</strong> ({{ s.solicitante?.email }})</p>
                <div class="text-[11px] font-mono text-zinc-400 pt-0.5">
                  📅 Fecha Inicio: <strong>{{ s.fechaInicio }}</strong> | Días: <strong>{{ s.numDias }} día(s)</strong> | Duración: <strong>{{ s.duracionDia }}</strong>
                </div>
                <p class="text-xs italic text-zinc-400 pt-1">💬 Motivo: {{ s.motivo }}</p>
              </div>

              <!-- BOTONES APROBAR/RECHAZAR PARA ADMIN/JEFE/OWNER -->
              <div v-if="esAdminOJefe && s.estado === 'PENDIENTE'" class="shrink-0 flex gap-2">
                <button @click="evaluarSolicitud(s.id, true)" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer">
                  ✓ Aprobar
                </button>
                <button @click="evaluarSolicitud(s.id, false)" class="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer">
                  ✕ Rechazar
                </button>
              </div>
            </div>
          </div>
        </section>

      </main>

      <button 
        @click="toggleTema" 
        :class="esModoOscuro ? 'bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800' : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'"
        class="fixed bottom-6 right-6 z-40 px-4 py-2.5 rounded-2xl border shadow-2xl text-xs font-black flex items-center gap-2 cursor-pointer transition-all hover:scale-105"
        title="Cambiar tema de la aplicación"
      >
        <span>{{ esModoOscuro ? '☀️' : '🌙' }}</span>
        <span>{{ esModoOscuro ? 'Claro' : 'Oscuro' }}</span>
      </button>

    </div>
  </div>
</template>