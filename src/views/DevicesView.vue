<script setup>
import { onMounted } from 'vue'
import { Connection, List, SetUp } from '@element-plus/icons-vue'
import PageShell from '../components/PageShell.vue'
import DeviceCard from '../components/DeviceCard.vue'
import { DEVICE_CONTROL_CONFIG } from '../config/waterQualityConfig'
import { useMonitorStore } from '../stores/monitor'

const store = useMonitorStore()
onMounted(() => store.init())
</script>

<template>
  <PageShell title="设备控制"><section class="device-page-head"><div><span class="section-kicker">REMOTE DEVICE CONTROL</span><p>当前所有设备均为模拟状态，不发送真实硬件指令。</p></div><div class="device-summary"><span><i class="success-dot"></i>在线 {{ store.deviceStatus.online }}</span><span><i class="muted-dot"></i>控制链路 5G 专网</span></div></section><section class="device-grid"><DeviceCard v-for="device in store.devices" :key="device.id" :device="device" @toggle="store.controlDevice(device.id, $event ? 'on' : 'off', '手动', $event ? '操作员手动开启设备' : '操作员手动关闭设备')" @mode="store.setDeviceMode(device.id, $event)" /></section><section class="panel device-logs-panel"><div class="panel-heading"><div><span class="section-kicker">OPERATION LOG</span><h2><el-icon><List /></el-icon> 设备操作日志</h2></div><span class="simulation-label">模拟控制记录</span></div><div class="device-log-list"><div v-for="log in store.deviceLogs" :key="log.id" class="device-log-row"><span class="log-time">{{ log.time }}</span><span class="log-source" :class="log.source === '自动' ? 'auto' : 'manual'">{{ log.source }}</span><strong>{{ log.deviceName }}</strong><span class="log-action" :class="log.action === '开启' ? 'on' : 'off'">{{ log.action }}</span><span class="log-detail">{{ log.detail }}</span></div></div></section><section class="panel hysteresis-note"><el-icon><Connection /></el-icon><div><strong>自动控制滞回规则</strong><span>以 1号增氧机为例：DO 低于 {{ DEVICE_CONTROL_CONFIG.aerator.lowThreshold }} mg/L 自动启动；DO 恢复到 {{ DEVICE_CONTROL_CONFIG.aerator.highThreshold }} mg/L 及以上自动关闭，避免临界值频繁切换。</span></div></section></PageShell>
</template>
