<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { type: [Number, String, null], default: null },
  min: { type: Number, default: -Infinity },
  max: { type: Number, default: Infinity },
  precision: { type: Number, default: undefined },
})
const emit = defineEmits(['update:modelValue'])

const rootRef = ref(null)
const cleanups = []
let repeatTimer = null
let holdTimer = null
let activeControl = null
let longPressStarted = false
let suppressNextClick = false
let holdStartedAt = 0

function roundValue(value) {
  const precision = Number.isInteger(props.precision) ? props.precision : 0
  const factor = 10 ** precision
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function currentNumber() {
  const value = Number(props.modelValue)
  return Number.isFinite(value) ? value : null
}

function clampValue(value) {
  let next = roundValue(value)
  if (Number.isFinite(props.min) && next < props.min) next = props.min
  if (Number.isFinite(props.max) && next > props.max) next = props.max
  return roundValue(next)
}

function adjust(delta) {
  const current = currentNumber()
  if (current === null) return false
  const next = clampValue(current + delta)
  if (next === current) return false
  emit('update:modelValue', next)
  return true
}

function clearRepeatTimer() {
  if (repeatTimer) {
    window.clearTimeout(repeatTimer)
    repeatTimer = null
  }
}

function stopLongPress({ suppressClick = false } = {}) {
  if (holdTimer) {
    window.clearTimeout(holdTimer)
    holdTimer = null
  }
  clearRepeatTimer()
  if (longPressStarted && suppressClick) suppressNextClick = true
  activeControl = null
  longPressStarted = false
}

function repeatStep() {
  if (!activeControl) return
  const elapsed = performance.now() - holdStartedAt
  const delta = elapsed >= 2000 ? activeControl.direction : elapsed >= 1000 ? activeControl.direction * 0.5 : activeControl.direction * 0.1
  const changed = adjust(delta)
  if (!changed) {
    stopLongPress({ suppressClick: true })
    return
  }
  const interval = elapsed >= 2000 ? 50 : elapsed >= 1000 ? 80 : 100
  repeatTimer = window.setTimeout(repeatStep, interval)
}

function startRepeating() {
  if (!activeControl || longPressStarted) return
  longPressStarted = true
  holdStartedAt = performance.now()
  repeatTimer = window.setTimeout(repeatStep, 100)
}

function handlePointerDown(event, direction, control) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  stopLongPress()
  activeControl = { direction, element: control }
  holdTimer = window.setTimeout(startRepeating, 400)
}

function handlePointerEnd(event) {
  if (!activeControl) return
  const direction = activeControl.direction
  const wasLongPress = longPressStarted
  if (event?.pointerId !== undefined && activeControl.element?.hasPointerCapture?.(event.pointerId)) {
    activeControl.element.releasePointerCapture(event.pointerId)
  }
  stopLongPress({ suppressClick: wasLongPress })
  // 阻止 Element Plus 自带 repeat-click 后，短按由这里精确执行一次 0.1 调节。
  if (!wasLongPress) adjust(direction * 0.1)
}

function handleNativeMouseDown(event) {
  // Element Plus InputNumber 内部有自己的 600ms repeat-click，拦截它，避免和本 composable 叠加。
  event.preventDefault()
  event.stopImmediatePropagation()
}

function handleClickCapture(event) {
  // 短按和长按都由 Pointer Events 控制，阻止 Element Plus 后续 click 重复变更。
  event.preventDefault()
  event.stopImmediatePropagation()
  suppressNextClick = false
}

function bindControls() {
  const root = rootRef.value
  if (!root) return
  const controls = [
    { selector: '.el-input-number__increase', direction: 1 },
    { selector: '.el-input-number__decrease', direction: -1 },
  ]
  controls.forEach(({ selector, direction }) => {
    const control = root.querySelector(selector)
    if (!control) return
    const onDown = (event) => handlePointerDown(event, direction, control)
    const onUp = (event) => handlePointerEnd(event)
    const onCancel = () => stopLongPress({ suppressClick: longPressStarted })
    const onLeave = () => stopLongPress({ suppressClick: longPressStarted })
    const onMouseDown = (event) => handleNativeMouseDown(event)
    control.addEventListener('pointerdown', onDown)
    control.addEventListener('pointerup', onUp)
    control.addEventListener('pointercancel', onCancel)
    control.addEventListener('pointerleave', onLeave)
    control.addEventListener('mousedown', onMouseDown, true)
    control.addEventListener('click', handleClickCapture, true)
    cleanups.push(() => {
      control.removeEventListener('pointerdown', onDown)
      control.removeEventListener('pointerup', onUp)
      control.removeEventListener('pointercancel', onCancel)
      control.removeEventListener('pointerleave', onLeave)
      control.removeEventListener('mousedown', onMouseDown, true)
      control.removeEventListener('click', handleClickCapture, true)
    })
  })
}

function stopForPageChange() {
  stopLongPress({ suppressClick: longPressStarted })
}

function handleGlobalMouseUp() {
  // Pointer Events 通常会先收到 pointerup，这里补充 mouseup 兼容传统鼠标事件。
  if (activeControl) stopForPageChange()
}

onMounted(() => {
  nextTick(() => {
    bindControls()
    window.addEventListener('mouseup', handleGlobalMouseUp)
    window.addEventListener('blur', stopForPageChange)
    document.addEventListener('visibilitychange', stopForPageChange)
  })
})

onBeforeUnmount(() => {
  stopForPageChange()
  window.removeEventListener('mouseup', handleGlobalMouseUp)
  window.removeEventListener('blur', stopForPageChange)
  document.removeEventListener('visibilitychange', stopForPageChange)
  cleanups.splice(0).forEach((cleanup) => cleanup())
})
</script>

<template>
  <div ref="rootRef" class="long-press-input-number">
    <el-input-number v-bind="$attrs" :model-value="modelValue" :min="min" :max="max" :precision="precision" @update:model-value="emit('update:modelValue', $event)" />
  </div>
</template>
