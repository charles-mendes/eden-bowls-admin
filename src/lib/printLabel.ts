export type PrintableLabel = { src: string; landscape: boolean }

// The UPS GIF is 1400x800 at 200 dpi and holds a 6x4 in label on its side, with blank space on the right.
// Turned a quarter clockwise it reads upright, and the 4x6 in page cuts that blank space off.
// Each label gets its own 4x6 page, so a batch prints as one job.
export function buildLabelsPrintDocument(labels: PrintableLabel[]): string {
  const pages = labels.map(({ src, landscape }) => {
    const style = landscape
      ? 'height:4in;width:auto;transform-origin:top left;transform:translateX(4in) rotate(90deg);'
      : 'width:4in;height:6in;object-fit:contain;'
    return `<div class="page"><img src="${src}" alt="" style="display:block;${style}"></div>`
  })
  return `<!doctype html><html><head><meta charset="utf-8"><title>UPS</title><style>
@page{size:4in 6in;margin:0}
html,body{margin:0;padding:0}
.page{width:4in;height:6in;overflow:hidden;page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto;break-after:auto}
</style></head><body>${pages.join('')}</body></html>`
}

export function buildLabelPrintDocument(src: string, landscape: boolean): string {
  return buildLabelsPrintDocument([{ src, landscape }])
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Falha ao ler a etiqueta'))
    reader.readAsDataURL(blob)
  })
}

function isLandscape(src: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image.naturalWidth > image.naturalHeight)
    image.onerror = () => reject(new Error('Falha ao abrir a etiqueta'))
    image.src = src
  })
}

export async function printLabels(blobs: Blob[]): Promise<void> {
  if (!blobs.length) return
  const labels = await Promise.all(blobs.map(async (blob) => {
    const src = await readAsDataUrl(blob)
    return { src, landscape: await isLandscape(src) }
  }))
  const frame = document.createElement('iframe')
  frame.title = 'Etiqueta UPS'
  frame.style.position = 'fixed'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.srcdoc = buildLabelsPrintDocument(labels)
  frame.onload = () => {
    const view = frame.contentWindow
    if (!view) return
    view.addEventListener('afterprint', () => frame.remove())
    view.focus()
    view.print()
  }
  document.body.appendChild(frame)
}

export async function printLabel(blob: Blob): Promise<void> {
  return printLabels([blob])
}
