<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { DataAnalysis, DataLine, Grid, Histogram } from '@element-plus/icons-vue'
import PageShell from '../components/PageShell.vue'
import RealtimeChart from '../components/RealtimeChart.vue'
import { FARM_OPTIONS, getFarmOption } from '../config/farms'
import { WATER_QUALITY_METRICS } from '../config/waterQualityConfig'
import { useMonitorStore } from '../stores/monitor'
import { getAlertLevel } from '../utils/alert'

const store = useMonitorStore()
const selectedFarm = ref(FARM_OPTIONS[0].name)
const metricKey = ref('dissolvedOxygen')
const range = ref('24h')
const customDates = ref([])
const currentPage = ref(1)
const pageSize = 10
const loading = ref(true)
const metrics = WATER_QUALITY_METRICS
const levelPriority = { normal: 0, yellow: 1, orange: 2, red: 3 }
const levelLabels = { normal: '正常', yellow: '黄色风险', orange: '橙色风险', red: '红色风险' }
const rangeOptions = [
  { label: '最近24小时', value: '24h' },
  { label: '最近7天', value: '7d' },
  { label: '最近30天', value: '30d' },
  { label: '全部数据', value: 'all' },
  { label: '自定义时间', value: 'custom' },
]

const farmOptions = computed(() => {
  const actualNames = (store.farmNames || []).filter((name) => FARM_OPTIONS.some((farm) => farm.name === name))
  return (actualNames.length ? actualNames : FARM_OPTIONS.map((farm) => farm.name)).map((name) => getFarmOption(name) || { name, shortName: name })
})
const selectedFarmOption = computed(() => getFarmOption(selectedFarm.value) || { name: selectedFarm.value, shortName: selectedFarm.value })
const selectedMetric = computed(() => metrics.find((metric) => metric.key === metricKey.value) || metrics[0])
const selectedFarmRows = computed(() => store.aquacultureData.filter((row) => row.farmName === selectedFarm.value).slice().sort((a, b) => a.timestamp - b.timestamp))
const latestFarmTimestamp = computed(() => selectedFarmRows.value.at(-1)?.timestamp || 0)

function toTimestamp(value) {
  if (value instanceof Date) return value.getTime()
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function getRangeStart() {
  if (!latestFarmTimestamp.value) return 0
  if (range.value === '24h') return latestFarmTimestamp.value - 24 * 60 * 60 * 1000
  if (range.value === '7d') return latestFarmTimestamp.value - 7 * 24 * 60 * 60 * 1000
  if (range.value === '30d') return latestFarmTimestamp.value - 30 * 24 * 60 * 60 * 1000
  if (range.value === 'custom' && customDates.value?.length === 2) return toTimestamp(customDates.value[0])
  return 0
}

function getRangeEnd() {
  if (range.value === 'custom' && customDates.value?.length === 2) return toTimestamp(customDates.value[1])
  return latestFarmTimestamp.value
}

function qualityForRow(row) {
  return metrics.reduce((worst, metric) => {
    const level = getAlertLevel(metric.key, row[metric.key], store.settings)
    return levelPriority[level] > levelPriority[worst] ? level : worst
  }, 'normal')
}

const rows = computed(() => {
  const start = getRangeStart()
  const end = getRangeEnd()
  return selectedFarmRows.value.filter((row) => row.timestamp >= start && row.timestamp <= end).map((row) => ({
    ...row,
    quality: qualityForRow(row),
    qualityLabel: levelLabels[qualityForRow(row)],
  }))
})
const tableRows = computed(() => rows.value.slice().reverse())
const pagedRows = computed(() => tableRows.value.slice((currentPage.value - 1) * pageSize, currentPage.value * pageSize))
const stats = computed(() => {
  const values = rows.value.map((row) => Number(row[metricKey.value])).filter(Number.isFinite)
  if (!values.length) return { average: '--', max: '--', min: '--', deviation: '--', abnormal: 0 }
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length)
  return {
    average: average.toFixed(selectedMetric.value.decimals),
    max: Math.max(...values).toFixed(selectedMetric.value.decimals),
    min: Math.min(...values).toFixed(selectedMetric.value.decimals),
    deviation: deviation.toFixed(selectedMetric.value.decimals),
    abnormal: rows.value.filter((row) => row.quality !== 'normal').length,
  }
})

function formatMetricValue(row, key) {
  const metric = metrics.find((item) => item.key === key)
  const value = Number(row[key])
  return Number.isFinite(value) ? value.toFixed(metric?.decimals ?? 2) : '--'
}

function formatFarmName(name) {
  return getFarmOption(name)?.shortName || name
}

watch(farmOptions, (options) => {
  if (options.length && !options.some((farm) => farm.name === selectedFarm.value)) selectedFarm.value = options[0].name
}, { immediate: true })
watch([selectedFarm, range, customDates], () => { currentPage.value = 1 }, { deep: true })

onMounted(async () => {
  loading.value = true
  await store.init()
  loading.value = false
})
</script>

<template>
  <PageShell title="历史数据分析">
    <section class="filter-bar panel history-filter"><div class="filter-intro"><span class="section-kicker">HISTORICAL ANALYSIS</span><strong>真实监测数据与统计分析</strong></div><div class="filter-item"><label>养殖场</label><el-select v-model="selectedFarm"><el-option v-for="farm in farmOptions" :key="farm.name" :label="farm.name" :value="farm.name" /></el-select></div><div class="filter-item"><label>水质指标</label><el-select v-model="metricKey"><el-option v-for="metric in metrics" :key="metric.key" :label="metric.label" :value="metric.key" /></el-select></div><div class="filter-item"><label>时间范围</label><el-select v-model="range"><el-option v-for="option in rangeOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select></div><el-date-picker v-if="range === 'custom'" v-model="customDates" type="datetimerange" range-separator="至" start-placeholder="开始时间" end-placeholder="结束时间" /></section>
    <div v-if="loading" class="page-loading">正在读取真实监测数据...</div>
    <template v-else>
      <section class="panel page-chart-panel history-chart-panel"><div class="panel-heading"><div><span class="section-kicker">TIME SERIES</span><h2><el-icon><DataLine /></el-icon>{{ selectedFarmOption.shortName }} · {{ selectedMetric.label }}历史趋势</h2></div><span class="data-count">{{ rows.length }} 条监测记录</span></div><RealtimeChart :key="`${selectedFarm}-${metricKey}-${range}-${rows.length}`" :history="rows" :metric-key="metricKey" time-format="datetime" height="300px" /></section>
      <section class="stats-grid"><div class="stat-box"><span>平均值</span><strong>{{ stats.average }} <small>{{ selectedMetric.unit }}</small></strong></div><div class="stat-box"><span>最大值</span><strong>{{ stats.max }} <small>{{ selectedMetric.unit }}</small></strong></div><div class="stat-box"><span>最小值</span><strong>{{ stats.min }} <small>{{ selectedMetric.unit }}</small></strong></div><div class="stat-box"><span>标准差</span><strong>{{ stats.deviation }}</strong></div><div class="stat-box warning-stat"><span>异常次数</span><strong>{{ stats.abnormal }} <small>次</small></strong></div></section>
      <section class="panel table-panel"><div class="panel-heading"><div><span class="section-kicker">DATA RECORDS</span><h2><el-icon><Grid /></el-icon> 历史数据表格</h2></div><span class="simulation-label">真实 CSV 数据</span></div><div class="data-table-wrap"><table class="data-table history-data-table"><thead><tr><th>时间</th><th>养殖场</th><th>水温</th><th>pH</th><th>DO</th><th>氨氮</th><th>盐度</th><th>亚硝酸盐</th><th>数据质量</th></tr></thead><tbody><tr v-for="row in pagedRows" :key="row.id"><td>{{ row.time }}</td><td :title="row.farmName">{{ formatFarmName(row.farmName) }}</td><td>{{ formatMetricValue(row, 'temperature') }}</td><td>{{ formatMetricValue(row, 'ph') }}</td><td>{{ formatMetricValue(row, 'dissolvedOxygen') }}</td><td>{{ formatMetricValue(row, 'ammoniaNitrogen') }}</td><td>{{ formatMetricValue(row, 'salinity') }}</td><td>{{ formatMetricValue(row, 'nitrite') }}</td><td><span class="table-status" :class="row.quality === 'normal' ? 'done' : row.quality === 'yellow' ? 'pending' : row.quality === 'orange' ? 'processing' : 'severe'">{{ row.qualityLabel }}</span></td></tr><tr v-if="!pagedRows.length"><td colspan="9" class="table-empty">当前养殖场和时间范围暂无数据</td></tr></tbody></table></div><div class="pagination-row"><span>共 {{ tableRows.length }} 条记录</span><el-pagination v-model:current-page="currentPage" :page-size="pageSize" :total="tableRows.length" layout="prev, pager, next" background /></div></section>
      <section class="analysis-reserved"><div><el-icon><DataAnalysis /></el-icon><strong>Spearman 相关分析</strong><span>预留 Python/FastAPI 分析接口</span></div><div><el-icon><Histogram /></el-icon><strong>相关性热力图</strong><span>等待真实数据分析模型</span></div><div><el-icon><Grid /></el-icon><strong>箱线图</strong><span>等待真实数据分析模型</span></div></section>
    </template>
  </PageShell>
</template>
