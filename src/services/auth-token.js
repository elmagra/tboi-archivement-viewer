const AUTH_TOKEN_STORAGE_KEY = "tboi-steam-auth-token"
const AUTH_HASH_PARAMETER = "steamAuth"

export const captureAuthToken = () => {
  const hashParameters = new URLSearchParams(window.location.hash.slice(1))
  const authToken = hashParameters.get(AUTH_HASH_PARAMETER)

  if (!authToken) return

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authToken)
  hashParameters.delete(AUTH_HASH_PARAMETER)

  const remainingHash = hashParameters.toString()
  const cleanUrl = `${window.location.pathname}${window.location.search}${
    remainingHash ? `#${remainingHash}` : ""
  }`

  window.history.replaceState(null, "", cleanUrl)
}

export const getAuthHeaders = () => {
  const authToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)

  if (!authToken) return {}

  return {
    Authorization: `Bearer ${authToken}`,
  }
}

export const clearAuthToken = () => {
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
}
