const crypto = require("node:crypto")
const fs = require("node:fs")
const path = require("node:path")
const express = require("express")
const passport = require("passport")
const SteamStrategy = require("passport-steam").Strategy
const session = require("express-session")
const cors = require("cors")
const helmet = require("helmet")
const jwt = require("jsonwebtoken")
const { rateLimit } = require("express-rate-limit")

require("dotenv").config({ quiet: true })

const app = express()
const port = Number(process.env.PORT) || 3001
const isProduction = process.env.NODE_ENV === "production"
const sessionSecret = process.env.SESSION_SECRET
const authTokenSecret = process.env.AUTH_TOKEN_SECRET || sessionSecret
const authCodeLifetimeMs = 60 * 1000
const authTokenLifetime = "1h"
const achievementCacheLifetimeMs = 5 * 60 * 1000
const maxAchievementCacheEntries = 500
const pendingAuthCodes = new Map()
const achievementCache = new Map()
const pendingAchievementRequests = new Map()

if (!sessionSecret) {
  throw new Error("SESSION_SECRET is required")
}

if (!process.env.STEAM_API_KEY) {
  throw new Error("STEAM_API_KEY is required")
}

if (isProduction && sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 characters")
}

if (isProduction && authTokenSecret.length < 32) {
  throw new Error("AUTH_TOKEN_SECRET must contain at least 32 characters")
}

const normalizeBaseUrl = (url) => url.trim().replace(/\/+$/, "")

const serverUrl = normalizeBaseUrl(
  process.env.BACKEND_URL || `http://localhost:${port}`
)

const frontendUrls = (
  process.env.FRONTEND_URLS ||
  process.env.FRONTEND_URL ||
  "http://localhost:5173"
)
  .split(",")
  .map(normalizeBaseUrl)
  .filter(Boolean)

if (frontendUrls.length === 0) {
  throw new Error("At least one frontend URL is required")
}

const defaultFrontendUrl = `${frontendUrls[0]}/`
const allowedFrontendOrigins = new Set(
  frontendUrls.map((url) => new URL(url).origin)
)
const staticDir = path.resolve(
  process.env.STATIC_DIR || path.join(__dirname, "..", "dist")
)
const frontendIndexPath = path.join(staticDir, "index.html")
const shouldServeFrontend =
  isProduction && fs.existsSync(frontendIndexPath)

const isApiOrAuthPath = (requestPath) =>
  requestPath.startsWith("/api") ||
  requestPath.startsWith("/auth") ||
  requestPath === "/health"

const getAllowedReturnUrl = (candidate) => {
  if (!candidate) return defaultFrontendUrl

  try {
    const returnUrl = new URL(candidate)

    if (!allowedFrontendOrigins.has(returnUrl.origin)) {
      return defaultFrontendUrl
    }

    return returnUrl.toString()
  } catch {
    return defaultFrontendUrl
  }
}

const getFailureRedirectUrl = () => {
  const failureUrl = new URL(defaultFrontendUrl)

  failureUrl.searchParams.set("login", "failed")

  return failureUrl.toString()
}

const getSafeAvatarUrl = (profile) => {
  const avatar =
    profile.photos?.[2]?.value ||
    profile.photos?.[1]?.value ||
    profile.photos?.[0]?.value

  if (!avatar) return null

  try {
    const avatarUrl = new URL(avatar)
    const isSteamHost =
      avatarUrl.hostname === "avatars.steamstatic.com" ||
      avatarUrl.hostname.endsWith(".steamstatic.com") ||
      avatarUrl.hostname.endsWith(".akamaihd.net")

    return avatarUrl.protocol === "https:" && isSteamHost
      ? avatarUrl.toString()
      : null
  } catch {
    return null
  }
}

const createAuthToken = (user) =>
  jwt.sign(user, authTokenSecret, {
    expiresIn: authTokenLifetime,
    issuer: "tboi-achievement-viewer",
    audience: "tboi-achievement-viewer-web",
  })

const getAuthenticatedUser = (req) => {
  const [scheme, token] = req.get("authorization")?.split(" ") || []

  if (scheme !== "Bearer" || !token) return null

  try {
    return jwt.verify(token, authTokenSecret, {
      issuer: "tboi-achievement-viewer",
      audience: "tboi-achievement-viewer-web",
    })
  } catch {
    return null
  }
}

const requireAuthenticatedUser = (req, res, next) => {
  const user = getAuthenticatedUser(req)

  if (!user) {
    res.status(401).json({ error: "Authentication required" })
    return
  }

  req.authenticatedUser = user
  next()
}

const createAuthCode = (user, frontendOrigin) => {
  const code = crypto.randomBytes(32).toString("base64url")

  pendingAuthCodes.set(code, {
    user,
    frontendOrigin,
    expiresAt: Date.now() + authCodeLifetimeMs,
  })

  const expiryTimer = setTimeout(() => {
    pendingAuthCodes.delete(code)
  }, authCodeLifetimeMs)
  expiryTimer.unref()

  return code
}

const createAuthenticatedRedirect = (returnUrl, user) => {
  const redirectUrl = new URL(returnUrl)
  const hashParameters = new URLSearchParams(redirectUrl.hash.slice(1))
  const authCode = createAuthCode(user, redirectUrl.origin)

  hashParameters.set("steamCode", authCode)
  redirectUrl.hash = hashParameters.toString()

  return redirectUrl.toString()
}

const createRateLimiter = (options) =>
  rateLimit({
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...options,
  })

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { error: "Too many authentication attempts" },
})

const apiIpRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  limit: 60,
  message: { error: "Too many requests" },
})

const achievementUserRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  limit: 12,
  keyGenerator: (req) => `steam:${req.authenticatedUser.steamId}`,
  message: { error: "Too many achievement requests" },
})

if (isProduction) {
  app.set("trust proxy", 1)
}

app.disable("x-powered-by")
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "script-src": ["'self'"],
        "style-src": ["'self'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com"],
        "img-src": [
          "'self'",
          "data:",
          "https://avatars.steamstatic.com",
          "https://*.steamstatic.com",
          "https://*.akamaihd.net",
        ],
        "connect-src": ["'self'"],
        "object-src": ["'none'"],
        "frame-src": ["'none'"],
      },
    },
  })
)
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedFrontendOrigins.has(origin)) {
        callback(null, true)
        return
      }

      const error = new Error("Origin not allowed")
      error.status = 403
      callback(error)
    },
  })
)
app.use(express.json({ limit: "2kb" }))
app.use("/api", apiIpRateLimiter)
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "private, no-store")
  next()
})

const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction,
  maxAge: 10 * 60 * 1000,
}

const sessionCookieClearOptions = {
  httpOnly: sessionCookieOptions.httpOnly,
  sameSite: sessionCookieOptions.sameSite,
  secure: sessionCookieOptions.secure,
}

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: sessionCookieOptions,
  })
)

app.use(passport.initialize())
app.use(passport.session())

passport.serializeUser((user, done) => {
  done(null, user)
})

passport.deserializeUser((user, done) => {
  done(null, user)
})

passport.use(
  new SteamStrategy(
    {
      returnURL: `${serverUrl}/auth/steam/return`,
      realm: `${serverUrl}/`,
      apiKey: process.env.STEAM_API_KEY,
    },
    (identifier, profile, done) => {
      const user = {
        steamId: profile.id,
        name: String(profile.displayName || "Steam user").slice(0, 64),
        avatar: getSafeAvatarUrl(profile),
      }

      return done(null, user)
    }
  )
)

const rememberReturnUrl = (req, res, next) => {
  req.session.returnTo = getAllowedReturnUrl(req.query.returnTo)
  req.session.save(next)
}

app.get(
  "/auth/steam",
  authRateLimiter,
  rememberReturnUrl,
  passport.authenticate("steam")
)

app.get(
  "/auth/steam/return",
  authRateLimiter,
  passport.authenticate("steam", {
    failureRedirect: getFailureRedirectUrl(),
  }),
  (req, res, next) => {
    const returnUrl = req.session.returnTo || defaultFrontendUrl
    const authenticatedRedirect = createAuthenticatedRedirect(
      returnUrl,
      req.user
    )

    req.session.destroy((error) => {
      if (error) {
        next(error)
        return
      }

      res.clearCookie("connect.sid", sessionCookieClearOptions)
      res.redirect(authenticatedRedirect)
    })
  }
)

app.post("/auth/exchange", authRateLimiter, (req, res) => {
  const code = typeof req.body.code === "string" ? req.body.code : ""
  const pendingAuth = pendingAuthCodes.get(code)

  pendingAuthCodes.delete(code)

  if (
    !pendingAuth ||
    pendingAuth.expiresAt < Date.now() ||
    req.get("origin") !== pendingAuth.frontendOrigin
  ) {
    res.status(400).json({ error: "Invalid or expired authentication code" })
    return
  }

  res.set("Cache-Control", "no-store")
  res.json({
    token: createAuthToken(pendingAuth.user),
  })
})

app.get("/api/me", requireAuthenticatedUser, (req, res) => {
  const user = req.authenticatedUser

  res.json({
    loggedIn: true,
    user: {
      steamId: user.steamId,
      name: user.name,
      avatar: user.avatar,
    },
  })
})

const getCachedAchievements = (steamId) => {
  const cached = achievementCache.get(steamId)

  if (!cached) return null

  if (cached.expiresAt <= Date.now()) {
    achievementCache.delete(steamId)
    return null
  }

  return cached.data
}

const cacheAchievements = (steamId, data) => {
  if (achievementCache.size >= maxAchievementCacheEntries) {
    const oldestSteamId = achievementCache.keys().next().value
    achievementCache.delete(oldestSteamId)
  }

  achievementCache.set(steamId, {
    data,
    expiresAt: Date.now() + achievementCacheLifetimeMs,
  })
}

const requestSteamAchievements = async (steamId) => {
  const steamUrl = new URL(
    "https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/"
  )

  steamUrl.searchParams.set("appid", "250900")
  steamUrl.searchParams.set("key", process.env.STEAM_API_KEY)
  steamUrl.searchParams.set("steamid", steamId)
  steamUrl.searchParams.set("l", "english")

  const steamResponse = await fetch(steamUrl, {
    signal: AbortSignal.timeout(10_000),
  })

  if (!steamResponse.ok) {
    throw new Error(`Steam API returned status ${steamResponse.status}`)
  }

  return steamResponse.json()
}

app.get(
  "/api/achievements",
  requireAuthenticatedUser,
  achievementUserRateLimiter,
  async (req, res) => {
    const steamId = req.authenticatedUser.steamId
    const cachedAchievements = getCachedAchievements(steamId)

    if (cachedAchievements) {
      res.json(cachedAchievements)
      return
    }

    let pendingRequest = pendingAchievementRequests.get(steamId)

    try {
      if (!pendingRequest) {
        pendingRequest = requestSteamAchievements(steamId)
        pendingAchievementRequests.set(steamId, pendingRequest)
      }

      const data = await pendingRequest
      cacheAchievements(steamId, data)
      res.json(data)
    } catch (error) {
      console.error("Error loading Steam achievements:", error.name)
      res.status(502).json({ error: "Unable to load achievements" })
    } finally {
      if (pendingAchievementRequests.get(steamId) === pendingRequest) {
        pendingAchievementRequests.delete(steamId)
      }
    }
  }
)

app.get("/health", (req, res) => {
  res.json({ status: "ok" })
})

if (shouldServeFrontend) {
  app.use(
    express.static(staticDir, {
      index: false,
      fallthrough: true,
    })
  )

  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next()
      return
    }

    if (isApiOrAuthPath(req.path)) {
      next()
      return
    }

    res.sendFile(frontendIndexPath, (error) => {
      if (error) next(error)
    })
  })
}

app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error)
    return
  }

  const status = error.status === 403 ? 403 : 500
  const message = status === 403 ? "Origin not allowed" : "Internal server error"

  if (status === 500) {
    console.error("Unhandled server error:", error.name)
  }

  res.status(status).json({ error: message })
})

if (isProduction && !shouldServeFrontend) {
  console.warn(`Frontend build not found in ${staticDir}`)
}

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Servidor iniciado en ${serverUrl}`)
  })
}

module.exports = {
  app,
  createAuthCode,
}
