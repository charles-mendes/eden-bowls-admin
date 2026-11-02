// The UPS GIF is 1400x800 at 200 dpi and holds a 6x4 in label on its side, with blank space on the right.
// Turned a quarter clockwise it reads upright, and the 4x6 in page cuts that blank space off.
export function buildLabelPrintDocument(src: string, landscape: boolean): string {
  const image = landscape
    ? 'height:4in;width:auto;transform-origin:top left;transform:translateX(4in) rotate(90deg);'
    : 'width:4in;height:6in;object-fit:contain;'
  return `<!doctype html><html><head><meta charset="utf-8"><title>UPS</title><style>
@page{size:4in 6in;margin:0}
html,body{margin:0;padding:0}
div{width:4in;height:6in;overflow:hidden}
img{display:block;${image}}
</style></head><body><div><img src="${src}" alt=""></div></body></html>`
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

export async function printLabel(blob: Blob): Promise<void> {
  const src = await readAsDataUrl(blob)
  const landscape = await isLandscape(src)
  const frame = document.createElement('iframe')
  frame.title = 'Etiqueta UPS'
  frame.style.position = 'fixed'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.srcdoc = buildLabelPrintDocument(src, landscape)
  frame.onload = () => {
    const view = frame.contentWindow
    if (!view) return
    view.addEventListener('afterprint', () => frame.remove())
    view.focus()
    view.print()
  }
  document.body.appendChild(frame)
}
