interface ImageDimensions {
  width: number
  height: number
}

const MIN_IMAGE_AREA = 32_000

export function isUsefulImage(image: ImageDimensions): boolean {
  if (!Number.isFinite(image.width) || !Number.isFinite(image.height)) return false
  if (image.width < 120 || image.height < 90 || image.width * image.height < MIN_IMAGE_AREA) return false
  const ratio = image.width / image.height
  return ratio >= 0.12 && ratio <= 8
}

export function sampledHash(data: Uint8Array, width: number, height: number): string {
  let hash = 2166136261 ^ width ^ (height << 16)
  const stride = Math.max(1, Math.floor(data.length / 4_096))
  for (let index = 0; index < data.length; index += stride) {
    hash ^= data[index] ?? 0
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}
