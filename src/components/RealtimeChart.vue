<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { getMetricConfig } from '../config/waterQualityConfig'

const props = defineProps({ history: { type: Array, default: () => [] }, metricKey: { type: String, default: 'dissolvedOxygen' }, height: { type: String, default: '280px' }, timeFormat: { type: String, default: 'time' } })
const chartRef = ref(null)
let chart

function toTimestamp(point) {
  const timestamp = new Date(point?.time || '').getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function formatShortTime(point) {
  return String(point?.time || '').slice(11, 16)
}

function formatDateLabel(point, previousPoint, span) {
  const value = String(point?.time || '')
  if (span <= 36 * 60 * 60 * 1000) return value.slice(11, 16)

  const currentDate = value.slice(0, 10)
  const previousDate = String(previousPoint?.time || '').slice(0, 10)
  if (span <= 180 * 24 * 60 * 60 * 1000) return currentDate !== previousDate ? value.slice(5, 10) : ''

  const date = new Date(value)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const previousYear = previousPoint ? new Date(previousPoint.time).getFullYear() : null
  const previousMonth = previousPoint ? new Date(previousPoint.time).getMonth() + 1 : null
  if (year !== previousYear) return `${year}年`
  if (month !== previousMonth && [1, 4, 7, 10].includes(month)) return `${month}月`
  return ''
}

function buildAxisLabels() {
  const history = props.history
  if (!history.length) return []
  if (props.timeFormat !== 'datetime') return history.map(formatShortTime)

  const timestamps = history.map(toTimestamp).filter(Boolean)
  const span = (timestamps.at(-1) || 0) - (timestamps[0] || 0)
  return history.map((point, index) => formatDateLabel(point, history[index - 1], span))
}

function formatMetricValue(value, metric) {
  if (value === null || value === undefined || value === '') return '--'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value)
  return numeric.toFixed(metric?.decimals ?? 2)
}

function renderChart() {
  if (!chartRef.value || !props.history.length) return
  chart ||= echarts.init(chartRef.value)
  const metric = getMetricConfig(props.metricKey)
  const axisLabels = buildAxisLabels()
  chart.setOption({
    animationDuration: 450,
    color: [metric?.color || '#35d5c5'],
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#102b3d',
      borderColor: '#25516b',
      textStyle: { color: '#eafaff' },
      formatter: (params) => {
        const item = params?.[0]
        const point = props.history[item?.dataIndex ?? 0]
        const fullTime = point?.time || item?.axisValue || '--'
        const value = formatMetricValue(point?.[props.metricKey], metric)
        return `${fullTime}<br/>${metric?.label || props.metricKey}：${value} ${metric?.unit || ''}`
      },
    },
    grid: { top: 26, right: 18, bottom: 34, left: 46 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: axisLabels,
      axisLine: { lineStyle: { color: '#294759' } },
      axisLabel: { color: '#718d9f', fontSize: 10, interval: 0, hideOverlap: true },
      axisTick: { show: false },
    },
    yAxis: { type: 'value', scale: true, splitNumber: 4, axisLabel: { color: '#718d9f', fontSize: 10 }, splitLine: { lineStyle: { color: '#1b3544', type: 'dashed' } }, axisLine: { show: false } },
    series: [{ name: metric?.label, type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 2 }, areaStyle: { opacity: 0.09 }, data: props.history.map((point) => point[props.metricKey]) }],
  })
}
function resize() { chart?.resize() }
watch(() => [props.history, props.metricKey, props.timeFormat], () => nextTick(renderChart), { deep: true })
onMounted(() => { nextTick(renderChart); window.addEventListener('resize', resize) })
onBeforeUnmount(() => { window.removeEventListener('resize', resize); chart?.dispose() })
</script>
<template><div ref="chartRef" class="realtime-chart" :style="{ height }"></div></template>
