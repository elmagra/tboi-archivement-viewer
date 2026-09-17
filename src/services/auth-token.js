import { getApiUrl } from "../config/urls"

const AUTH_TOKEN_STORAGE_KEY = "tboi-steam-auth-token"
const AUTH_HASH_PARAMETER = "steamCode"

const removeAuthCodeFromUrl = (hashParameters) => {
  hashParameters.delete(AUTH_HASH_PARAMETER)

  const remainingHash = hashParameters.toString()
  const cleanUrl = `${window.location.pathname}${window.location.search}${
    remainingHash ? `#${remainingHash}` : ""
  }`

  window.history.replaceState(null, "", cleanUrl)
}

export const initializeAuth = async () => {
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)

  const hashParameters = new URLSearchParams(window.location.hash.slice(1))
  const authCode = hashParameters.get(AUTH_HASH_PARAMETER)

  if (!authCode) return

  removeAuthCodeFromUrl(hashParameters)

  const response = await fetch(getApiUrl("/auth/exchange"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code: authCode }),
  })

  if (!response.ok) {
    throw new Error("Steam authentication could not be completed")
  }

  const data = await response.json()

  if (typeof data.token !== "string" || !data.token) {
    throw new Error("The authentication response is invalid")
  }

  window.sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, data.token)
}

export const getAuthHeaders = () => {
  const authToken = window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)

  if (!authToken) return {}

  return {
    Authorization: `Bearer ${authToken}`,
  }
}

export const clearAuthToken = () => {
  window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
}
