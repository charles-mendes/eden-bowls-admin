import { describe, expect, it } from 'vitest'
import { buildLabelPrintDocument, buildLabelsPrintDocument } from './printLabel'

describe('buildLabelPrintDocument', () => {
  it('prints on a 4x6 page and turns a landscape label upright', () => {
    const html = buildLabelPrintDocument('data:image/gif;base64,AAAA', true)

    expect(html).toContain('@page{size:4in 6in;margin:0}')
    expect(html).toContain('rotate(90deg)')
    expect(html).toContain('src="data:image/gif;base64,AAAA"')
  })

  it('does not turn a portrait label', () => {
    expect(buildLabelPrintDocument('data:image/gif;base64,AAAA', false)).not.toContain('rotate')
  })

  it('prints one label on one 4x6 page', () => {
    const html = buildLabelsPrintDocument([{ src: 'data:image/gif;base64,AAAA', landscape: true }])

    expect(html.match(/class="page"/g)).toHaveLength(1)
  })

  it('prints three labels as three 4x6 pages in one document', () => {
    const html = buildLabelsPrintDocument([
      { src: 'data:image/gif;base64,AAAA', landscape: true },
      { src: 'data:image/gif;base64,BBBB', landscape: false },
      { src: 'data:image/gif;base64,CCCC', landscape: true },
    ])

    expect(html.match(/class="page"/g)).toHaveLength(3)
    expect(html.match(/rotate\(90deg\)/g)).toHaveLength(2)
    expect(html).toContain('page-break-after:always')
    expect(html.indexOf('BBBB')).toBeLessThan(html.indexOf('CCCC'))
  })
})
