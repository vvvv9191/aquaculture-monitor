<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { DataLine, Grid } from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
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
const customStart = ref(null)
const customEnd = ref(null)
const currentPage = ref(1)
const pageSize = 10
const loading = ref(true)
const metrics = WATER_QUALITY_METRICS
const levelLabels = { normal: '正常', yellow: '黄色预警', orange: '橙色预警', red: '红色预警' }
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
const firstFarmTimestamp = computed(() => selectedFarmRows.value[0]?.timestamp || 0)
const farmFirstDate = computed(() => firstFarmTimestamp.value ? new Date(firstFarmTimestamp.value) : new Date())
const farmLastDate = computed(() => latestFarmTimestamp.value ? new Date(latestFarmTimestamp.value) : new Date())
const invalidCustomRange = computed(() => range.value === 'custom' && customStart.value && customEnd.value && customStart.value > customEnd.value)

// 每家养殖场独立使用自身的完整数据日期区间；跨年可分别从开始/结束日历浏览。
function resetCustomDates() {
  customStart.value = firstFarmTimestamp.value ? new Date(firstFarmTimestamp.value) : null
  customEnd.value = latestFarmTimestamp.value ? new Date(latestFarmTimestamp.value) : null
}

function disableCustomDate(date) {
  if (!firstFarmTimestamp.value || !latestFarmTimestamp.value) return false
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  const first = new Date(firstFarmTimestamp.value)
  first.setHours(0, 0, 0, 0)
  const last = new Date(latestFarmTimestamp.value)
  last.setHours(23, 59, 59, 999)
  return day < first || day > last
}

function formatPickerDate(value) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(value) : '--'
}

function startOfDay(value) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function endOfDay(value) {
  const date = new Date(value)
  date.setHours(23, 59, 59, 999)
  return date
}

function getRangeStart() {
  if (!latestFarmTimestamp.value) return 0
  if (range.value === '24h') return latestFarmTimestamp.value - 24 * 60 * 60 * 1000
  if (range.value === '7d') return latestFarmTimestamp.value - 7 * 24 * 60 * 60 * 1000
  if (range.value === '30d') return latestFarmTimestamp.value - 30 * 24 * 60 * 60 * 1000
  if (range.value === 'custom') return customStart.value ? startOfDay(customStart.value).getTime() : firstFarmTimestamp.value
  return 0
}

function getRangeEnd() {
  if (range.value === 'custom') return customEnd.value ? endOfDay(customEnd.value).getTime() : latestFarmTimestamp.value
  return latestFarmTimestamp.value
}

// 数据质量只判断当前选中的指标；未选中的其他指标不参与当前质量等级和次数统计。
function qualityForRow(row) {
  return getAlertLevel(metricKey.value, row[metricKey.value], store.settings)
}

const rows = computed(() => {
  if (invalidCustomRange.value) return []
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
  const qualityCounts = rows.value.reduce((counts, row) => {
    counts[row.quality] += 1
    return counts
  }, { normal: 0, yellow: 0, orange: 0, red: 0 })

  if (!values.length) {
    return { average: '--', max: '--', min: '--', deviation: '--', ...qualityCounts }
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length)
  return {
    average: average.toFixed(selectedMetric.value.decimals),
    max: Math.max(...values).toFixed(selectedMetric.value.decimals),
    min: Math.min(...values).toFixed(selectedMetric.value.decimals),
    deviation: deviation.toFixed(selectedMetric.value.decimals),
    ...qualityCounts,
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
watch([selectedFarm, range], () => {
  currentPage.value = 1
  if (range.value === 'custom') resetCustomDates()
})
watch([customStart, customEnd], () => { currentPage.value = 1 })
watch([firstFarmTimestamp, latestFarmTimestamp], () => {
  if (range.value === 'custom' && (!customStart.value || !customEnd.value)) resetCustomDates()
})

onMounted(async () => {
  loading.value = true
  await store.init()
  loading.value = false
})
</script>

<template>
  <el-config-provider :locale="zhCn">
  <PageShell title="历史数据分析">
    <section class="filter-bar panel history-filter" :class="{ 'is-custom-range': range === 'custom' }"><div class="filter-intro"><span class="section-kicker">HISTORICAL ANALYSIS</span><strong>真实监测数据与统计分析</strong></div><div class="filter-item"><label>养殖场</label><el-select v-model="selectedFarm"><el-option v-for="farm in farmOptions" :key="farm.name" :label="farm.name" :value="farm.name" /></el-select></div><div class="filter-item"><label>水质指标</label><el-select v-model="metricKey"><el-option v-for="metric in metrics" :key="metric.key" :label="metric.label" :value="metric.key" /></el-select></div><div class="filter-item"><label>时间范围</label><el-select v-model="range"><el-option v-for="option in rangeOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select></div><div v-if="range === 'custom'" class="history-custom-range"><div class="history-custom-picker"><label>开始时间</label><el-date-picker v-model="customStart" type="date" format="YYYY-MM-DD" placeholder="选择开始时间" :disabled-date="disableCustomDate" popper-class="history-date-picker-popper" /></div><span class="history-range-separator">至</span><div class="history-custom-picker"><label>结束时间</label><el-date-picker v-model="customEnd" type="date" format="YYYY-MM-DD" placeholder="选择结束时间" :disabled-date="disableCustomDate" popper-class="history-date-picker-popper" /></div><small class="history-custom-hint">可选：{{ formatPickerDate(farmFirstDate) }} 至 {{ formatPickerDate(farmLastDate) }}<em v-if="invalidCustomRange">结束时间必须晚于开始时间</em></small></div></section>
    <div v-if="loading" class="page-loading">正在读取真实监测数据...</div>
    <template v-else>
      <section class="panel page-chart-panel history-chart-panel"><div class="panel-heading"><div><span class="section-kicker">TIME SERIES</span><h2><el-icon><DataLine /></el-icon>{{ selectedFarmOption.shortName }} · {{ selectedMetric.label }}历史趋势</h2></div><span class="data-count">{{ rows.length }} 条监测记录</span></div><RealtimeChart :key="`${selectedFarm}-${metricKey}-${range}-${rows.length}`" :history="rows" :metric-key="metricKey" time-format="datetime" height="300px" /></section>
      <section class="stats-grid"><div class="stat-box"><span>平均值</span><strong>{{ stats.average }} <small>{{ selectedMetric.unit }}</small></strong></div><div class="stat-box"><span>最大值</span><strong>{{ stats.max }} <small>{{ selectedMetric.unit }}</small></strong></div><div class="stat-box"><span>最小值</span><strong>{{ stats.min }} <small>{{ selectedMetric.unit }}</small></strong></div><div class="stat-box"><span>标准差</span><strong>{{ stats.deviation }}</strong></div><div class="stat-box quality-normal"><span>正常次数</span><strong>{{ stats.normal }} <small>次</small></strong></div><div class="stat-box quality-yellow"><span>黄色预警</span><strong>{{ stats.yellow }} <small>次</small></strong></div><div class="stat-box quality-orange"><span>橙色预警</span><strong>{{ stats.orange }} <small>次</small></strong></div><div class="stat-box quality-red"><span>红色预警</span><strong>{{ stats.red }} <small>次</small></strong></div></section>
      <section class="panel table-panel"><div class="panel-heading"><div><span class="section-kicker">DATA RECORDS</span><h2><el-icon><Grid /></el-icon> 历史数据表格</h2></div><span class="simulation-label">真实数据 · 按当前指标阈值判断</span></div><div class="data-table-wrap"><table class="data-table history-data-table"><thead><tr><th>时间</th><th>养殖场</th><th>水温</th><th>pH</th><th>DO</th><th>氨氮</th><th>盐度</th><th>亚硝酸盐</th><th>数据质量</th></tr></thead><tbody><tr v-for="row in pagedRows" :key="row.id"><td>{{ row.time }}</td><td :title="row.farmName">{{ formatFarmName(row.farmName) }}</td><td>{{ formatMetricValue(row, 'temperature') }}</td><td>{{ formatMetricValue(row, 'ph') }}</td><td>{{ formatMetricValue(row, 'dissolvedOxygen') }}</td><td>{{ formatMetricValue(row, 'ammoniaNitrogen') }}</td><td>{{ formatMetricValue(row, 'salinity') }}</td><td>{{ formatMetricValue(row, 'nitrite') }}</td><td><span class="table-status" :class="row.quality === 'normal' ? 'done' : row.quality === 'yellow' ? 'pending' : row.quality === 'orange' ? 'processing' : 'severe'">{{ row.qualityLabel }}</span></td></tr><tr v-if="!pagedRows.length"><td colspan="9" class="table-empty">当前养殖场和时间范围暂无数据</td></tr></tbody></table></div><div class="pagination-row"><span>共 {{ tableRows.length }} 条记录</span><el-pagination v-model:current-page="currentPage" :page-size="pageSize" :total="tableRows.length" layout="prev, pager, next" background /></div></section>
    </template>
  </PageShell>
  </el-config-provider>
</template>
