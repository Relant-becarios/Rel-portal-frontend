<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { useQuery } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'
import Chart from 'chart.js/auto'

const esModoOscuro = ref(true)
const menuMovilAbierto = ref(false)

const toggleTema = () => {
  esModoOscuro.value = !esModoOscuro.value
  localStorage.setItem('relant_theme', esModoOscuro.value ? 'oscuro' : 'claro')
  renderizarGraficasDashboard()
}

// Referencias HTML para los gráficos
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

  const colorTexto = esModoOscuro.value ? '#a1a1aa' : '#475569'
  const colorGrid = esModoOscuro.value ? '#27272a' : '#e2e8f0'

  // 1. BAR CHART: Prioridad de Tickets (Verde, Azul, Ámbar, Rojo Relant)
  if (barChartRef.value) {
    barChart = new Chart(barChartRef.value, {
      type: 'bar',
      data: {
        labels: ['🟢 Baja', '🔵 Media', '🟡 Alta', '🔴 Crítica'],
        datasets: [{
          data: [
            conteoPrioridades.value.BAJA, 
            conteoPrioridades.value.MEDIA, 
            conteoPrioridades.value.ALTA, 
            conteoPrioridades.value.CRITICA
          ],
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

  // 2. DUAL LINE CHART: Comparativa de Recibidos vs Resueltos
  if (lineChartRef.value) {
    lineChart = new Chart(lineChartRef.value, {
      type: 'line',
      data: {
        labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'],
        datasets: [
          {
            label: 'Ingresados',
            data: [abiertos.value + 1, abiertos.value + 3, abiertos.value + 2, abiertos.value + 4, abiertos.value + 1, abiertos.value + 2, abiertos.value],
            borderColor: '#ef4444', // Rojo Relant
            backgroundColor: '#ef4444',
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 4
          },
          {
            label: 'Resueltos',
            data: [concluidos.value, concluidos.value + 1, concluidos.value + 2, concluidos.value, concluidos.value + 3, concluidos.value + 1, concluidos.value],
            borderColor: '#10b981', // Verde Éxito
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

  // 3. GAUGE / VELOCÍMETRO: Efectividad Relant
  if (gaugeChartRef.value) {
    gaugeChart = new Chart(gaugeChartRef.value, {
      type: 'doughnut',
      data: {
        labels: ['Completados', 'Pendientes'],
        datasets: [{
          data: [tasaEfectividad.value, Math.max(0, 100 - tasaEfectividad.value)],
          backgroundColor: ['#10b981', esModoOscuro.value ? '#27272a' : '#cbd5e1'],
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

  // 4. SPARKLINE LÍNEA: Abiertos (Ámbar)
  if (spark1Ref.value) {
    spark1Chart = new Chart(spark1Ref.value, {
      type: 'line',
      data: {
        labels: [1, 2, 3, 4, 5, 6],
        datasets: [{
          data: [2, 4, 3, 6, 5, abiertos.value],
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
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

  // 5. SPARKLINE BARRAS: Validación (Azul)
  if (spark2Ref.value) {
    spark2Chart = new Chart(spark2Ref.value, {
      type: 'bar',
      data: {
        labels: [1, 2, 3, 4, 5, 6, 7],
        datasets: [{
          data: [1, 3, 2, 4, 3, 5, enValidacion.value],
          backgroundColor: '#3b82f6',
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

  // 6. SPARKLINE ÁREA: Total Requerimientos (Rojo Relant)
  if (spark3Ref.value) {
    spark3Chart = new Chart(spark3Ref.value, {
      type: 'line',
      data: {
        labels: [1, 2, 3, 4, 5, 6],
        datasets: [{
          data: [3, 5, 4, 8, 7, totalTickets.value],
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
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
  <div :class="esModoOscuro ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'" class="flex min-h-screen font-sans transition-colors duration-200">
    
    <!-- Sidebar -->
    <div :class="[menuMovilAbierto ? 'translate-x-0' : '-translate-x-full', 'lg:translate-x-0 fixed lg:sticky top-0 left-0 h-screen z-50 transition-transform duration-300 shrink-0']">
      <Sidebar :dark="esModoOscuro" />
    </div>

    <div v-if="menuMovilAbierto" @click="menuMovilAbierto = false" class="lg:hidden fixed inset-0 bg-black/60 z-40"></div>

    <div class="flex-1 flex flex-col min-w-0 w-full">
      
      <!-- 🔴 ENCABEZADO ESTÁNDAR RELANT HQ -->
      <header :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="h-16 border-b px-4 sm:px-8 flex justify-between items-center shrink-0">
        <div class="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <button @click="menuMovilAbierto = !menuMovilAbierto" class="lg:hidden p-1.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer mr-1">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          <span class="text-[10px] sm:text-xs font-black bg-red-700 text-white px-2 py-0.5 rounded-md tracking-wider whitespace-nowrap">RELANT HQ</span>
          <h2 class="text-sm sm:text-lg font-black tracking-tight truncate">Métricas y Analítica</h2>
        </div>
        <div class="flex items-center space-x-2 sm:space-x-4">
          <button @click="toggleTema" :class="esModoOscuro ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'" class="px-2.5 sm:px-4 py-1 sm:py-2 rounded-xl border text-[10px] sm:text-xs font-semibold cursor-pointer">
            {{ esModoOscuro ? '☀️ Claro' : '🌙 Oscuro' }}
          </button>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full">
        
        <div v-if="loading" class="text-center py-20 text-zinc-500 animate-pulse font-mono text-sm">
          📊 Calculando indicadores operacionales...
        </div>

        <div v-else-if="error" class="text-center py-20 text-red-500 font-bold text-sm">
          ❌ Error al cargar los datos del servidor.
        </div>

        <div v-else class="space-y-6">
          
          <!-- 📈 FILA SUPERIOR: 2 GRÁFICOS PRINCIPALES -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <!-- Gráfica 1: Prioridad de Requerimientos -->
            <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="p-5 sm:p-6 rounded-2xl border shadow-md flex flex-col">
              <h3 class="text-xs font-black uppercase tracking-wider text-zinc-400 mb-4">
                Distribución por Prioridad de Requerimientos
              </h3>
              <div class="relative h-64 w-full">
                <canvas ref="barChartRef"></canvas>
              </div>
            </div>

            <!-- Gráfica 2: Histórico de Requerimientos -->
            <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="p-5 sm:p-6 rounded-2xl border shadow-md flex flex-col">
              <h3 class="text-xs font-black uppercase tracking-wider text-zinc-400 mb-4">
                Histórico de Ingresados vs Resueltos
              </h3>
              <div class="relative h-64 w-full">
                <canvas ref="lineChartRef"></canvas>
              </div>
            </div>

          </div>

          <!-- 📊 FILA INFERIOR: 4 TARJETAS KPI WIDGETS -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            
            <!-- KPI 1: Velocímetro de Efectividad -->
            <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="p-5 rounded-2xl border shadow-md flex flex-col justify-between">
              <h4 class="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                Tasa de Efectividad (%)
              </h4>
              <div class="relative h-28 w-full flex items-center justify-center mt-2">
                <canvas ref="gaugeChartRef"></canvas>
                <span class="absolute bottom-1 text-lg font-black text-emerald-400 font-mono">
                  {{ tasaEfectividad }}%
                </span>
              </div>
            </div>

            <!-- KPI 2: Abiertos + Sparkline Ámbar -->
            <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="p-5 rounded-2xl border shadow-md flex flex-col justify-between">
              <h4 class="text-[10px] font-black uppercase tracking-wider text-amber-400">
                ⏳ En Desarrollo / Abiertos
              </h4>
              <div class="text-3xl font-black mt-2 font-mono text-amber-500">
                {{ abiertos }}
              </div>
              <div class="h-12 w-full mt-2">
                <canvas ref="spark1Ref"></canvas>
              </div>
            </div>

            <!-- KPI 3: Validación + Sparkline Azul -->
            <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="p-5 rounded-2xl border shadow-md flex flex-col justify-between">
              <h4 class="text-[10px] font-black uppercase tracking-wider text-blue-400">
                🏁 En Validación
              </h4>
              <div class="text-3xl font-black mt-2 font-mono text-blue-500">
                {{ enValidacion }}
              </div>
              <div class="h-12 w-full mt-2">
                <canvas ref="spark2Ref"></canvas>
              </div>
            </div>

            <!-- KPI 4: Total Requerimientos + Sparkline Rojo Relant -->
            <div :class="esModoOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'" class="p-5 rounded-2xl border shadow-md flex flex-col justify-between">
              <h4 class="text-[10px] font-black uppercase tracking-wider text-red-400">
                📋 Total Requerimientos
              </h4>
              <div class="text-3xl font-black mt-2 font-mono text-red-500">
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