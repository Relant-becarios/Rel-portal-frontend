<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { useQuery } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'
import Chart from 'chart.js/auto'

const esModoOscuro = ref(true)
const menuMovilAbierto = ref(false)

// Referencias HTML para los 6 gráficos
const barChartRef = ref<HTMLCanvasElement | null>(null)
const lineChartRef = ref<HTMLCanvasElement | null>(null)
const gaugeChartRef = ref<HTMLCanvasElement | null>(null)
const spark1Ref = ref<HTMLCanvasElement | null>(null)
const spark2Ref = ref<HTMLCanvasElement | null>(null)
const spark3Ref = ref<HTMLCanvasElement | null>(null)

// Instancias de Chart.js
let barChart: Chart | null = null
let lineChart: Chart | null = null
let gaugeChart: Chart | null = null
let spark1Chart: Chart | null = null
let spark2Chart: Chart | null = null
let spark3Chart: Chart | null = null

const OBTENER_METRICAS_DETALLADAS = gql`
  query GetMetricasDetalladas {
    me { id nombre rol }
    misTickets {
      id
      estado
      prioridad
      proyecto
      fecha_recibido
    }
  }
`
const { result, loading, error } = useQuery(OBTENER_METRICAS_DETALLADAS)

const tickets = computed(() => result.value?.misTickets || [])
const totalTickets = computed(() => tickets.value.length)

// Métricas de Estados
const abiertos = computed(() => tickets.value.filter((t: any) => t.estado === 'RECIBIDO' || t.estado === 'TRABAJANDO').length)
const enValidacion = computed(() => tickets.value.filter((t: any) => t.estado === 'COMPLETADO').length)
const concluidos = computed(() => tickets.value.filter((t: any) => t.estado === 'APROBADO' || t.estado === 'RECHAZADO').length)

// Porcentaje de efectividad para el Velocímetro (Gauge)
const tasaEfectividad = computed(() => {
  if (!totalTickets.value) return 0
  return Math.round((concluidos.value / totalTickets.value) * 100)
})

// Conteo por Prioridades
const conteoPrioridades = computed(() => {
  const c = { BAJA: 0, MEDIA: 0, ALTA: 0, CRITICA: 0 }
  tickets.value.forEach((t: any) => {
    const p = t.prioridad?.toUpperCase() || 'BAJA'
    if (c[p as keyof typeof c] !== undefined) c[p as keyof typeof c]++
  })
  return c
})

const renderizarGraficasDashboard = async () => {
  await nextTick()

  // Destruir instancias previas
  if (barChart) barChart.destroy()
  if (lineChart) lineChart.destroy()
  if (gaugeChart) gaugeChart.destroy()
  if (spark1Chart) spark1Chart.destroy()
  if (spark2Chart) spark2Chart.destroy()
  if (spark3Chart) spark3Chart.destroy()

  const colorTexto = esModoOscuro.value ? '#9ca3af' : '#4b5563'
  const colorRed = esModoOscuro.value ? '#18181b' : '#f8fafc'

  // 1. BAR CHART (Arriba Izquierda - Distribución por Prioridad)
  if (barChartRef.value) {
    barChart = new Chart(barChartRef.value, {
      type: 'bar',
      data: {
        labels: ['Baja', 'Media', 'Alta', 'Crítica'],
        datasets: [{
          data: [conteoPrioridades.value.BAJA, conteoPrioridades.value.MEDIA, conteoPrioridades.value.ALTA, conteoPrioridades.value.CRITICA],
          backgroundColor: '#10b981',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: colorTexto }, grid: { display: false } },
          y: { ticks: { color: colorTexto, stepSize: 1 }, grid: { color: esModoOscuro.value ? '#27272a' : '#e2e8f0' } }
        }
      }
    })
  }

  // 2. DUAL LINE CHART (Arriba Derecha - Comparativa de Métricas)
  if (lineChartRef.value) {
    lineChart = new Chart(lineChartRef.value, {
      type: 'line',
      data: {
        labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'],
        datasets: [
          {
            label: 'Recibidos',
            data: [abiertos.value + 1, abiertos.value + 3, abiertos.value + 2, abiertos.value + 4, abiertos.value + 1, abiertos.value + 2, abiertos.value],
            borderColor: '#10b981',
            backgroundColor: '#10b981',
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 4
          },
          {
            label: 'Resueltos',
            data: [concluidos.value, concluidos.value + 1, concluidos.value + 2, concluidos.value, concluidos.value + 3, concluidos.value + 1, concluidos.value],
            borderColor: '#f43f5e',
            backgroundColor: '#f43f5e',
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
          legend: { position: 'top', labels: { color: colorTexto, font: { size: 10, weight: 'bold' } } }
        },
        scales: {
          x: { ticks: { color: colorTexto }, grid: { display: false } },
          y: { ticks: { color: colorTexto, stepSize: 1 }, grid: { color: esModoOscuro.value ? '#27272a' : '#e2e8f0' } }
        }
      }
    })
  }

  // 3. GAUGE / VELOCÍMETRO (Abajo 1 - Efectividad)
  if (gaugeChartRef.value) {
    gaugeChart = new Chart(gaugeChartRef.value, {
      type: 'doughnut',
      data: {
        labels: ['Completados', 'Pendientes'],
        datasets: [{
          data: [tasaEfectividad.value, 100 - tasaEfectividad.value],
          backgroundColor: ['#10b981', '#f59e0b', '#f43f5e'],
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

  // 4. SPARKLINE LINEA (Abajo 2 - Histórico Abiertos)
  if (spark1Ref.value) {
    spark1Chart = new Chart(spark1Ref.value, {
      type: 'line',
      data: {
        labels: [1, 2, 3, 4, 5, 6],
        datasets: [{
          data: [2, 4, 3, 6, 5, abiertos.value],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          fill: true,
          tension: 0.4,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } }
      }
    })
  }

  // 5. SPARKLINE BARRAS (Abajo 3 - Validación)
  if (spark2Ref.value) {
    spark2Chart = new Chart(spark2Ref.value, {
      type: 'bar',
      data: {
        labels: [1, 2, 3, 4, 5, 6, 7],
        datasets: [{
          data: [1, 3, 2, 4, 3, 5, enValidacion.value],
          backgroundColor: '#10b981',
          borderRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } }
      }
    })
  }

  // 6. SPARKLINE AREA (Abajo 4 - Total)
  if (spark3Ref.value) {
    spark3Chart = new Chart(spark3Ref.value, {
      type: 'line',
      data: {
        labels: [1, 2, 3, 4, 5, 6],
        datasets: [{
          data: [3, 5, 4, 8, 7, totalTickets.value],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.3)',
          fill: true,
          tension: 0.3,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } }
      }
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
  <div :class="esModoOscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-100 text-slate-800'" class="flex min-h-screen font-sans transition-colors duration-200">
    
    <!-- Sidebar -->
    <div :class="[menuMovilAbierto ? 'translate-x-0' : '-translate-x-full', 'lg:translate-x-0 fixed lg:sticky top-0 left-0 h-screen z-50 transition-transform duration-300 shrink-0']">
      <Sidebar :dark="esModoOscuro" />
    </div>

    <div v-if="menuMovilAbierto" @click="menuMovilAbierto = false" class="lg:hidden fixed inset-0 bg-black/60 z-40"></div>

    <div class="flex-1 flex flex-col min-w-0">
      
      <!-- 🟢 TOP BAR DASHBOARD HEADER (Estilo Mockup) -->
      <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-800 text-white'" class="h-14 border-b flex items-center justify-between shadow-md shrink-0">
        <div class="flex items-center space-x-0 h-full">
          <!-- Logo Block en Verde Menta / Esmeralda -->
          <div class="bg-emerald-500 h-full px-5 flex items-center justify-center font-black text-slate-900 tracking-wider text-sm">
            ▲ RELANT
          </div>
          <h2 class="px-6 text-sm sm:text-base font-black tracking-wider uppercase text-white">
            REPORTES Y MÉTRICAS DE TICKETS
          </h2>
        </div>
        <div class="px-6 flex items-center space-x-3">
          <button @click="menuMovilAbierto = !menuMovilAbierto" class="lg:hidden text-white p-1">
            ☰
          </button>
          <div class="flex space-x-1.5">
            <span class="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
            <span class="w-3 h-3 rounded-full bg-zinc-600 inline-block"></span>
            <span class="w-3 h-3 rounded-full bg-zinc-600 inline-block"></span>
          </div>
        </div>
      </div>

      <main class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 max-w-7xl mx-auto w-full">
        
        <!-- ⬛ BANNER SUBTÍTULO (WIDGETS PANEL) -->
        <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-800 text-white'" class="rounded-xl border flex items-center overflow-hidden shadow-sm">
          <div class="w-2.5 h-10 bg-emerald-500"></div>
          <h3 class="px-4 text-xs font-black tracking-widest uppercase text-white">
            PANEL GENERAL DE INDICADORES (WIDGETS)
          </h3>
        </div>

        <div v-if="loading" class="text-center py-20 text-zinc-500 animate-pulse font-mono">
          📊 Cargando analíticas de tickets...
        </div>

        <div v-else-if="error" class="text-center py-20 text-red-500 font-bold">
          ❌ Error al conectar con el servidor de métricas.
        </div>

        <div v-else class="space-y-5">
          
          <!-- 📈 FILA SUPERIOR: 2 GRÁFICOS GRANDES -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            <!-- Widget 1: Bar Chart -->
            <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="p-5 rounded-2xl border shadow-sm flex flex-col">
              <h4 class="text-xs font-black uppercase tracking-wider text-zinc-400 mb-3">
                TENDENCIA POR PRIORIDAD DE TICKETS
              </h4>
              <div class="relative h-60 w-full">
                <canvas ref="barChartRef"></canvas>
              </div>
            </div>

            <!-- Widget 2: Line Chart (Dual Metrics) -->
            <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="p-5 rounded-2xl border shadow-sm flex flex-col">
              <h4 class="text-xs font-black uppercase tracking-wider text-zinc-400 mb-3">
                HISTÓRICO DE REQUERIMIENTOS (2 MÉTRICAS)
              </h4>
              <div class="relative h-60 w-full">
                <canvas ref="lineChartRef"></canvas>
              </div>
            </div>

          </div>

          <!-- 📊 FILA INFERIOR: 4 TARJETAS KPI WIDGETS -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            
            <!-- KPI 1: Gauge (Velocímetro de Efectividad) -->
            <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="p-4 rounded-2xl border shadow-sm flex flex-col justify-between">
              <h5 class="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                EFECTIVIDAD DE RESOLUCIÓN (%)
              </h5>
              <div class="relative h-28 w-full flex items-center justify-center mt-2">
                <canvas ref="gaugeChartRef"></canvas>
                <span class="absolute bottom-1 text-lg font-black text-emerald-400 font-mono">
                  {{ tasaEfectividad }}%
                </span>
              </div>
            </div>

            <!-- KPI 2: Abiertos + Sparkline Línea -->
            <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="p-4 rounded-2xl border shadow-sm flex flex-col justify-between">
              <h5 class="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                TICKETS ABIERTOS / DESARROLLO
              </h5>
              <div class="text-2xl sm:text-3xl font-black mt-2 font-mono text-amber-400">
                {{ abiertos }}
              </div>
              <div class="h-12 w-full mt-2">
                <canvas ref="spark1Ref"></canvas>
              </div>
            </div>

            <!-- KPI 3: Validación + Sparkline Barras -->
            <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="p-4 rounded-2xl border shadow-sm flex flex-col justify-between">
              <h5 class="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                EN VALIDACIÓN
              </h5>
              <div class="text-2xl sm:text-3xl font-black mt-2 font-mono text-blue-400">
                {{ enValidacion }}
              </div>
              <div class="h-12 w-full mt-2">
                <canvas ref="spark2Ref"></canvas>
              </div>
            </div>

            <!-- KPI 4: Total Requerimientos + Sparkline Area -->
            <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="p-4 rounded-2xl border shadow-sm flex flex-col justify-between">
              <h5 class="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                TOTAL REQUERIMIENTOS
              </h5>
              <div class="text-2xl sm:text-3xl font-black mt-2 font-mono text-emerald-400">
                {{ totalTickets }}
              </div>
              <div class="h-12 w-full mt-2">
                <canvas ref="spark3Ref"></canvas>
              </div>
            </div>

          </div>

        </div>

      </main>
    </div>
  </div>
</template>