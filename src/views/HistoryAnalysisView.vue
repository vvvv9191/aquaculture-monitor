<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { DataAnalysis, DataLine, Grid, Histogram } from '@element-plus/icons-vue'
import PageShell from '../components/PageShell.vue'
import RealtimeChart from '../components/RealtimeChart.vue'
import { PONDS, WATER_QUALITY_METRICS } from '../config/waterQualityConfig'
import { useMonitorStore } from '../stores/monitor'

const store = useMonitorStore()
const pondId = ref('POND-01')
const metricKey = ref('dissolvedOxygen')
const range = ref('24h')
const customDates = ref([])
const rows = ref([])
const currentPage = ref(1)
const pageSize = 10
const loading = ref(false)
const metrics = WATER_QUALITY_METRICS
const rangeOptions = [{ label: '最近24小时', value: '24h' }, { label: '最近7天', value: '7d' }, { label: '最近30天', value: '30d' }, { label: '自定义时间', value: 'custom' }]
const selectedMetric = computed(() => metrics.find((metric) => metric.key === metricKey.value) || metrics[0])
const tableRows = computed(() => rows.value.slice().reverse())
const pagedRows = computed(() => tableRows.value.slice((currentPage.value - 1) * pageSize, currentPage.value * pageSize))
const stats = computed(() => {
  const values = rows.value.map((row) => Number(row[metricKey.value])).filter(Number.isFinite)
  if (!values.length) return { average: '--', max: '--', min: '--', deviation: '--', abnormal: 0 }
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length)
  return { average: average.toFixed(selectedMetric.value.decimals), max: Math.max(...values).toFixed(selectedMetric.value.decimals), min: Math.min(...values).toFixed(selectedMetric.value.decimals), deviation: deviation.toFixed(selectedMetric.value.decimals), abnormal: rows.value.filter((row) => row.quality !== 'normal').length }
})
async function loadHistory() { loading.value = true; currentPage.value = 1; rows.value = await store.fetchHistoricalData({ pondId: pondId.value, range: range.value, dates: customDates.value }); loading.value = false }
watch([pondId, range, customDates], loadHistory, { deep: true })
onMounted(async () => { await store.init(); loadHistory() })
</script>

<template>
  <PageShell title="历史数据分析"><section class="filter-bar panel history-filter"><div class="filter-intro"><span class="section-kicker">HISTORICAL ANALYSIS</span><strong>水质历史数据与统计分析</strong></div><div class="filter-item"><label>养殖池</label><el-select v-model="pondId"><el-option v-for="pond in PONDS" :key="pond.id" :label="pond.name" :value="pond.id" /></el-select></div><div class="filter-item"><label>水质指标</label><el-select v-model="metricKey"><el-option v-for="metric in metrics" :key="metric.key" :label="metric.label" :value="metric.key" /></el-select></div><div class="filter-item"><label>时间范围</label><el-select v-model="range"><el-option v-for="option in rangeOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select></div><el-date-picker v-if="range === 'custom'" v-model="customDates" type="datetimerange" range-separator="至" start-placeholder="开始时间" end-placeholder="结束时间" /></section>
    <section class="panel page-chart-panel history-chart-panel"><div class="panel-heading"><div><span class="section-kicker">TIME SERIES</span><h2><el-icon><DataLine /></el-icon>{{ selectedMetric.label }}历史趋势</h2></div><span class="data-count">{{ rows.length }} 条模拟记录</span></div><RealtimeChart :history="rows" :metric-key="metricKey" height="300px" /></section>
    <section class="stats-grid"><div class="stat-box"><span>平均值</span><strong>{{ stats.average }} <small>{{ selectedMetric.unit }}</small></strong></div><div class="stat-box"><span>最大值</span><strong>{{ stats.max }} <small>{{ selectedMetric.unit }}</small></strong></div><div class="stat-box"><span>最小值</span><strong>{{ stats.min }} <small>{{ selectedMetric.unit }}</small></strong></div><div class="stat-box"><span>标准差</span><strong>{{ stats.deviation }}</strong></div><div class="stat-box warning-stat"><span>异常次数</span><strong>{{ stats.abnormal }} <small>次</small></strong></div></section>
    <section class="panel table-panel"><div class="panel-heading"><div><span class="section-kicker">DATA RECORDS</span><h2><el-icon><Grid /></el-icon> 历史数据表格</h2></div><span class="simulation-label">模拟数据</span></div><div class="data-table-wrap"><table class="data-table history-data-table"><thead><tr><th>时间</th><th>养殖池</th><th>水温</th><th>pH</th><th>DO</th><th>氨氮</th><th>盐度</th><th>亚硝酸盐</th><th>数据质量</th></tr></thead><tbody><tr v-for="row in pagedRows" :key="row.time"><td>{{ row.time }}</td><td>{{ row.pondName }}</td><td>{{ row.temperature }}</td><td>{{ row.ph }}</td><td>{{ row.dissolvedOxygen }}</td><td>{{ row.ammoniaNitrogen }}</td><td>{{ row.salinity }}</td><td>{{ row.nitrite }}</td><td><span class="table-status" :class="row.quality === 'normal' ? 'done' : 'processing'">{{ row.quality === 'normal' ? '正常' : '异常' }}</span></td></tr><tr v-if="!pagedRows.length"><td colspan="9" class="table-empty">暂无数据</td></tr></tbody></table></div><div class="pagination-row"><span>共 {{ tableRows.length }} 条记录</span><el-pagination v-model:current-page="currentPage" :page-size="pageSize" :total="tableRows.length" layout="prev, pager, next" background /></div></section>
    <section class="analysis-reserved"><div><el-icon><DataAnalysis /></el-icon><strong>Spearman 相关分析</strong><span>预留 Python/FastAPI 分析接口</span></div><div><el-icon><Histogram /></el-icon><strong>相关性热力图</strong><span>第一版模拟分析区域</span></div><div><el-icon><Grid /></el-icon><strong>箱线图</strong><span>等待真实数据分析模型</span></div></section>
  </PageShell>
</template>
