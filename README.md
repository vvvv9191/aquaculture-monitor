# TJ5G 

Vue 3 + Vite 的深色科技风水产养殖可视化平台。当前使用统一 Mock Data 完成首页和六个业务页面演示，真实传感器、MQTT、FastAPI、MySQL 暂未接入。

## 运行

```bash
npm install
npm run dev
```

浏览器访问 `https://aquaculture-monitor-five.vercel.app/`。

## 页面路由

- `/`：综合监控大屏
- `/monitor`：实时监测
- `/history`：历史数据分析
- `/alerts`：智能预警
- `/prediction`：趋势预测
- `/devices`：设备控制
- `/settings`：系统设置

## 数据分层

```text
Vue 页面
  ↓
Pinia monitor Store
  ↓
src/api/*Service.js
  ↓
src/mock/*
```

当前所有业务页面共享一个 Pinia Store，因此实时监测、Dashboard、智能预警、趋势预测和设备控制读取同一份当前水质状态。

后续接入真实系统时：

- FastAPI REST：替换 `src/api/*Service.js` 中的 Mock 实现
- WebSocket：替换 `src/api/waterQualityService.js` 的 `realtimeService`
- MQTT：由 FastAPI 负责订阅 ESP32/STM32 数据，前端不直接连接硬件
- Axios：统一配置位于 `src/api/httpClient.js`

## 配置与模拟数据

- `src/config/waterQualityConfig.js`：六项指标、安全阈值、预警阈值、养殖池和自动控制阈值
- `src/mock/waterQuality.js`：统一水质点、历史序列和多养殖池数据
- `src/mock/alerts.js`：初始告警记录
- `src/mock/devices.js`：设备和设备日志
- `src/mock/predictions.js`：模拟 DO 预测结果

系统设置保存后会同步影响规则预警、指标状态、预测风险和增氧机滞回控制。
