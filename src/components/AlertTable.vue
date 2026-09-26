<script setup>
import { computed } from 'vue'
import { getMetricConfig } from '../config/waterQualityConfig'
import StatusBadge from './StatusBadge.vue'
const props = defineProps({ alerts: { type: Array, default: () => [] }, compact: { type: Boolean, default: false } })
const emit = defineEmits(['handle'])
const rows = computed(() => props.alerts.map((item) => ({ ...item, metricLabel: getMetricConfig(item.metricKey)?.label || item.metricKey })))
</script>
<template>
  <div class="data-table-wrap"><table class="data-table alert-data-table"><thead><tr><th>告警时间</th><th>养殖池</th><th>指标</th><th>当前值</th><th v-if="!compact">正常范围</th><th>告警等级</th><th v-if="!compact">告警原因</th><th>处理状态</th><th v-if="!compact">操作</th></tr></thead><tbody><tr v-for="row in rows" :key="row.id"><td>{{ row.time }}</td><td>{{ row.pondName || row.pondId }}</td><td>{{ row.metricLabel }}</td><td class="value-highlight">{{ row.value }}</td><td v-if="!compact">{{ row.normalRange || '--' }}</td><td><StatusBadge :level="row.level" /></td><td v-if="!compact"><div>{{ row.reason || '指标超出安全范围' }}</div><small class="table-tip">{{ row.suggestion }}</small></td><td><span class="table-status" :class="row.status === '未处理' ? 'pending' : row.status === '处理中' ? 'processing' : 'done'">{{ row.status }}</span></td><td v-if="!compact"><button v-if="row.status !== '已处理' && row.status !== '已确认'" class="table-action" @click="emit('handle', row.id)">标记已处理</button><span v-else class="muted-text">—</span></td></tr><tr v-if="!rows.length"><td :colspan="compact ? 7 : 9" class="table-empty">暂无告警记录</td></tr></tbody></table></div>
</template>
