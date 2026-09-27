<script setup>
import { computed } from 'vue'
import { Bell, ArrowRight } from '@element-plus/icons-vue'
import { getMetricConfig } from '../config/waterQuality'
import { ALERT_LEVELS } from '../utils/alert'
const props = defineProps({ alerts: { type: Array, default: () => [] } })
const records = computed(() => props.alerts.map((alert) => ({ ...alert, metricLabel: getMetricConfig(alert.metricKey)?.label || alert.metricKey, levelInfo: ALERT_LEVELS[alert.level] })))
</script>

<template>
  <section class="panel alert-panel"><div class="panel-heading"><div><span class="section-kicker">ALERT CENTER</span><h2><el-icon><Bell /></el-icon> 当前告警 <b>{{ records.length }}</b></h2></div><button class="text-button">查看全部 <el-icon><ArrowRight /></el-icon></button></div><div class="alert-list"><div v-for="item in records" :key="item.id" class="alert-row"><span class="alert-level" :class="item.level">{{ item.levelInfo.label.replace('预警', '') }}</span><div class="alert-main"><strong>{{ item.metricLabel }}异常</strong><span>{{ item.pondId }} · {{ item.time }}</span></div><span class="alert-value">{{ item.value }}</span><span class="alert-state" :class="item.status === '处理中' ? 'processing' : ''">{{ item.status }}</span></div><div v-if="!records.length" class="empty-state">当前无异常告警</div></div></section>
</template>
