import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'

// Old recipe links (/catalog/recipes/:market/:recipeKey) open the product of that market and code, keeping
// the section anchor; the recipe is the product now (product-is-recipe).
export function RecipeRedirectPage() {
  const { token } = useAuth()
  const { market = '', recipeKey = '' } = useParams()
  const { hash } = useLocation()
  const navigate = useNavigate()
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    let current = true
    apiRequest<{ items: Array<{ id: string }> }>(`/admin/catalog/products${buildQueryString({ market: market.toUpperCase(), code: recipeKey, perPage: 1 })}`, { token })
      .then((response) => {
        if (!current) return
        const product = response.items[0]
        if (product) navigate(`/catalog/products/${encodeURIComponent(product.id)}${hash}`, { replace: true })
        else setMissing(true)
      })
      .catch((requestError) => {
        if (current) setError(requestError instanceof Error ? requestError.message : 'Falha ao procurar o produto da receita.')
      })
    return () => { current = false }
  }, [token, market, recipeKey, hash])

  return (
    <PageFrame eyebrow="Catálogo" title="Receita" description={`Receita ${recipeKey} · mercado ${market.toUpperCase()}`}>
      {error ? <div className="alert" role="alert">{error}</div> : null}
      {missing ? (
        <div className="alert" role="alert">
          Esta receita não existe mais. As receitas agora são produtos: <Link className="link-button" to="/catalog/products">abrir Produtos</Link>.
        </div>
      ) : null}
      {!missing && !error ? <p className="muted">Abrindo o produto da receita.</p> : null}
    </PageFrame>
  )
}
