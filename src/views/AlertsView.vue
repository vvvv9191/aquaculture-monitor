<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Bell, CircleCheck, Refresh, Warning } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import PageShell from '../components/PageShell.vue'
import AlertTable from '../components/AlertTable.vue'
import { useWarningStore } from '../stores/warningStore'

const router = useRouter()
const warningStore = useWarningStore()
const visibleAlerts = computed(() => warningStore.visibleAlerts)
const currentPage = ref(1)
const pageSize = 25
const pagedAlerts = computed(() => visibleAlerts.value.slice((currentPage.value - 1) * pageSize, currentPage.value * pageSize))
const summary = computed(() => warningStore.summary)
const selectedFarmLabel = computed(() => warningStore.selectedFarm || '当前养殖场')
watch([() => warningStore.selectedFarm, () => visibleAlerts.value.length], () => { currentPage.value = 1 })

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
    <section class="alert-page-head"><div><span class="section-kicker">RULE-BASED ALERT CENTER</span><p>两家养殖场全量历史数据 · 六项指标按系统阈值分析</p></div><div class="alert-page-actions"><div class="farm-filter"><label>养殖场</label><el-select v-model="warningStore.selectedFarm" aria-label="选择养殖场"><el-option v-for="farm in warningStore.farms" :key="farm" :label="farm" :value="farm" /></el-select></div><button class="secondary-button" :disabled="warningStore.loading" @click="warningStore.refresh"><el-icon><Refresh /></el-icon>刷新数据</button></div></section>
    <section class="alert-stats-grid"><div class="alert-stat-card"><span class="alert-stat-icon blue"><Bell /></span><div><small>历史告警记录</small><strong>{{ summary.realtime }}</strong></div></div><div class="alert-stat-card"><span class="alert-stat-icon yellow"><Warning /></span><div><small>黄色预警</small><strong>{{ summary.yellow }}</strong></div></div><div class="alert-stat-card"><span class="alert-stat-icon red"><Warning /></span><div><small>红色严重预警</small><strong>{{ summary.red }}</strong></div></div><div class="alert-stat-card"><span class="alert-stat-icon green"><CircleCheck /></span><div><small>未处理告警</small><strong>{{ summary.unhandled }}</strong></div></div></section>
    <section v-if="warningStore.errorMessage" class="alert-error panel"><Warning /><span>{{ warningStore.errorMessage }}</span><button class="secondary-button" @click="warningStore.refresh">重新加载</button></section>
    <section class="panel alert-table-panel"><div class="panel-heading"><div><span class="section-kicker">ALERT RECORDS</span><h2><el-icon><Bell /></el-icon> 告警记录</h2></div></div><div class="alert-advice"><strong>数据来源：</strong>读取志敏养殖场和李金山养殖场的全部历史监测记录，六项指标分别按系统设置阈值生成告警。点击告警行可展开判断详情。</div><div v-if="warningStore.loading" class="table-empty">正在读取两家养殖场历史监测数据...</div><template v-else-if="visibleAlerts.length"><AlertTable :alerts="pagedAlerts" @handle="warningStore.markHandled" @observe="warningStore.markObserved" @trend="openTrend" /><div class="pagination-row alert-pagination"><span>共 {{ visibleAlerts.length }} 条历史告警</span><el-pagination v-model:current-page="currentPage" :page-size="pageSize" :total="visibleAlerts.length" layout="prev, pager, next" background /></div></template><div v-else class="alert-empty-state"><CircleCheck /><strong>{{ selectedFarmLabel }} 当前无预警</strong><span>当前养殖场历史数据中暂无超出系统设置阈值的记录。</span></div></section>
  </PageShell>
</template>
