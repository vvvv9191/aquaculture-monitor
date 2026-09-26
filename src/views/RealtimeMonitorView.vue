<script setup>
import { computed, onMounted, ref } from 'vue'
import { Connection, DataLine, Location, Monitor } from '@element-plus/icons-vue'
import PageShell from '../components/PageShell.vue'
import MetricCard from '../components/MetricCard.vue'
import RealtimeChart from '../components/RealtimeChart.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { PONDS, WATER_QUALITY_METRICS } from '../config/waterQualityConfig'
import { useMonitorStore } from '../stores/monitor'

const store = useMonitorStore()
const metrics = WATER_QUALITY_METRICS
const selectedMetric = ref('dissolvedOxygen')
const current = computed(() => store.selectedCurrent || {})
const history = computed(() => store.selectedHistory || [])
const previous = computed(() => history.value[history.value.length - 2] || current.value)
const lastUpdated = computed(() => current.value.time || '--')
onMounted(() => store.init())
</script>

<template>
  <PageShell title="实时监测"><section class="filter-bar panel"><div class="filter-intro"><span class="section-kicker">LIVE MONITORING</span><strong>天津市滨海新区水产养殖监测</strong></div><div class="filter-item"><label>养殖场</label><el-select model-value="天津市滨海新区志敏养殖场" disabled><el-option label="天津市滨海新区志敏养殖场" value="天津市滨海新区志敏养殖场" /></el-select></div><div class="filter-item"><label>养殖池</label><el-select :model-value="store.selectedPondId" @change="store.selectPond"><el-option v-for="pond in PONDS" :key="pond.id" :label="pond.name" :value="pond.id" /></el-select></div><div class="filter-item"><label>监测设备</label><el-select :model-value="current.deviceId" disabled><el-option :label="current.deviceId || 'TJ-AQ-001'" :value="current.deviceId || 'TJ-AQ-001'" /></el-select></div></section>
    <section class="page-metrics-grid"><MetricCard v-for="metric in metrics" :key="metric.key" :metric="metric" :value="Number(current[metric.key] || 0)" :previous="Number(previous[metric.key] || current[metric.key] || 0)" :time="lastUpdated" /></section>
    <section class="monitor-layout"><section class="panel page-chart-panel"><div class="panel-heading"><div><span class="section-kicker">LAST 60 MINUTES</span><h2><el-icon><DataLine /></el-icon> 最近一小时实时趋势</h2></div><div class="chart-select"><span>查看指标</span><el-select v-model="selectedMetric" size="small"><el-option v-for="metric in metrics" :key="metric.key" :label="metric.label" :value="metric.key" /></el-select></div></div><RealtimeChart :history="history" :metric-key="selectedMetric" height="310px" /></section><aside class="panel live-status-panel"><div class="panel-heading"><div><span class="section-kicker">CONNECTION STATUS</span><h2><el-icon><Connection /></el-icon> 监测状态</h2></div><StatusBadge level="normal" text="在线" /></div><div class="status-overview"><div class="status-big-icon"><Monitor /></div><div><strong>设备运行正常</strong><span>{{ current.pondName || '1号养殖池' }} · {{ current.deviceId || 'TJ-AQ-001' }}</span></div></div><div class="status-list"><div><span><Location />数据更新时间</span><strong>{{ lastUpdated }}</strong></div><div><span><Connection />网络状态</span><strong class="success-text">5G 专网稳定</strong></div><div><span><DataLine />数据刷新频率</span><strong>每 5 秒</strong></div><div><span>数据质量</span><strong class="success-text">实时模拟</strong></div></div><div class="data-source-note"><i></i> 当前数据源：Mock Sensor API<br /><small>后续可切换至 FastAPI / WebSocket</small></div></aside></section>
  </PageShell>
</template>
