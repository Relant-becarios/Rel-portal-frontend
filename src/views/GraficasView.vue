<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { useQuery } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'
import { useRouter } from 'vue-router'
import Chart from 'chart.js/auto'

const router = useRouter()
const esModoOscuro = ref(true)

const toggleTema = () => {
  esModoOscuro.value = !esModoOscuro.value
  localStorage.setItem('relant_theme', esModoOscuro.value ? 'oscuro' : 'claro')
  renderizarGraficasDashboard()
}

// Canvas
const barChartRef = ref<HTMLCanvasElement | null>(null)
const lineChartRef = ref<HTMLCanvasElement | null>(null)
const gaugeCalidadRef = ref<HTMLCanvasElement | null>(null)
const gaugeSlaRef = ref<HTMLCanvasElement | null>(null)
const spark1Ref = ref<HTMLCanvasElement | null>(null)
const spark2Ref = ref<HTMLCanvasElement | null>(null)

let barChart: Chart | null = null
let lineChart: Chart | null = null
let gaugeCalidad: Chart | null = null
let gaugeSla: Chart | null = null
let spark1Chart: Chart | null = null
let spark2Chart: Chart | null = null

const OBTENER_METRICAS_DETALLADAS = gql`
  query GetMetricasDetalladas {
    me { id nombre email rol fotoUrl }
    misTickets {
      id
      estado
      prioridad
      proyecto
      fecha_recibido
      fecha_completado
      fecha_evaluacion
      horasEstimadas
      devoluciones
    }
  }
`
const { result, loading } = useQuery(OBTENER_METRICAS_DETALLADAS)

const tickets = computed(() => result.value?.misTickets || [])
const totalTickets = computed(() => tickets.value.length)

const abiertos = computed(() => tickets.value.filter((t: any) => t.estado === 'RECIBIDO' || t.estado === 'TRABAJANDO').length)
const concluidos = computed(() => tickets.value.filter((t: any) => t.estado === 'APROBADO' || t.estado === 'RECHAZADO').length)

// Eficiencia de Calidad
const eficienciaCalidad = computed(() => {
  if (!totalTickets.value) return 100
  let totalDevoluciones = 0
  tickets.value.forEach((t: any) => { totalDevoluciones += (t.devoluciones || 0) })
  const penalizacion = (totalDevoluciones / totalTickets.value) * 15
  return Math.max(0, Math.round(100 - penalizacion))
})

// Eficiencia de Tiempos (SLA)
const eficienciaSlaTiempos = computed(() => {
  const concluidosList = tickets.value.filter((t: any) => t.fecha_completado)
  if (!concluidosList.length) return 100

  let aTiempoCount = 0
  concluidosList.forEach((t: any) => {
    const inicio = new Date(t.fecha_recibido).getTime()
    const fin = new Date(t.fecha_completado).getTime()
    const horasUsadas = (fin - inicio) / (1000 * 60 * 60)
    const horasLimite = t.horasEstimadas || 10

    if (horasUsadas <= horasLimite) {
      aTiempoCount++
    }
  })

  return Math.round((aTiempoCount / concluidosList.length) * 100)
})

const conteoPrioridades = computed(() => {
  const c = { BAJA: 0, MEDIA: 0, ALTA: 0, CRITICA: 0 }
  tickets.value.forEach((t: any) => {
    const p = t.prioridad?.toUpperCase() || 'BAJA'
    if (c[p as keyof typeof c] !== undefined) c[p as keyof typeof c]++
  })
  return c
})

// 📅 LÓGICA DE DÍAS REALES DE LA ÚLTIMA SEMANA
const datosGrafica7Dias = computed(() => {
  const diasEtiquetas: string[] = []
  const ingresadosPorDia: number[] = [0, 0, 0, 0, 0, 0, 0]
  const resueltosPorDia: number[] = [0, 0, 0, 0, 0, 0, 0]

  const hoy = new Date()

  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(hoy.getDate() - i)
    const diaMes = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
    diasEtiquetas.push(diaMes)
  }

  tickets.value.forEach((t: any) => {
    if (t.fecha_recibido) {
      const fechaT = new Date(isNaN(Number(t.fecha_recibido)) ? t.fecha_recibido : Number(t.fecha_recibido))
      const diffDias = Math.floor((hoy.getTime() - fechaT.getTime()) / (1000 * 3600 * 24))
      if (diffDias >= 0 && diffDias < 7) {
        const index = 6 - diffDias
        ingresadosPorDia[index] = (ingresadosPorDia[index] ?? 0) + 1
      }
    }

    const fechaFinStr = t.fecha_evaluacion || t.fecha_completado
    if (fechaFinStr && (t.estado === 'APROBADO' || t.estado === 'COMPLETADO')) {
      const fechaFin = new Date(isNaN(Number(fechaFinStr)) ? fechaFinStr : Number(fechaFinStr))
      const diffDiasFin = Math.floor((hoy.getTime() - fechaFin.getTime()) / (1000 * 3600 * 24))
      if (diffDiasFin >= 0 && diffDiasFin < 7) {
        const idx = 6 - diffDiasFin
        resueltosPorDia[idx] = (resueltosPorDia[idx] ?? 0) + 1
      }
    }
  })

  return { labels: diasEtiquetas, ingresados: ingresadosPorDia, resueltos: resueltosPorDia }
})

const renderizarGraficasDashboard = async () => {
  await nextTick()

  if (barChart) barChart.destroy()
  if (lineChart) lineChart.destroy()
  if (gaugeCalidad) gaugeCalidad.destroy()
  if (gaugeSla) gaugeSla.destroy()
  if (spark1Chart) spark1Chart.destroy()
  if (spark2Chart) spark2Chart.destroy()

  const colorTexto = esModoOscuro.value ? '#a1a1aa' : '#475569'
  const colorGrid = esModoOscuro.value ? '#27272a' : '#e2e8f0'

  // BAR CHART: PRIORIDAD
  if (barChartRef.value) {
    barChart = new Chart(barChartRef.value, {
      type: 'bar',
      data: {
        labels: ['🟢 Baja', '🔵 Media', '🟡 Alta', '🔴 Crítica'],
        datasets: [{
          data: [conteoPrioridades.value.BAJA, conteoPrioridades.value.MEDIA, conteoPrioridades.value.ALTA, conteoPrioridades.value.CRITICA],
          backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: colorTexto, font: { weight: 'bold' } }, grid: { display: false } },
          y: { ticks: { color: colorTexto, stepSize: 1 }, grid: { color: colorGrid } }
        }
      }
    })
  }

  // DUAL LINE CHART: DÍAS REALES DE LA ÚLTIMA SEMANA
  if (lineChartRef.value) {
    lineChart = new Chart(lineChartRef.value, {
      type: 'line',
      data: {
        labels: datosGrafica7Dias.value.labels,
        datasets: [
          {
            label: 'Ingresados',
            data: datosGrafica7Dias.value.ingresados,
            borderColor: '#ef4444',
            backgroundColor: '#ef4444',
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 4
          },
          {
            label: 'Resueltos',
            data: datosGrafica7Dias.value.resueltos,
            borderColor: '#10b981',
            backgroundColor: '#10b981',
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: colorTexto, font: { size: 11, weight: 'bold' } } }
        },
        scales: {
          x: { ticks: { color: colorTexto }, grid: { display: false } },
          y: { ticks: { color: colorTexto, stepSize: 1 }, grid: { color: colorGrid } }
        }
      }
    })
  }

  // GAUGE CALIDAD
  if (gaugeCalidadRef.value) {
    gaugeCalidad = new Chart(gaugeCalidadRef.value, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [eficienciaCalidad.value, Math.max(0, 100 - eficienciaCalidad.value)],
          backgroundColor: ['#10b981', '#ef4444'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        circumference: 180,
        rotation: -90,
        cutout: '75%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } }
      }
    })
  }

  // GAUGE SLA
  if (gaugeSlaRef.value) {
    gaugeSla = new Chart(gaugeSlaRef.value, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [eficienciaSlaTiempos.value, Math.max(0, 100 - eficienciaSlaTiempos.value)],
          backgroundColor: ['#3b82f6', '#f59e0b'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        circumference: 180,
        rotation: -90,
        cutout: '75%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } }
      }
    })
  }

  // SPARKINES
  if (spark1Ref.value) {
    spark1Chart = new Chart(spark1Ref.value, {
      type: 'line',
      data: { labels: [1,2,3,4,5], datasets: [{ data: [2,4,3,6,abiertos.value], borderColor: '#f59e0b', fill: false }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
    })
  }

  if (spark2Ref.value) {
    spark2Chart = new Chart(spark2Ref.value, {
      type: 'line',
      data: { labels: [1,2,3,4,5], datasets: [{ data: [1,3,2,5,totalTickets.value], borderColor: '#ef4444', fill: false }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
    })
  }
}

watch(tickets, () => { renderizarGraficasDashboard() }, { deep: true })

onMounted(() => {
  const temaGuardado = localStorage.getItem('relant_theme')
  esModoOscuro.value = temaGuardado ? temaGuardado === 'oscuro' : true
  renderizarGraficasDashboard()
})
</script>

<template>
  <div :class="esModoOscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'" class="flex h-screen overflow-hidden font-sans transition-colors duration-200">
    
    <!-- Sidebar Fija -->
    <Sidebar :dark="esModoOscuro" />

    <div class="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
      
      <!-- HEADER CON TARJETA DE PERFIL (TOP-RIGHT) -->
      <header :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="h-16 border-b px-4 sm:px-8 flex justify-between items-center shrink-0">
        <div class="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <span class="text-[10px] sm:text-xs font-black bg-red-700 text-white px-2 py-0.5 rounded-md tracking-wider">RELANT HQ</span>
          <h2 class="text-sm sm:text-lg font-black tracking-tight truncate">Indicadores de Eficiencia</h2>
        </div>

        <!-- 👤 TARJETA DE PERFIL INTEGRADA -->
        <div 
          @click="router.push('/perfil')" 
          :class="esModoOscuro ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800/80 text-white' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800'"
          class="flex items-center space-x-3 px-3 py-1.5 rounded-2xl border cursor-pointer transition-all shadow-sm group"
          title="Ver y Configurar mi Perfil"
        >
          <div class="w-8 h-8 rounded-full overflow-hidden border-2 border-red-600 bg-zinc-800 flex items-center justify-center shrink-0 shadow-sm">
            <img v-if="result?.me?.fotoUrl" :src="result.me.fotoUrl" alt="Avatar" class="w-full h-full object-cover" />
            <span v-else class="text-xs font-black text-white">
              {{ result?.me?.nombre?.charAt(0).toUpperCase() || '👤' }}
            </span>
          </div>

          <div class="hidden sm:flex flex-col text-left min-w-0">
            <span class="text-xs font-bold truncate group-hover:text-red-500 transition-colors">
              {{ result?.me?.nombre || 'Mi Perfil' }}
            </span>
            <span class="text-[9px] font-mono text-emerald-500 font-bold leading-none">
              ● Operador Activo
            </span>
          </div>
        </div>
      </header>

      <!-- 📌 CONTENEDOR CON SCROLL AL BORDE DERECHO -->
      <div class="flex-1 overflow-y-auto w-full">
        <main class="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full pb-24">
          
          <div v-if="loading" class="text-center py-20 text-zinc-500 animate-pulse font-mono text-sm">
            📊 Calculando indicadores operacionales...
          </div>

          <div v-else class="space-y-6">
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'" class="p-5 sm:p-6 rounded-2xl border flex flex-col">
                <h3 class="text-xs font-black uppercase tracking-wider text-zinc-400 mb-4">
                  Distribución por Prioridad
                </h3>
                <div class="relative h-64 w-full">
                  <canvas ref="barChartRef"></canvas>
                </div>
              </div>

              <!-- 📅 GRÁFICA REAL DE ÚLTIMOS 7 DÍAS -->
              <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'" class="p-5 sm:p-6 rounded-2xl border flex flex-col">
                <h3 class="text-xs font-black uppercase tracking-wider text-zinc-400 mb-4">
                  Últimos 7 Días: Ingresados vs Resueltos
                </h3>
                <div class="relative h-64 w-full">
                  <canvas ref="lineChartRef"></canvas>
                </div>
              </div>

            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              
              <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'" class="p-5 rounded-2xl border flex flex-col justify-between">
                <h4 class="text-[10px] font-black uppercase tracking-wider text-emerald-500">
                  🎯 Eficiencia de Calidad
                </h4>
                <div class="relative h-28 w-full flex items-center justify-center mt-2">
                  <canvas ref="gaugeCalidadRef"></canvas>
                  <span class="absolute bottom-1 text-lg font-black text-emerald-500 font-mono">
                    {{ eficienciaCalidad }}%
                  </span>
                </div>
              </div>

              <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'" class="p-5 rounded-2xl border flex flex-col justify-between">
                <h4 class="text-[10px] font-black uppercase tracking-wider text-blue-500">
                  ⏱️ Eficiencia de Tiempo (SLA)
                </h4>
                <div class="relative h-28 w-full flex items-center justify-center mt-2">
                  <canvas ref="gaugeSlaRef"></canvas>
                  <span class="absolute bottom-1 text-lg font-black text-blue-500 font-mono">
                    {{ eficienciaSlaTiempos }}%
                  </span>
                </div>
              </div>

              <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'" class="p-5 rounded-2xl border flex flex-col justify-between">
                <h4 class="text-[10px] font-black uppercase tracking-wider text-amber-500">
                  ⏳ En Desarrollo
                </h4>
                <div class="text-3xl font-black mt-2 font-mono text-amber-500">
                  {{ abiertos }}
                </div>
                <div class="h-12 w-full mt-2">
                  <canvas ref="spark1Ref"></canvas>
                </div>
              </div>

              <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'" class="p-5 rounded-2xl border flex flex-col justify-between">
                <h4 class="text-[10px] font-black uppercase tracking-wider text-red-500">
                  📋 Total Requerimientos
                </h4>
                <div class="text-3xl font-black mt-2 font-mono text-red-500">
                  {{ totalTickets }}
                </div>
                <div class="h-12 w-full mt-2">
                  <canvas ref="spark2Ref"></canvas>
                </div>
              </div>

            </div>

          </div>

        </main>
      </div>

      <!-- ☀️/🌙 BOTÓN FLOTANTE (BOTTOM-RIGHT) -->
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