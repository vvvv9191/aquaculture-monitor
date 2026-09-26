import axios from 'axios'

// 真实后端接入时统一从这里配置 API 根地址、超时和拦截器。
export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
})

export default httpClient
