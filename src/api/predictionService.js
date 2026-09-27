import { createPrediction } from '../mock/predictions'

export const predictionService = {
  async predictDissolvedOxygen(current, history, settings) {
    // 后续替换为 POST /api/predictions/dissolved-oxygen，传入真实历史序列。
    return createPrediction(current, history, settings)
  },
}
