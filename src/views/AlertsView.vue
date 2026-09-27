<script setup>
import { computed, onMounted } from 'vue'
import { Bell, CircleCheck, Refresh, Warning } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import PageShell from '../components/PageShell.vue'
import AlertTable from '../components/AlertTable.vue'
import { useWarningStore } from '../stores/warningStore'

const router = useRouter()
const warningStore = useWarningStore()
const filterOptions = [{ label: '全部', value: 'all' }, { label: '实时预警', value: 'realtime' }, { label: '预测预警', value: 'forecast' }]
const visibleAlerts = computed(() => warningStore.visibleAlerts)
const summary = computed(() => warningStore.summary)

function farmQueryValue(farm) {
  if (farm.includes('志敏')) return 'zhimin'
  if (farm.includes('李金山')) return 'lijinshan'
  return farm
}

function metricQueryValue(metric) {
  return metric === 'dissolvedOxygen' ? 'do' : metric
}

function openTrend(row) {
  router.push({ path: '/prediction', query: { farm: farmQueryValue(row.farm), metric: metricQueryValue(row.metric) } })
}

onMounted(() => warningStore.init())
</script>

<template>
  <PageShell title="智能预警">
    <section class="alert-page-head"><div><span class="section-kicker">RULE-BASED ALERT CENTER</span><p>实时监测数据与未来24小时预测共同驱动的水质预警</p></div><div class="alert-page-actions"><div class="farm-filter"><label>养殖场</label><el-select v-model="warningStore.selectedFarm" aria-label="选择养殖场"><el-option label="全部养殖场" value="all" /><el-option v-for="farm in warningStore.farms" :key="farm" :label="farm" :value="farm" /></el-select></div><button class="secondary-button" :disabled="warningStore.loading" @click="warningStore.refresh"><el-icon><Refresh /></el-icon>刷新数据</button></div></section>
    <section class="alert-stats-grid"><div class="alert-stat-card"><span class="alert-stat-icon blue"><Bell /></span><div><small>当前实时告警</small><strong>{{ summary.realtime }}</strong></div></div><div class="alert-stat-card"><span class="alert-stat-icon yellow"><Warning /></span><div><small>未来24h预测预警</small><strong>{{ summary.forecast }}</strong></div></div><div class="alert-stat-card"><span class="alert-stat-icon red"><Warning /></span><div><small>红色严重预警</small><strong>{{ summary.red }}</strong></div></div><div class="alert-stat-card"><span class="alert-stat-icon green"><CircleCheck /></span><div><small>未处理告警</small><strong>{{ summary.unhandled }}</strong></div></div></section>
    <section v-if="warningStore.errorMessage" class="alert-error panel"><Warning /><span>{{ warningStore.errorMessage }}</span><button class="secondary-button" @click="warningStore.refresh">重新加载</button></section>
    <section class="panel alert-table-panel"><div class="panel-heading"><div><span class="section-kicker">ALERT RECORDS</span><h2><el-icon><Bell /></el-icon> 告警记录</h2></div><div class="alert-filter-tabs"><button v-for="option in filterOptions" :key="option.value" :class="{ active: warningStore.filterType === option.value }" @click="warningStore.filterType = option.value">{{ option.label }}</button></div></div><div class="alert-advice"><strong>数据来源：</strong>实时预警读取每个养殖场最新真实监测记录；预测预警读取 future_24h_predictions.json，并统一使用当前系统设置阈值判断。点击告警行可展开判断详情。</div><div v-if="warningStore.loading" class="table-empty">正在读取真实监测与预测数据...</div><template v-else-if="visibleAlerts.length"><AlertTable :alerts="visibleAlerts" @handle="warningStore.markHandled" @observe="warningStore.markObserved" @trend="openTrend" /></template><div v-else class="alert-empty-state"><CircleCheck /><strong>{{ warningStore.selectedFarm === 'all' ? '当前没有需要处理的告警' : `${warningStore.selectedFarm} 当前无预警` }}</strong><span>当前水质指标均处于设定正常范围，未来24小时暂未发现预测风险。</span></div></section>
  </PageShell>
</template>
