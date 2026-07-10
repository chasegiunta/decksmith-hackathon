import JSZip from 'jszip'
import type { ProjectFiles } from '@/types/deck'

export async function createProjectZip(files: ProjectFiles): Promise<Blob> {
  const zip = new JSZip()
  for (const [path, contents] of Object.entries(files)) zip.file(path, contents)
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'slidev-deck'
}
