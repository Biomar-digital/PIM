// Saving a generated or stored file to the viewer's computer.
// Inside a published claude.ai artifact, downloads go through the viewer's `downloads` capability
// (the viewer confirms each file). Anywhere else (local dev, a normal web server) a plain browser download is used.
import { toast } from '../data/store'

type Downloads = { save(req: { filename: string; data: Blob }): Promise<{ status: string }> }
type ClaudeRuntime = { use(name: string): Promise<unknown> }

let downloads: Promise<Downloads | null> | null = null
function getDownloads(): Promise<Downloads | null> {
  const claude = (window as unknown as { claude?: ClaudeRuntime }).claude
  if (!claude?.use) return Promise.resolve(null)
  downloads ??= claude.use('downloads').then((d) => (d as Downloads | null) ?? null).catch(() => null)
  return downloads
}

function browserDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function saveFile(blob: Blob, name: string) {
  const d = await getDownloads()
  if (!d) return browserDownload(blob, name)
  try {
    await d.save({ filename: name, data: blob })
  } catch (e) {
    const code = (e as { code?: string })?.code
    if (code === 'declined') return
    if (code === 'rejected_extension') toast('This type of file cannot be downloaded here', 'info')
    else if (code === 'rate_limited') toast('Another download is waiting for your confirmation', 'info')
    else toast('Downloads are not available in this view', 'info')
  }
}
