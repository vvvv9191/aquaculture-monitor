<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Monitor, DataLine, Bell, TrendCharts, SetUp, Setting, Connection } from '@element-plus/icons-vue'

const navItems = [
  { label: '综合监控大屏', path: '/', icon: Monitor },
  { label: '实时监测', path: '/monitor', icon: Connection },
  { label: '历史数据分析', path: '/history', icon: DataLine },
  { label: '智能预警', path: '/alerts', icon: Bell },
  { label: '趋势预测', path: '/prediction', icon: TrendCharts },
  { label: '设备控制', path: '/devices', icon: SetUp },
  { label: '系统设置', path: '/settings', icon: Setting },
]

const route = useRoute()
const mobileOpen = ref(false)

function closeMobileMenu() {
  mobileOpen.value = false
}

function onKeydown(event) {
  if (event.key === 'Escape') closeMobileMenu()
}

watch(() => route.path, closeMobileMenu)
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <button class="mobile-menu-toggle" type="button" :aria-label="mobileOpen ? '关闭导航菜单' : '打开导航菜单'" :aria-expanded="mobileOpen" @click="mobileOpen = !mobileOpen">☰</button>
  <button v-if="mobileOpen" class="mobile-nav-backdrop" type="button" aria-label="关闭导航菜单" @click="closeMobileMenu"></button>
  <aside class="sidebar" :class="{ 'is-open': mobileOpen }"><div class="brand-block">
      <div class="brand-row">
        <img src="/TJ5G.png" alt="logo" class="brand-icon">
        <div class="brand-title">
          TJ<span>5G</span>
        </div>
      </div>
      <div class="brand-subtitle">
        水产养殖智能监测系统
      </div>
    </div><div class="nav-caption">功能导航</div><nav class="main-nav"><RouterLink v-for="item in navItems" :key="item.path" :to="item.path" class="nav-item" @click="closeMobileMenu"><el-icon><component :is="item.icon" /></el-icon><span>{{ item.label }}</span><i class="nav-active-dot"></i></RouterLink></nav><div class="sidebar-footer"><div class="system-version"><span class="status-dot"></span>系统运行中</div><div>v1.1.0 · AQUA5G</div></div></aside>
</template>
