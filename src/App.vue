<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { RouterView } from 'vue-router'
import { useMonitorStore } from './stores/monitor'

const store = useMonitorStore()
onMounted(() => store.init())
onBeforeUnmount(() => store.destroy())
</script>

<template><RouterView /></template>
