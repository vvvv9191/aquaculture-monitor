<script setup>
import { computed } from 'vue'
import { useMonitorStore } from '../stores/monitor'
import { ALERT_LEVELS, getAlertLevel } from '../utils/alert'

const props = defineProps({
  metric: { type: Object, required: true },
  value: { type: [Number, String], default: null },
  previous: { type: [Number, String], default: null },
  time: { type: String, default: '' },
})
const store = useMonitorStore()
const hasValue = computed(() => props.value !== null && props.value !== undefined && props.value !== '' && Number.isFinite(Number(props.value)))
const status = computed(() => hasValue.value ? getAlertLevel(props.metric.key, Number(props.value), store.settings) : 'normal')
const statusInfo = computed(() => ALERT_LEVELS[status.value])
const direction = computed(() => !hasValue.value || !Number.isFinite(Number(props.previous)) || Number(props.value) === Number(props.previous) ? 'stable' : Number(props.value) > Number(props.previous) ? 'up' : 'down')
const change = computed(() => direction.value === 'stable' ? '--' : Math.abs(Number(props.value) - Number(props.previous)).toFixed(props.metric.decimals))
const displayValue = computed(() => hasValue.value ? Number(props.value).toFixed(props.metric.decimals) : '--')
</script>

<template><article class="metric-card" :class="`metric-${status}`" :style="{ '--metric-color': metric.color }"><div class="metric-card-head"><div class="metric-symbol">{{ metric.icon }}</div><span class="metric-status" :class="statusInfo.className"><i></i>{{ hasValue ? statusInfo.label : '暂无数据' }}</span></div><div class="metric-name">{{ metric.label }} <span v-if="metric.unit">/ {{ metric.unit }}</span></div><div class="metric-value-row"><strong>{{ displayValue }}</strong><span class="metric-unit">{{ metric.unit || ' ' }}</span></div><div class="metric-footer"><span class="trend-mark" :class="direction">{{ direction === 'up' ? '↗' : direction === 'down' ? '↘' : '→' }} {{ change }}</span><span>{{ hasValue ? '较上一时刻' : '等待数据' }}</span></div><div v-if="time" class="metric-time">更新于 {{ time }}</div><div class="metric-glow"></div></article></template>
