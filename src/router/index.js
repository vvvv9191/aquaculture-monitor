import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import RealtimeMonitorView from '../views/RealtimeMonitorView.vue'
import HistoryAnalysisView from '../views/HistoryAnalysisView.vue'
import AlertsView from '../views/AlertsView.vue'
import PredictionView from '../views/PredictionView.vue'
import DevicesView from '../views/DevicesView.vue'
import SettingsView from '../views/SettingsView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: DashboardView },
    { path: '/monitor', alias: '/realtime', component: RealtimeMonitorView },
    { path: '/history', component: HistoryAnalysisView },
    { path: '/alerts', component: AlertsView },
    { path: '/prediction', alias: '/forecast', component: PredictionView },
    { path: '/devices', component: DevicesView },
    { path: '/settings', component: SettingsView },
  ],
})

export default router
