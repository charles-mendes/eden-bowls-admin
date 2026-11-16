// The access token every tab of the panel shares. The refresh cookie is shared too, so the tabs also share
// who refreshes it (see refreshAccessToken).
export const TOKEN_KEY = 'eden-bowls-admin-token'

export function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function writeStoredToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // private browsing / quota
  }
}

export function clearStoredToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // private browsing
  }
}
