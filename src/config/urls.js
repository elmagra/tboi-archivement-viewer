const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim()

const getApiBaseUrl = () => {
  if (configuredApiUrl) {
    return configuredApiUrl.replace(/\/+$/, "")
  }

  if (import.meta.env.DEV) {
    return "http://localhost:3001"
  }

  return window.location.origin
}

export const getApiUrl = (path) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`

  return `${getApiBaseUrl()}${normalizedPath}`
}

export const getFrontendUrl = () =>
  new URL(import.meta.env.BASE_URL, window.location.origin).toString()

export const getAuthUrl = (path) => {
  const authUrl = new URL(getApiUrl(path))

  authUrl.searchParams.set("returnTo", getFrontendUrl())

  return authUrl.toString()
}
