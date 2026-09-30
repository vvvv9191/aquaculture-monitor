<script setup>
import { computed, onMounted, ref } from 'vue'
import { Connection, DataLine, Location, Monitor } from '@element-plus/icons-vue'
import PageShell from '../components/PageShell.vue'
import MetricCard from '../components/MetricCard.vue'
import RealtimeChart from '../components/RealtimeChart.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { FARM_OPTIONS } from '../config/farms'
import { WATER_QUALITY_METRICS } from '../config/waterQualityConfig'
import { buildHourlyMonitoringData } from '../data/hourlyMonitoringData'
import { useMonitorStore } from '../stores/monitor'

const store = useMonitorStore()
const metrics = WATER_QUALITY_METRICS
const selectedFarmId = ref(FARM_OPTIONS[0].id)
const selectedMetric = ref('temperature')
const hourlyData = ref(buildHourlyMonitoringData())

const selectedFarm = computed(() => FARM_OPTIONS.find((farm) => farm.id === selectedFarmId.value) || FARM_OPTIONS[0])
const history = computed(() => hourlyData.value[selectedFarmId.value] || [])
const current = computed(() => history.value.at(-1) || {})
const previous = computed(() => history.value.at(-2) || current.value)
const lastUpdated = computed(() => current.value.time || '--')

onMounted(() => store.init())
</script>

<template>
  <PageShell title="实时监测">
    <section class="filter-bar panel">
      <div class="filter-intro"><span class="section-kicker">LIVE MONITORING</span><strong>天津市滨海新区水产养殖监测</strong></div>
      <div class="filter-item"><label>养殖场</label><el-select v-model="selectedFarmId" aria-label="选择养殖场"><el-option v-for="farm in FARM_OPTIONS" :key="farm.id" :label="farm.name" :value="farm.id" /></el-select></div>
      <div class="filter-item"><label>监测时段</label><span class="monitor-period">最近五小时 · 每小时 1 次 · 6 个时间点</span></div>
    </section>

    <section class="page-metrics-grid"><MetricCard v-for="metric in metrics" :key="metric.key" :metric="metric" :value="Number(current[metric.key] || 0)" :previous="Number(previous[metric.key] ?? current[metric.key] ?? 0)" :time="lastUpdated" /></section>

    <section class="monitor-layout">
      <section class="panel page-chart-panel">
        <div class="panel-heading">
          <div><span class="section-kicker">LAST 5 HOURS</span><h2><el-icon><DataLine /></el-icon> 最近五小时实时趋势</h2></div>
          <div class="chart-select"><span>查看指标</span><el-select v-model="selectedMetric" size="small"><el-option v-for="metric in metrics" :key="metric.key" :label="metric.label" :value="metric.key" /></el-select></div>
        </div>
        <RealtimeChart :history="history" :metric-key="selectedMetric" height="310px" />
      </section>

      <aside class="panel live-status-panel">
        <div class="panel-heading"><div><span class="section-kicker">MONITORING STATUS</span><h2><el-icon><Connection /></el-icon> 监测状态</h2></div><StatusBadge level="normal" text="数据已载入" /></div>
        <div class="status-overview"><div class="status-big-icon"><Monitor /></div><div><strong>最近五小时监测记录</strong><span>{{ selectedFarm.shortName }} · 每小时 1 次 · 6 个时间点</span></div></div>
        <div class="status-list">
          <div><span><Location />数据更新时间</span><strong>{{ lastUpdated }}</strong></div>
          <div><span><Connection />数据区间</span><strong class="success-text">覆盖 5 小时</strong></div>
          <div><span><DataLine />采样间隔</span><strong>1 小时 / 点</strong></div>
          <div><span>数据来源</span><strong class="success-text">用户提供的监测值</strong></div>
        </div>
        <div class="data-source-note"><i></i> 当前养殖场：{{ selectedFarm.name }}<br /><small>图表与六项指标均使用本次提供的 6 个小时采样点</small></div>
      </aside>
    </section>
  </PageShell>
</template>
