import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Dialog } from './Dialog'
import { apiRequest } from '../lib/api'
import { mediaFailure, type LinkableProduct, type MediaAsset, type MediaKind } from '../lib/mediaLibrary'
import { LIFE_STAGE_LABELS, productContentPath, type LifeStage, type RecipeContent } from '../lib/recipeContent'

type Notice = { tone: 'success' | 'error'; text: string } | null

const LIFE_STAGE_ORDER: LifeStage[] = ['adult', 'puppy', 'senior']

const TEXT: Record<MediaKind, {
  linkSuffix: string
  current: (product: LinkableProduct) => string | null | undefined
  replaces: string
  none: string
}> = {
  banner: {
    linkSuffix: '/image',
    current: (product) => product.imageUrl,
    replaces: 'Substitui o destaque atual deste produto. O atual continua na biblioteca.',
    none: 'O produto ainda não tem destaque.',
  },
  plan: {
    linkSuffix: '/plan-image',
    current: (product) => product.planImageUrl,
    replaces: 'Substitui a miniatura atual deste produto. A atual continua na biblioteca.',
    none: 'O produto ainda não tem miniatura.',
  },
}

// Links of one library image to the products of its market: unlink a wrong product and link the right one.
// Neither action deletes the image, which stays in the library.
export function MediaLinkDialog({ token, asset, products, productsError, onClose, onChanged }: {
  token: string | null
  asset: MediaAsset | null
  products: LinkableProduct[] | null
  productsError: string
  onClose: () => void
  onChanged: (asset: MediaAsset) => void
}) {
  const [productId, setProductId] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const kind = asset?.kind ?? 'banner'
  const text = TEXT[kind]
  const linkedIds = new Set((asset?.usedBy ?? []).map((user) => user.productId))
  const target = (products ?? []).find((product) => product.productId === productId)

  const close = () => {
    if (saving) return
    setProductId('')
    setNotice(null)
    onClose()
  }

  const call = async (id: string, method: 'PUT' | 'DELETE') => {
    if (!token || !asset || saving) return null
    setSaving(true)
    setNotice(null)
    try {
      return await apiRequest<RecipeContent>(productContentPath(id, text.linkSuffix), {
        token,
        method,
        ...(method === 'PUT' ? { body: { assetId: asset.id } } : {}),
      })
    } catch (requestError) {
      setNotice({ tone: 'error', text: mediaFailure(requestError, method === 'PUT' ? 'Falha ao vincular a imagem.' : 'Falha ao desvincular a imagem.') })
      return null
    } finally {
      setSaving(false)
    }
  }

  const unlink = async (id: string, name: string) => {
    if (!asset) return
    if (!window.confirm(`Desvincular ${asset.originalFilename} de ${name} (${asset.market})? A imagem continua na biblioteca.`)) return
    const saved = await call(id, 'DELETE')
    if (!saved) return
    onChanged({ ...asset, usedBy: asset.usedBy.filter((user) => user.productId !== id) })
    setNotice({ tone: 'success', text: `Desvinculada de ${name} (${asset.market}).` })
  }

  const link = async () => {
    if (!asset || !target) return
    const saved = await call(target.productId, 'PUT')
    if (!saved) return
    onChanged({ ...asset, usedBy: [...asset.usedBy, { productId: target.productId, key: target.key, name: target.name, market: asset.market }] })
    setNotice({ tone: 'success', text: `Vinculada a ${target.name} (${asset.market}).` })
    setProductId('')
  }

  return (
    <Dialog
      open={asset !== null}
      title={asset?.usedBy.length ? 'Editar vínculo' : 'Vincular a um produto'}
      description={asset ? `${asset.originalFilename} · ${asset.market}. Vinculou errado? Desvincule o produto errado e vincule o certo. A imagem nunca sai da biblioteca.` : undefined}
      onClose={close}
    >
      {asset ? (
        <div className="media-link">
          <img
            className={asset.kind === 'banner' ? 'media-link-preview media-link-preview-banner' : 'media-link-preview'}
            src={asset.url}
            alt={`Prévia de ${asset.originalFilename}`}
          />
          {notice ? (
            <div className={notice.tone === 'error' ? 'alert' : 'success'} role={notice.tone === 'error' ? 'alert' : 'status'}>
              {notice.text}
            </div>
          ) : null}

          <div className="media-link-block">
            <h4>Vinculada a</h4>
            {asset.usedBy.length === 0 ? (
              <p className="muted">Nenhum produto usa esta imagem.</p>
            ) : (
              <ul className="media-link-list">
                {asset.usedBy.map((user) => {
                  const product = (products ?? []).find((item) => item.productId === user.productId)
                  return (
                    <li key={user.productId ?? user.key}>
                      <span>
                        {user.productId ? <Link to={`/catalog/products/${encodeURIComponent(user.productId)}`}><strong>{user.name}</strong></Link> : <strong>{user.name}</strong>}
                        <span className="cell-meta">{product ? ` · Linha ${LIFE_STAGE_LABELS[product.lifeStage]}` : ''} · {user.market}</span>
                      </span>
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={saving || !user.productId}
                        aria-label={`Desvincular de ${user.name}`}
                        onClick={() => { if (user.productId) void unlink(user.productId, user.name) }}
                      >
                        Desvincular
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="media-link-block">
            <h4>Vincular a outro produto</h4>
            {productsError ? <div className="alert" role="alert">{productsError}</div> : null}
            {products === null && !productsError ? <p className="muted">Carregando os produtos.</p> : null}
            {products ? (
              <div className="media-link-form">
                <label className="field">
                  Produto de {asset.market}
                  <select value={productId} disabled={saving} onChange={(event) => setProductId(event.target.value)}>
                    <option value="">Escolha o produto</option>
                    {LIFE_STAGE_ORDER.map((stage) => {
                      const options = products.filter((product) => product.lifeStage === stage && !linkedIds.has(product.productId))
                      return options.length ? (
                        <optgroup key={stage} label={LIFE_STAGE_LABELS[stage]}>
                          {options.map((product) => <option key={product.productId} value={product.productId}>{product.name}</option>)}
                        </optgroup>
                      ) : null
                    })}
                  </select>
                </label>
                <button className="primary-button" type="button" disabled={saving || !target} onClick={() => void link()}>
                  {saving ? 'Salvando…' : 'Vincular'}
                </button>
              </div>
            ) : null}
            {target ? (
              <span className="field-hint">
                Linha {LIFE_STAGE_LABELS[target.lifeStage]} · {target.name} ({asset.market}).{' '}
                {text.current(target) ? text.replaces : text.none}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </Dialog>
  )
}
