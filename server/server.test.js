const assert = require("node:assert/strict")
const { after, before, test } = require("node:test")

process.env.NODE_ENV = "test"
process.env.PORT = "0"
process.env.BACKEND_URL = "http://localhost:3001"
process.env.FRONTEND_URLS = "http://localhost:5173"
process.env.SESSION_SECRET = "test-session-secret-at-least-32-characters"
process.env.AUTH_TOKEN_SECRET = "test-token-secret-at-least-32-characters"
process.env.STEAM_API_KEY = "test-steam-api-key"

const { app, createAuthCode } = require("./server")

let server
let baseUrl

before(
  () =>
    new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const address = server.address()
        baseUrl = `http://127.0.0.1:${address.port}`
        resolve()
      })
    })
)

after(
  () =>
    new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
)

test("protects authentication and API endpoints", async () => {
  const healthResponse = await fetch(`${baseUrl}/health`)

  assert.equal(healthResponse.status, 200)
  assert.equal(healthResponse.headers.get("x-content-type-options"), "nosniff")
  assert.equal(
    healthResponse.headers.get("cross-origin-resource-policy"),
    "cross-origin"
  )
  assert.equal(healthResponse.headers.get("x-powered-by"), null)

  const unauthorizedResponse = await fetch(`${baseUrl}/api/me`)
  assert.equal(unauthorizedResponse.status, 401)
  assert.deepEqual(await unauthorizedResponse.json(), {
    error: "Authentication required",
  })

  const blockedOriginResponse = await fetch(`${baseUrl}/api/me`, {
    headers: {
      Origin: "https://attacker.example",
    },
  })
  assert.equal(blockedOriginResponse.status, 403)
  assert.deepEqual(await blockedOriginResponse.json(), {
    error: "Origin not allowed",
  })

  const user = {
    steamId: "76561198000000000",
    name: "Test User",
    avatar: null,
  }
  const code = createAuthCode(user, "http://localhost:5173")
  const exchangeResponse = await fetch(`${baseUrl}/auth/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:5173",
    },
    body: JSON.stringify({ code }),
  })
  const { token } = await exchangeResponse.json()

  assert.equal(exchangeResponse.status, 200)
  assert.equal(typeof token, "string")

  const replayResponse = await fetch(`${baseUrl}/auth/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:5173",
    },
    body: JSON.stringify({ code }),
  })
  assert.equal(replayResponse.status, 400)

  const authenticatedResponse = await fetch(`${baseUrl}/api/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: "http://localhost:5173",
    },
  })
  const authenticatedData = await authenticatedResponse.json()

  assert.equal(authenticatedResponse.status, 200)
  assert.deepEqual(authenticatedData.user, user)

  let rateLimitedResponse

  for (let attempt = 0; attempt < 35; attempt += 1) {
    rateLimitedResponse = await fetch(`${baseUrl}/auth/exchange`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({ code: `invalid-${attempt}` }),
    })
  }

  assert.equal(rateLimitedResponse.status, 429)
  assert.deepEqual(await rateLimitedResponse.json(), {
    error: "Too many authentication attempts",
  })
})
