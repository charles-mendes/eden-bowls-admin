import { describe, expect, it } from 'vitest'
import { buildLabelPrintDocument } from './printLabel'

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
})
