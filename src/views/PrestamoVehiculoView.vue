<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { useQuery, useMutation } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'

const esModoOscuro = ref(true)

// Formulario Diario de Registro / Solicitud
const vehiculoSeleccionadoId = ref('')
const justificacionUso = ref('')
const numPersonas = ref(1)
const llevaMaterial = ref(false)
const detalleMaterial = ref('')
const fechaRecepcion = ref('')
const fechaEntregaEstimada = ref('')
const comentariosOpcionales = ref('')
const archivoFotoKmIni = ref<File | null>(null)
const guardandoSolicitud = ref(false)

// Modal de Devolución
const prestamoADevolver = ref<any | null>(null)
const kmFinalDevolucion = ref<number | null>(null)
const archivoFotoKmFin = ref<File | null>(null)
const observacionesDevolucion = ref('')
const subiendoDevolucion = ref(false)

const inputKmIniRef = ref<HTMLInputElement | null>(null)
const inputKmFinRef = ref<HTMLInputElement | null>(null)

const toggleTema = () => {
  esModoOscuro.value = !esModoOscuro.value
  localStorage.setItem('relant_theme', esModoOscuro.value ? 'oscuro' : 'claro')
}

// ☁️ SUBIDA A CLOUDINARY
const subirACloudinary = async (file: File): Promise<string> => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', 'ls6wqdvy')

  const response = await fetch('https://api.cloudinary.com/v1_1/pldkd8np/image/upload', {
    method: 'POST',
    body: formData
  })

  const data = await response.json()
  return data.secure_url || ''
}

// GRAPHQL
const OBTENER_DATOS_VEHICULOS = gql`
  query GetDatosVehiculos {
    obtenerVehiculos {
      id
      nombre
      placas
      capacidadPersonas
      kilometrajeActual
      ultimoServicioKm
      fechaVerificacion
      especificaciones
      estado
      fotoUrl
    }
    obtenerPrestamosVehiculos {
      id
      justificacion
      numPersonas
      llevaMaterial
      detalleMaterial
      fechaRecepcion
      fechaEntregaEstimada
      kilometrajeInicial
      kilometrajeFinal
      fotoKilometrajeIni
      fotoKilometrajeFin
      comentarios
      estado
      vehiculo { id nombre placas kilometrajeActual }
      solicitante { id nombre email }
    }
  }
`

const SOLICITAR_VEHICULO_MUTATION = gql`
  mutation SolicitarVehiculo(
    $vehiculoId: String!,
    $justificacion: String!,
    $numPersonas: Int!,
    $llevaMaterial: Boolean,
    $detalleMaterial: String,
    $fechaRecepcion: String!,
    $fechaEntregaEstimada: String!,
    $fotoKilometrajeIni: String,
    $comentarios: String
  ) {
    solicitarVehiculo(
      vehiculoId: $vehiculoId,
      justificacion: $justificacion,
      numPersonas: $numPersonas,
      llevaMaterial: $llevaMaterial,
      detalleMaterial: $detalleMaterial,
      fechaRecepcion: $fechaRecepcion,
      fechaEntregaEstimada: $fechaEntregaEstimada,
      fotoKilometrajeIni: $fotoKilometrajeIni,
      comentarios: $comentarios
    ) { id }
  }
`

const FINALIZAR_PRESTAMO_MUTATION = gql`
  mutation FinalizarPrestamo($prestamoId: String!, $kilometrajeFinal: Int!, $fotoKilometrajeFin: String, $observaciones: String) {
    finalizarPrestamoVehiculo(prestamoId: $prestamoId, kilometrajeFinal: $kilometrajeFinal, fotoKilometrajeFin: $fotoKilometrajeFin, observaciones: $observaciones) { id }
  }
`

const ENVIAR_REPORTE_SEMANAL = gql`
  mutation EnviarReportesSemanales {
    enviarReportesSemanalesVehiculos
  }
`

const { result, loading, refetch } = useQuery(OBTENER_DATOS_VEHICULOS, null, {
  fetchPolicy: 'network-only',
  pollInterval: 4000
})

const { mutate: apiSolicitar } = useMutation(SOLICITAR_VEHICULO_MUTATION)
const { mutate: apiFinalizar } = useMutation(FINALIZAR_PRESTAMO_MUTATION)
const { mutate: apiEnviarReporteSemanal } = useMutation(ENVIAR_REPORTE_SEMANAL)

const vehiculos = computed(() => result.value?.obtenerVehiculos || [])
const prestamos = computed(() => result.value?.obtenerPrestamosVehiculos || [])

const vehiculoSeleccionadoObj = computed(() => {
  return vehiculos.value.find((v: any) => v.id === vehiculoSeleccionadoId.value)
})

const seleccionarFotoIni = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) archivoFotoKmIni.value = target.files[0]
}

const seleccionarFotoFin = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) archivoFotoKmFin.value = target.files[0]
}

const enviarSolicitud = async () => {
  if (!vehiculoSeleccionadoId.value || !justificacionUso.value || !fechaRecepcion.value || !fechaEntregaEstimada.value) {
    alert('❌ Selecciona el vehículo, ingresa la justificación y las fechas.')
    return
  }

  guardandoSolicitud.value = true
  try {
    let urlFotoKm = ''
    if (archivoFotoKmIni.value) {
      urlFotoKm = await subirACloudinary(archivoFotoKmIni.value)
    }

    await apiSolicitar({
      vehiculoId: vehiculoSeleccionadoId.value,
      justificacion: justificacionUso.value,
      numPersonas: Number(numPersonas.value),
      llevaMaterial: numPersonas.value === 1 ? llevaMaterial.value : false,
      detalleMaterial: (numPersonas.value === 1 && llevaMaterial.value) ? detalleMaterial.value : null,
      fechaRecepcion: fechaRecepcion.value,
      fechaEntregaEstimada: fechaEntregaEstimada.value,
      fotoKilometrajeIni: urlFotoKm || null,
      comentarios: comentariosOpcionales.value.trim() || null
    })

    alert('✅ Registro diario asignado correctamente.')
    vehiculoSeleccionadoId.value = ''
    justificacionUso.value = ''
    detalleMaterial.value = ''
    comentariosOpcionales.value = ''
    numPersonas.value = 1
    llevaMaterial.value = false
    archivoFotoKmIni.value = null
    refetch()
  } catch (err: any) {
    alert('Error al registrar auto: ' + err.message)
  } finally {
    guardandoSolicitud.value = false
  }
}

const procesarDevolucion = async () => {
  if (!prestamoADevolver.value || !kmFinalDevolucion.value) {
    alert('❌ Ingresa el kilometraje final.')
    return
  }

  subiendoDevolucion.value = true
  try {
    let urlFotoFin = ''
    if (archivoFotoKmFin.value) {
      urlFotoFin = await subirACloudinary(archivoFotoKmFin.value)
    }

    await apiFinalizar({
      prestamoId: prestamoADevolver.value.id,
      kilometrajeFinal: Number(kmFinalDevolucion.value),
      fotoKilometrajeFin: urlFotoFin || null,
      observaciones: observacionesDevolucion.value
    })

    alert('🏁 Devolución registrada y validada.')
    prestamoADevolver.value = null
    kmFinalDevolucion.value = null
    observacionesDevolucion.value = ''
    archivoFotoKmFin.value = null
    refetch()
  } catch (err: any) {
    alert('Error en devolución: ' + err.message)
  } finally {
    subiendoDevolucion.value = false
  }
}

const emitirReporteManual = async () => {
  try {
    await apiEnviarReporteSemanal()
    alert('📧 Reporte semanal despachado a fibanez@relant.com.mx y admon@relant.com.mx')
  } catch (e: any) {
    alert('Error enviando reporte: ' + e.message)
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
          <span class="text-xs font-black bg-red-700 text-white px-2 py-0.5 rounded-md tracking-wider">RELANT FLEET</span>
          <h2 class="text-lg font-black tracking-tight">Préstamo y Control de Vehículos</h2>
        </div>

        <button @click="emitirReporteManual" class="bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold px-4 py-2 rounded-xl border border-zinc-700 cursor-pointer">
          📧 Generar Reporte Semanal
        </button>
      </header>

      <main class="flex-1 overflow-y-auto p-6 space-y-8 max-w-7xl mx-auto w-full pb-24">
        
        <!-- 🚗 CATÁLOGO Y ESPECIFICACIONES DE VEHÍCULOS -->
        <section class="space-y-4 text-left">
          <h3 class="text-xs font-black uppercase tracking-wider text-zinc-400">🚗 Autos Registrados y Especificaciones</h3>
          
          <div v-if="loading" class="text-sm text-zinc-500 animate-pulse">Sincronizando estado de flota...</div>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div 
              v-for="v in vehiculos" 
              :key="v.id" 
              :class="[
                esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-sm',
                vehiculoSeleccionadoId === v.id ? 'ring-2 ring-red-600' : ''
              ]"
              class="rounded-2xl border p-5 space-y-3 cursor-pointer transition-all hover:scale-[1.01]"
              @click="vehiculoSeleccionadoId = v.id"
            >
              <!-- 🖼️ FOTO DEL VEHÍCULO DE CLOUDINARY -->
              <div v-if="v.fotoUrl" class="w-full h-36 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center p-2 border border-zinc-800/50">
                <img :src="v.fotoUrl" :alt="v.nombre" class="h-full object-contain hover:scale-105 transition-transform" />
              </div>

              <div class="flex justify-between items-start">
                <div>
                  <h4 class="font-black text-base">{{ v.nombre }}</h4>
                  <span class="text-[10px] font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700">Placas: {{ v.placas }}</span>
                </div>
                <span 
                  :class="{
                    'bg-emerald-500/20 text-emerald-400 border-emerald-500/30': v.estado === 'DISPONIBLE',
                    'bg-amber-500/20 text-amber-400 border-amber-500/30': v.estado === 'EN_USO',
                    'bg-red-500/20 text-red-400 border-red-500/30': v.estado === 'MANTENIMIENTO'
                  }"
                  class="text-[9px] font-bold uppercase px-2 py-0.5 rounded-md border"
                >
                  {{ v.estado }}
                </span>
              </div>

              <!-- ESPECIFICACIONES TÉCNICAS -->
              <p v-if="v.especificaciones" class="text-[11px] text-zinc-400 bg-zinc-950/40 p-2 rounded-xl border border-zinc-800/50">
                ⚙️ {{ v.especificaciones }}
              </p>

              <div class="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-zinc-800/60">
                <div>
                  <span class="text-[9px] text-zinc-500 uppercase block">Capacidad</span>
                  <span class="font-bold">👥 {{ v.capacidadPersonas }} pers.</span>
                </div>
                <div>
                  <span class="text-[9px] text-zinc-500 uppercase block">Kilometraje</span>
                  <span class="font-bold">MW {{ v.kilometrajeActual.toLocaleString() }} km</span>
                </div>
                <div class="col-span-2 pt-1">
                  <span class="text-[9px] text-zinc-500 uppercase block">Verificación Vehicular</span>
                  <span class="font-bold text-amber-400">📅 {{ v.fechaVerificacion || 'No requiere / Al día' }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 📝 FORMULARIO CON SELECCIÓN MÚLTIPLE Y JUSTIFICACIÓN -->
        <section :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'" class="rounded-3xl border overflow-hidden text-left">
          <div class="bg-red-700 p-4 text-white">
            <h3 class="text-xs font-black uppercase tracking-wider">Formulario Diario de Salida / Uso de Auto</h3>
          </div>

          <form @submit.prevent="enviarSolicitud" class="p-6 space-y-5">
            
            <!-- SELECCIÓN MÚLTIPLE TIPO BURBUJAS/EXAMEN DE VEHÍCULO -->
            <div>
              <label class="text-xs font-bold uppercase text-zinc-400 block mb-2">1. Selecciona el auto a utilizar (Opción Múltiple):</label>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <label 
                  v-for="v in vehiculos.filter((item: any) => item.estado === 'DISPONIBLE')" 
                  :key="v.id"
                  :class="[
                    vehiculoSeleccionadoId === v.id ? 'bg-red-950/80 border-red-600 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  ]"
                  class="flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all"
                >
                  <input type="radio" v-model="vehiculoSeleccionadoId" :value="v.id" name="auto_opcion" class="accent-red-600 w-4 h-4" />
                  <div class="text-xs">
                    <span class="font-bold block text-white">{{ v.nombre }}</span>
                    <span class="font-mono text-[10px]">Capacidad: {{ v.capacidadPersonas }} pers.</span>
                  </div>
                </label>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- JUSTIFICACIÓN DE USO -->
              <div>
                <label class="text-xs font-bold uppercase text-zinc-400 block mb-1">2. Justificación / Motivo de uso:</label>
                <input v-model="justificacionUso" type="text" required placeholder="Ej. Traslado a Planta Toluca para auditoría técnica" :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'" class="w-full p-3 text-xs rounded-xl border focus:outline-none" />
              </div>

              <!-- PASAJEROS -->
              <div>
                <label class="text-xs font-bold uppercase text-zinc-400 block mb-1">3. ¿Para cuántas personas será el vehículo?:</label>
                <input v-model.number="numPersonas" type="number" min="1" :max="vehiculoSeleccionadoObj?.capacidadPersonas || 10" required :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'" class="w-full p-3 text-xs rounded-xl border focus:outline-none font-bold" />
              </div>
            </div>

            <!-- SI ES 1 SOLA PERSONA -->
            <div v-if="numPersonas === 1" class="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
              <div class="flex items-center gap-3">
                <input v-model="llevaMaterial" type="checkbox" id="checkMaterial" class="w-4 h-4 accent-red-600 rounded cursor-pointer" />
                <label for="checkMaterial" class="text-xs font-bold cursor-pointer">📦 ¿Va a transportar material o carga en el viaje?</label>
              </div>

              <div v-if="llevaMaterial">
                <label class="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Especificación de material/herramientas:</label>
                <input v-model="detalleMaterial" type="text" placeholder="Ej. 2 cajas de herramientas, bobinas de cable" :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-300 text-slate-800'" class="w-full p-2.5 text-xs rounded-xl border focus:outline-none" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="text-xs font-bold uppercase text-zinc-400 block mb-1">Fecha / Hora Salida:</label>
                <input v-model="fechaRecepcion" type="datetime-local" required :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'" class="w-full p-3 text-xs rounded-xl border focus:outline-none font-mono" />
              </div>

              <div>
                <label class="text-xs font-bold uppercase text-zinc-400 block mb-1">Fecha / Hora Estimada Entrega:</label>
                <input v-model="fechaEntregaEstimada" type="datetime-local" required :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'" class="w-full p-3 text-xs rounded-xl border focus:outline-none font-mono" />
              </div>
            </div>

            <!-- FOTO DEL KILOMETRAJE ODÓMETRO INICIAL -->
            <div>
              <label class="text-xs font-bold uppercase text-zinc-400 block mb-1">📷 Foto del Odómetro / Kilometraje Inicial:</label>
              <input type="file" ref="inputKmIniRef" accept="image/*" class="hidden" @change="seleccionarFotoIni" />
              <button type="button" @click="inputKmIniRef?.click()" class="bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer">
                {{ archivoFotoKmIni ? `📷 Foto cargada: ${archivoFotoKmIni.name}` : '📷 Capturar/Adjuntar Foto del Odómetro' }}
              </button>
            </div>

            <!-- COMENTARIOS OPCIONALES -->
            <div>
              <label class="text-xs font-bold uppercase text-zinc-400 block mb-1">💬 Comentarios Adicionales (Opcional):</label>
              <textarea v-model="comentariosOpcionales" rows="2" placeholder="Cualquier detalle extra que quieras añadir..." :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'" class="w-full p-3 text-xs rounded-xl border focus:outline-none"></textarea>
            </div>

            <div class="flex justify-end pt-2">
              <button type="submit" :disabled="guardandoSolicitud" class="bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-widest px-8 py-3 rounded-xl cursor-pointer shadow-md disabled:opacity-50">
                {{ guardandoSolicitud ? '⏳ Subiendo foto y guardando...' : 'Registrar Salida de Auto' }}
              </button>
            </div>
          </form>
        </section>

        <!-- 📋 BITÁCORA DE USO -->
        <section class="space-y-4 text-left">
          <h3 class="text-xs font-black uppercase tracking-wider text-zinc-400">📋 Bitácora de Registro y Devolución</h3>

          <div class="space-y-3">
            <div v-for="p in prestamos" :key="p.id" :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'" class="rounded-2xl border p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div class="space-y-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-black text-sm">{{ p.vehiculo?.nombre }} ({{ p.vehiculo?.placas }})</span>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded uppercase border bg-zinc-800 border-zinc-700 text-zinc-300">{{ p.estado }}</span>
                </div>
                <p class="text-xs text-zinc-400">👤 Operador: <strong class="text-white">{{ p.solicitante?.nombre }}</strong> | Justificación: {{ p.justificacion }}</p>
                <div class="text-[11px] font-mono text-zinc-500 pt-1">
                  📅 Salida: {{ p.fechaRecepcion }} ➡️ Entrega Est: {{ p.fechaEntregaEstimada }}
                </div>
                <div v-if="p.comentarios" class="text-[11px] italic text-zinc-400 pt-0.5">
                  💬 Comentario: {{ p.comentarios }}
                </div>
                <div v-if="p.fotoKilometrajeIni" class="pt-1">
                  <a :href="p.fotoKilometrajeIni" target="_blank" class="text-[10px] font-bold text-red-500 underline">📷 Ver Foto Odómetro Inicial</a>
                </div>
              </div>

              <!-- REGISTRO DE KILOMETRAJE AL DEVOLVER -->
              <div v-if="p.estado === 'EN_CURSO'" class="shrink-0">
                <button @click="prestamoADevolver = p" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer">
                  🔑 Registrar Devolución / Foto Km
                </button>
              </div>
            </div>
          </div>
        </section>

      </main>

      <!-- 🔑 MODAL DE REGISTRO KILOMETRAJE FINAL -->
      <div v-if="prestamoADevolver" class="fixed inset-0 bg-zinc-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-800'" class="border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-left">
          <h3 class="text-lg font-black">Devolución de Vehículo</h3>
          <p class="text-xs text-zinc-400">Ingresa el kilometraje final y sube la foto del tablero.</p>

          <div>
            <label class="text-xs font-bold uppercase text-zinc-400 block mb-1">Kilometraje Final Odómetro:</label>
            <input v-model.number="kmFinalDevolucion" type="number" required placeholder="Ej. 45200" :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'" class="w-full p-3 text-sm rounded-xl border focus:outline-none font-bold font-mono" />
          </div>

          <div>
            <label class="text-xs font-bold uppercase text-zinc-400 block mb-1">📷 Foto del Odómetro Final:</label>
            <input type="file" ref="inputKmFinRef" accept="image/*" class="hidden" @change="seleccionarFotoFin" />
            <button type="button" @click="inputKmFinRef?.click()" class="bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer w-full">
              {{ archivoFotoKmFin ? `📷 Foto cargada: ${archivoFotoKmFin.name}` : '📷 Adjuntar Foto del Odómetro Final' }}
            </button>
          </div>

          <div>
            <label class="text-xs font-bold uppercase text-zinc-400 block mb-1">Observaciones / Entrega:</label>
            <textarea v-model="observacionesDevolucion" rows="2" placeholder="Auto limpio, tanque lleno..." :class="esModoOscuro ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'" class="w-full p-3 text-xs rounded-xl border focus:outline-none"></textarea>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button @click="prestamoADevolver = null" class="bg-zinc-800 text-zinc-300 font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer">Cancelar</button>
            <button @click="procesarDevolucion" :disabled="subiendoDevolucion" class="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase px-6 py-2.5 rounded-xl cursor-pointer disabled:opacity-50">
              {{ subiendoDevolucion ? '⏳ Registrando...' : 'Finalizar Préstamo' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ☀️/🌙 BOTÓN FLOTANTE -->
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