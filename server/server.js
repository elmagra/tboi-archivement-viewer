const express = require("express")
const passport = require("passport")
const SteamStrategy = require("passport-steam").Strategy
const session = require("express-session")
const cors = require("cors")
const jwt = require("jsonwebtoken")

require("dotenv").config()

const app = express()
const port = Number(process.env.PORT) || 3001
const isProduction = process.env.NODE_ENV === "production"

const normalizeBaseUrl = (url) => url.trim().replace(/\/+$/, "")

const serverUrl = normalizeBaseUrl(
  process.env.BACKEND_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${port}`
)

const frontendUrls = (
  process.env.FRONTEND_URLS ||
  process.env.FRONTEND_URL ||
  "http://localhost:5173"
)
  .split(",")
  .map(normalizeBaseUrl)
  .filter(Boolean)

const defaultFrontendUrl = `${frontendUrls[0]}/`
const allowedFrontendOrigins = new Set(
  frontendUrls.map((url) => new URL(url).origin)
)

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

const createAuthToken = (user) =>
  jwt.sign(user, process.env.SESSION_SECRET, {
    expiresIn: "7d",
    issuer: "tboi-achievement-viewer",
    audience: "tboi-achievement-viewer-web",
  })

const getAuthenticatedUser = (req) => {
  if (req.user) return req.user

  const [scheme, token] = req.get("authorization")?.split(" ") || []

  if (scheme !== "Bearer" || !token) return null

  try {
    return jwt.verify(token, process.env.SESSION_SECRET, {
      issuer: "tboi-achievement-viewer",
      audience: "tboi-achievement-viewer-web",
    })
  } catch {
    return null
  }
}

const createAuthenticatedRedirect = (returnUrl, user) => {
  const redirectUrl = new URL(returnUrl)
  const hashParameters = new URLSearchParams(redirectUrl.hash.slice(1))

  hashParameters.set("steamAuth", createAuthToken(user))
  redirectUrl.hash = hashParameters.toString()

  return redirectUrl.toString()
}

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required")
}

if (!process.env.STEAM_API_KEY) {
  throw new Error("STEAM_API_KEY is required")
}

if (isProduction) {
  app.set("trust proxy", 1)
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedFrontendOrigins.has(origin)) {
        callback(null, true)
        return
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`))
    },
    credentials: true,
  })
)

const sessionCookieOptions = {
  httpOnly: true,
  sameSite: isProduction ? "none" : "lax",
  secure: isProduction,
  maxAge: 1000 * 60 * 60 * 24 * 7,
}

app.use(
  session({
    secret: process.env.SESSION_SECRET,
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
        name: profile.displayName,
        avatar:
          profile.photos?.[2]?.value ||
          profile.photos?.[1]?.value ||
          profile.photos?.[0]?.value ||
          null,
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
  rememberReturnUrl,
  passport.authenticate("steam")
)

app.get(
  "/auth/steam/return",
  passport.authenticate("steam", {
    failureRedirect: getFailureRedirectUrl(),
  }),
  (req, res, next) => {
    const returnUrl = req.session.returnTo || defaultFrontendUrl
    const authenticatedRedirect = createAuthenticatedRedirect(
      returnUrl,
      req.user
    )

    delete req.session.returnTo
    req.session.save((error) => {
      if (error) {
        next(error)
        return
      }

      res.redirect(authenticatedRedirect)
    })
  }
)

app.get("/api/me", (req, res) => {
  const user = getAuthenticatedUser(req)

  if (!user) {
    return res.json({
      loggedIn: false,
    })
  }

  return res.json({
    loggedIn: true,
    user: {
      steamId: user.steamId,
      name: user.name,
      avatar: user.avatar,
    },
  })
})

app.get("/api/achievements", async (req, res) => {
  const user = getAuthenticatedUser(req)

  if (!user) {
    return res.status(401).json({
      error: "No has iniciado sesión",
    })
  }

  const steamId = user.steamId
  const appId = 250900
  const steamUrl = new URL(
    "https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/"
  )

  steamUrl.searchParams.set("appid", appId)
  steamUrl.searchParams.set("key", process.env.STEAM_API_KEY)
  steamUrl.searchParams.set("steamid", steamId)
  steamUrl.searchParams.set("l", "english")

  try {
    const steamResponse = await fetch(steamUrl)
    const text = await steamResponse.text()

    if (!steamResponse.ok) {
      return res.status(steamResponse.status).json({
        error: "Steam API devolvió un error",
        response: text,
      })
    }

    return res.json(JSON.parse(text))
  } catch (error) {
    console.error("Error obteniendo achievements:", error)

    return res.status(500).json({
      error: error.message,
    })
  }
})

app.get("/auth/logout", (req, res, next) => {
  const returnUrl = getAllowedReturnUrl(req.query.returnTo)

  req.logout((logoutError) => {
    if (logoutError) {
      next(logoutError)
      return
    }

    req.session.destroy((sessionError) => {
      if (sessionError) {
        next(sessionError)
        return
      }

      res.clearCookie("connect.sid", sessionCookieOptions)
      res.redirect(returnUrl)
    })
  })
})

app.get("/health", (req, res) => {
  res.json({ status: "ok" })
})

app.listen(port, () => {
  console.log(`Servidor iniciado en ${serverUrl}`)
})
