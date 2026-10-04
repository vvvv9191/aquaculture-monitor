<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { ALERT_LEVELS, getAlertLevel } from '../utils/alert'
import { getWarningDirection } from '../utils/warningEvaluator'

const props = defineProps({
  points: { type: Array, default: () => [] },
  metric: { type: Object, required: true },
  settings: { type: Object, default: () => ({}) },
  modelType: { type: String, default: '未配置' },
})

const chartRef = ref(null)
let chart
let resizeObserver

function formatTime(value) {
  return String(value || '').slice(5, 16).replace(' ', '\n')
}

function renderChart() {
  if (!chartRef.value) return
  if (!props.points.length) {
    chart?.clear()
    return
  }
  chart ||= echarts.init(chartRef.value)
  const compact = chartRef.value.clientWidth < 420
  chart.setOption({
    color: [props.metric.color],
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#102b3d',
      borderColor: '#25516b',
      textStyle: { color: '#eafaff', fontSize: 11 },
      formatter: (params) => {
        const point = params?.[0]
        const raw = props.points[point?.dataIndex]
        if (!raw) return ''
        const value = raw[props.metric.dataKey]
        const level = getAlertLevel(props.metric.key, value, props.settings)
        const direction = getWarningDirection(props.metric.key, value, props.settings)
        const levelInfo = ALERT_LEVELS[level] || ALERT_LEVELS.normal
        const directionLabel = direction === 'low' ? '偏低' : direction === 'high' ? '偏高' : '正常'
        return `${raw.time}<br/>${props.metric.label}：${Number(value).toFixed(props.metric.decimals)} ${props.metric.unit}<br/>风险：<span style=\"color:${levelInfo.color}\">${levelInfo.label} · ${directionLabel}</span><br/>模型：${props.modelType}`
      },
    },
    grid: { top: 18, right: 12, bottom: compact ? 42 : 45, left: compact ? 40 : 48 },
    xAxis: {
      type: 'category',
      data: props.points.map((point) => formatTime(point.time)),
      axisLine: { lineStyle: { color: '#294759' } },
      axisLabel: { color: '#718d9f', fontSize: compact ? 8 : 9, lineHeight: 14, hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      name: props.metric.unit,
      nameTextStyle: { color: '#718d9f', fontSize: 9 },
      axisLabel: { color: '#718d9f', fontSize: 9 },
      splitLine: { lineStyle: { color: '#1b3544', type: 'dashed' } },
    },
    series: [{
      name: props.metric.label,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 7,
      lineStyle: { type: 'dashed', width: 2 },
      itemStyle: { color: props.metric.color },
      data: props.points.map((point) => point[props.metric.dataKey]),
    }],
  })
}

function resize() {
  chart?.resize()
}

watch(() => [props.points, props.metric, props.settings, props.modelType], () => nextTick(renderChart), { deep: true })
onMounted(() => {
  nextTick(renderChart)
  window.addEventListener('resize', resize)
  if (typeof ResizeObserver !== 'undefined' && chartRef.value) {
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(chartRef.value)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  resizeObserver?.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="chartRef" class="future-prediction-chart"></div>
</template>
