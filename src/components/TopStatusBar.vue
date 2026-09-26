<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useMonitorStore } from '../stores/monitor'
import { formatDateTime } from '../mock/waterQuality'

const store = useMonitorStore()
const now = ref(new Date())
const timer = window.setInterval(() => { now.value = new Date() }, 1000)
onBeforeUnmount(() => window.clearInterval(timer))
const clock = computed(() => formatDateTime(now.value))
</script>

<template>
  <header class="topbar">
    <div class="page-heading">
      <div class="eyebrow">天津沿海 · 智慧水产物联网平台</div>
      <h1>综合监控大屏</h1>
    </div>
    <div class="topbar-metrics">
      <div class="top-metric"><span class="top-metric-icon blue">⌁</span><div><small>在线设备</small><strong>{{ store.deviceStatus.online }}<em> 台</em></strong></div></div>
      <div class="top-metric"><span class="top-metric-icon green">✓</span><div><small>正常设备</small><strong>{{ store.deviceStatus.normal }}<em> 台</em></strong></div></div>
      <div class="top-metric"><span class="top-metric-icon orange">!</span><div><small>告警设备</small><strong class="warning-number">{{ store.deviceStatus.warning }}<em> 台</em></strong></div></div>
      <div class="network-state"><span class="signal-icon"><i></i><i></i><i></i><i></i></span><div><small>网络状态</small><strong>{{ store.deviceStatus.network }}</strong></div></div>
    </div>
    <div class="current-time"><span class="live-dot"></span><span>{{ clock }}</span></div>
  </header>
</template>
