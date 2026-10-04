<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { WATER_QUALITY_METRICS } from '../config/waterQuality'

const props = defineProps({ history: { type: Array, default: () => [] } })
const chartRef = ref(null)
let chart
let resizeObserver

// 首页趋势图仅展示温度 / 酸碱度 / 溶解氧三项核心指标。
const seriesConfig = ['temperature', 'ph', 'dissolvedOxygen']
const metricOf = (key) => WATER_QUALITY_METRICS.find((item) => item.key === key)
const seriesName = (key) => {
  const metric = metricOf(key)
  return metric.unit ? `${metric.label} (${metric.unit})` : metric.label
}

// 三条曲线各自使用独立 Y 轴，避免温度 / 酸碱度 / 溶解氧三种量纲挤在同一刻度上不可读。
const axisLayout = [
  { position: 'left', offset: 0 },
  { position: 'left', offset: 52 },
  { position: 'right', offset: 0 },
]

function renderChart() {
  if (!chartRef.value) return
  if (!props.history.length) {
    chart?.clear()
    return
  }
  chart ||= echarts.init(chartRef.value)
  const compact = chartRef.value.clientWidth < 520
  const currentAxisLayout = compact
    ? [{ position: 'left', offset: 0 }, { position: 'left', offset: 32 }, { position: 'right', offset: 0 }]
    : axisLayout
  chart.setOption({
    animationDuration: 500,
    color: seriesConfig.map((key) => metricOf(key).color),
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#102b3d',
      borderColor: '#25516b',
      textStyle: { color: '#eafaff' },
      formatter: (params) => {
        const lines = params.map((param) => {
          const metric = metricOf(seriesConfig[param.seriesIndex])
          return `${param.marker}${param.seriesName}：${param.value} ${metric.unit}`
        })
        return [params[0]?.axisValue, ...lines].join('<br/>')
      },
    },
    legend: { type: compact ? 'scroll' : 'plain', top: 2, left: 'center', itemWidth: 14, itemHeight: 8, itemGap: compact ? 8 : 20, textStyle: { color: '#9dbdca', fontSize: compact ? 9 : 12 }, data: seriesConfig.map(seriesName) },
    grid: { top: compact ? 42 : 60, right: compact ? 48 : 96, bottom: compact ? 38 : 32, left: compact ? 44 : 68, containLabel: false },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: props.history.map((point) => point.time.slice(11, 16)),
      axisLine: { lineStyle: { color: '#294759' } },
      axisLabel: { color: '#718d9f', fontSize: compact ? 8 : 10, margin: compact ? 6 : 12 },
      axisTick: { show: false },
    },
    yAxis: seriesConfig.map((key, index) => {
      const metric = metricOf(key)
      const layout = currentAxisLayout[index]
      return {
        type: 'value',
        scale: true,
        splitNumber: 5,
        position: layout.position,
        offset: layout.offset,
        name: seriesName(key),
        nameGap: 12,
        nameTextStyle: { color: metric.color, fontSize: compact ? 8 : 10 },
        axisLabel: { color: metric.color, fontSize: compact ? 8 : 10 },
        axisLine: { show: index > 0, lineStyle: { color: metric.color } },
        axisTick: { show: false },
        splitLine: { show: index === 0, lineStyle: { color: '#1b3544', type: 'dashed' } },
      }
    }),
    series: seriesConfig.map((key, index) => ({
      name: seriesName(key),
      type: 'line',
      yAxisIndex: index,
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2 },
      areaStyle: { opacity: 0.05 },
      data: props.history.map((point) => point[key]),
    })),
  })
}
function resize() { chart?.resize() }
watch(() => props.history, () => nextTick(renderChart), { deep: true })
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

<template><div ref="chartRef" class="trend-chart"></div></template>
