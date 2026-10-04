<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useMonitorStore } from '../stores/monitor'
import { formatDateTime } from '../mock/waterQuality'
import SidebarNav from './SidebarNav.vue'

defineProps({ title: { type: String, required: true }, eyebrow: { type: String, default: '天津沿海 · 智慧水产物联网平台' } })

const store = useMonitorStore()
const now = ref(new Date())
const timer = window.setInterval(() => { now.value = new Date() }, 1000)
const clock = computed(() => formatDateTime(now.value))
onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <div class="app-shell">
    <SidebarNav />
    <main class="main-content">
      <header class="feature-topbar">
        <div>
          <div class="eyebrow">{{ eyebrow }}</div>
          <h1>{{ title }}</h1>
        </div>
        <div class="feature-topbar-right">
          <div class="feature-network-state" :class="{ 'is-error': store.dataError }">
            <span class="signal-icon"><i></i><i></i><i></i><i></i></span>
            <div>
              <small>网络状态</small>
              <strong>{{ store.deviceStatus.network }}</strong>
            </div>
          </div>
          <div class="feature-current-time">
            <span class="live-dot" :class="{ 'error-dot': store.dataError }"></span>
            <span>{{ clock }}</span>
          </div>
        </div>
      </header>
      <div class="feature-content"><slot /></div>
    </main>
  </div>
</template>
