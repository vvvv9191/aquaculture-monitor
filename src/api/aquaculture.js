export async function getAquacultureData() {
  const response = await fetch('/data/aquaculture.json')

  if (!response.ok) {
    throw new Error(`数据读取失败：${response.status}`)
  }

  return await response.json()
}