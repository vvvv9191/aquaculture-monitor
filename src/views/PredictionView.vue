<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { MagicStick, Refresh, Warning } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'
import PageShell from '../components/PageShell.vue'
import FuturePredictionChart from '../components/FuturePredictionChart.vue'
import { ALERT_LEVELS, getAlertLevel } from '../utils/alert'
import { useMonitorStore } from '../stores/monitor'

const store = useMonitorStore()
const route = useRoute()
const forecastData = ref(null)
const focusedMetric = ref('')
const chartRefs = ref({})
const selectedFarm = ref('')
const loading = ref(true)
const errorMessage = ref('')

const metricDefinitions = [
  { key: 'temperature', dataKey: 'temperature', label: '水温', unit: '℃', decimals: 1, color: '#35d5c5' },
  { key: 'ph', dataKey: 'ph', label: 'pH', unit: '', decimals: 2, color: '#5ca8ff' },
  { key: 'dissolvedOxygen', dataKey: 'do', label: '溶解氧', unit: 'mg/L', decimals: 2, color: '#6de2ff' },
  { key: 'ammoniaNitrogen', dataKey: 'ammonia', label: '氨氮', unit: 'mg/L', decimals: 3, color: '#f7b955' },
  { key: 'salinity', dataKey: 'salinity', label: '盐度', unit: '‰', decimals: 2, color: '#8c9eff' },
  { key: 'nitrite', dataKey: 'nitrite', label: '亚硝酸盐', unit: 'mg/L', decimals: 3, color: '#e983ff' },
]
const modelLabels = { random_forest: 'RandomForest', knn: 'KNN', baseline: 'Baseline' }

const farms = computed(() => forecastData.value?.farms || [])
const selectedFarmData = computed(() => farms.value.find((farm) => farm.farm === selectedFarm.value) || null)
const predictions = computed(() => selectedFarmData.value?.predictions || [])
const firstPrediction = computed(() => predictions.value[0] || null)
const levelPriority = { normal: 0, yellow: 1, orange: 2, red: 3 }

function hasValue(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value))
}

function formatValue(value, metric) {
  return hasValue(value) ? Number(value).toFixed(metric.decimals) : '--'
}

function formatTime(value) {
  return value ? String(value).slice(5, 16) : '--'
}

function modelLabel(metric) {
  const modelType = selectedFarmData.value?.modelTypes?.[metric.dataKey]
  return modelLabels[modelType] || modelType || '未配置'
}

function warningLevel(metric, value) {
  return getAlertLevel(metric.key, value, store.settings)
}

function warningInfo(metric, value) {
  return ALERT_LEVELS[warningLevel(metric, value)] || ALERT_LEVELS.normal
}

const futureRisk = computed(() => {
  let worst = 'normal'
  metricDefinitions.forEach((metric) => {
    predictions.value.forEach((point) => {
      const level = warningLevel(metric, point[metric.dataKey])
      if (levelPriority[level] > levelPriority[worst]) worst = level
    })
  })
  return ALERT_LEVELS[worst]
})

function queryMetricKey(value) {
  const aliases = { do: 'dissolvedOxygen', dissolvedoxygen: 'dissolvedOxygen', temperature: 'temperature', ph: 'ph', ammonia: 'ammoniaNitrogen', ammonianitrogen: 'ammoniaNitrogen', salinity: 'salinity', nitrite: 'nitrite' }
  return aliases[String(value || '').toLowerCase()] || ''
}

function findFarmFromQuery(farmsList) {
  const queryFarm = String(route.query.farm || '')
  if (!queryFarm) return ''
  if (queryFarm === 'zhimin') return farmsList.find((farm) => farm.farm.includes('志敏'))?.farm || ''
  if (queryFarm === 'lijinshan') return farmsList.find((farm) => farm.farm.includes('李金山'))?.farm || ''
  return farmsList.find((farm) => farm.farm === queryFarm || farm.farm.includes(queryFarm))?.farm || ''
}

function setChartRef(element, metricKey) {
  if (element) chartRefs.value[metricKey] = element
}

function scrollToFocusedMetric() {
  if (!focusedMetric.value) return
  chartRefs.value[focusedMetric.value]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

watch([selectedFarm, focusedMetric], () => nextTick(scrollToFocusedMetric))

function trend(metric) {
  const current = selectedFarmData.value?.lastActualValues?.[metric.dataKey]
  const next = firstPrediction.value?.[metric.dataKey]
  if (!hasValue(current) || !hasValue(next)) return { text: '暂无当前值', className: 'trend-neutral' }
  const difference = Number(next) - Number(current)
  const threshold = 10 ** (-metric.decimals)
  if (Math.abs(difference) < threshold) return { text: '→ 稳定', className: 'trend-stable' }
  return difference > 0
    ? { text: `↑ 上升 ${Math.abs(difference).toFixed(metric.decimals)}`, className: 'trend-up' }
    : { text: `↓ 下降 ${Math.abs(difference).toFixed(metric.decimals)}`, className: 'trend-down' }
}

async function loadForecast() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await fetch(`/data/future_24h_predictions.json?ts=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) throw new Error(`预测 JSON 请求失败：HTTP ${response.status}`)
    const payload = await response.json()
    if (!Array.isArray(payload.farms) || payload.farms.length === 0) throw new Error('预测 JSON 中没有养殖场数据')
    forecastData.value = payload
    const queryFarm = findFarmFromQuery(payload.farms)
    selectedFarm.value = queryFarm || (payload.farms.some((farm) => farm.farm === selectedFarm.value) ? selectedFarm.value : payload.farms[0].farm)
    focusedMetric.value = queryMetricKey(route.query.metric)
  } catch (error) {
    console.error('加载未来预测数据失败：', error)
    errorMessage.value = '暂无预测数据，请先运行预测程序。'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  store.init()
  loadForecast()
})
</script>

<template>
  <PageShell title="趋势预测">
    <section class="prediction-notice"><div class="notice-icon"><MagicStick /></div><div><strong>未来24小时六项水质预测</strong><p>预测结果由已训练模型滚动生成，曲线使用虚线表示未来预测数据。</p></div><span class="simulation-label forecast-ready-label">Python ML 预测</span></section>

    <section v-if="!loading && !errorMessage" class="prediction-toolbar panel"><div><span class="section-kicker">PREDICTION TARGET</span><strong>六项水质趋势预测</strong></div><div class="filter-item inline-filter"><label>养殖场</label><el-select v-model="selectedFarm" aria-label="选择养殖场"><el-option v-for="farm in farms" :key="farm.farm" :label="farm.farm" :value="farm.farm" /></el-select></div></section>

    <div v-if="loading" class="page-loading">正在加载未来预测数据...</div>
    <section v-else-if="errorMessage" class="prediction-empty panel"><Warning /><strong>{{ errorMessage }}</strong><button class="secondary-button" @click="loadForecast"><el-icon><Refresh /></el-icon>重新加载</button></section>
    <div v-else-if="!selectedFarmData" class="prediction-empty panel"><Warning /><strong>暂无预测数据，请先运行预测程序。</strong></div>

    <template v-else>
      <section class="prediction-meta-grid"><div><span>数据更新至</span><strong>{{ selectedFarmData.lastActualTime }}</strong></div><div><span>预测范围</span><strong>未来 {{ forecastData.forecastHours }} 小时</strong></div><div><span>预测生成</span><strong>{{ forecastData.generatedAt }}</strong></div><div><span>监测间隔中位数</span><strong>{{ selectedFarmData.samplingIntervalHours }} 小时</strong></div></section>

      <section class="prediction-value-grid future-value-grid"><article v-for="metric in metricDefinitions" :key="metric.key" class="prediction-value-card future-value-card" :style="{ '--metric-color': metric.color }"><div class="future-card-heading"><span>{{ metric.label }}</span><div class="prediction-card-badges"><small>{{ modelLabel(metric) }}</small><small class="prediction-level-badge" :class="warningInfo(metric, firstPrediction?.[metric.dataKey]).className">{{ warningInfo(metric, firstPrediction?.[metric.dataKey]).label }}</small></div></div><div v-if="hasValue(selectedFarmData.lastActualValues?.[metric.dataKey])" class="future-card-current">当前：{{ formatValue(selectedFarmData.lastActualValues[metric.dataKey], metric) }} <small>{{ metric.unit }}</small></div><div v-else class="future-card-current muted-text">当前真实值暂无</div><strong>{{ formatValue(firstPrediction?.[metric.dataKey], metric) }} <small>{{ metric.unit }}</small></strong><em>下一监测时刻 · {{ formatTime(firstPrediction?.time) }}</em><div class="prediction-warning-row"><b :class="trend(metric).className">{{ trend(metric).text }}</b><span :class="['prediction-level-text', warningInfo(metric, firstPrediction?.[metric.dataKey]).className]">{{ warningInfo(metric, firstPrediction?.[metric.dataKey]).label }}</span></div></article></section>

      <section class="panel prediction-chart-panel future-charts-panel"><div class="panel-heading"><div><span class="section-kicker">TIME SERIES FORECAST</span><h2><MagicStick />未来24小时趋势预测</h2></div><span class="chart-legend-note"><i class="forecast-dot"></i>模型预测</span></div><div class="future-prediction-grid"><article v-for="metric in metricDefinitions" :key="metric.key" :ref="(element) => setChartRef(element, metric.key)" class="future-prediction-card" :class="{ 'forecast-focused': focusedMetric === metric.key }"><div class="future-prediction-card-head"><strong>{{ metric.label }}预测</strong><span>{{ modelLabel(metric) }}</span></div><FuturePredictionChart :points="predictions" :metric="metric" :settings="store.settings" :model-type="modelLabel(metric)" /></article></div></section>

      <section class="prediction-risk-grid forecast-info-grid"><div class="risk-card"><MagicStick /><div><span>当前养殖场</span><strong>{{ selectedFarmData.farm }}</strong></div></div><div class="risk-card"><span class="trend-arrow">↗</span><div><span>预测点数量</span><strong>{{ predictions.length }} 个监测点</strong></div></div><div class="risk-card"><Warning /><div><span>未来24小时最高风险</span><strong :style="{ color: futureRisk.color }">{{ futureRisk.label }}</strong></div></div></section>
    </template>
  </PageShell>
</template>
