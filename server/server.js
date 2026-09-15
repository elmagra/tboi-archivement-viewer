const express = require("express")
const passport = require("passport")
const SteamStrategy = require("passport-steam").Strategy
const session = require("express-session")
const cors = require("cors")

require("dotenv").config()

const app = express()


// ===============================
// 1. CORS
// ===============================

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
)


// ===============================
// 2. SESIONES
// ===============================

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
)


// ===============================
// 3. PASSPORT
// ===============================

app.use(passport.initialize())
app.use(passport.session())


// ===============================
// 4. GUARDAR USUARIO EN SESIÓN
// ===============================

passport.serializeUser((user, done) => {
  done(null, user)
})

passport.deserializeUser((user, done) => {
  done(null, user)
})


// ===============================
// 5. CONFIGURACIÓN DE STEAM
// ===============================

passport.use(
  new SteamStrategy(
    {
      returnURL: "http://localhost:3001/auth/steam/return",

      realm: "http://localhost:3001/",

      apiKey: process.env.STEAM_API_KEY,
    },

    (identifier, profile, done) => {

      console.log("Perfil recibido de Steam:")
      console.log(profile)

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


// ===============================
// 6. LOGIN CON STEAM
// ===============================

app.get(
  "/auth/steam",
  passport.authenticate("steam")
)


// ===============================
// 7. CALLBACK DE STEAM
// ===============================

app.get(
  "/auth/steam/return",

  passport.authenticate("steam", {
    failureRedirect: "http://localhost:5173/?login=failed",
  }),

  (req, res) => {

    console.log("Usuario conectado:")
    console.log(req.user)

    res.redirect("http://localhost:5173/")
  }
)


// ===============================
// 8. DATOS DEL USUARIO LOGUEADO
// ===============================

app.get("/api/me", (req, res) => {

  if (!req.user) {
    return res.json({
      loggedIn: false,
    })
  }

  res.json({
    loggedIn: true,

    user: {
      steamId: req.user.steamId,
      name: req.user.name,
      avatar: req.user.avatar,
    },
  })
})


// ===============================
// 9. ACHIEVEMENTS DEL JUEGO
// ===============================

app.get("/api/achievements", async (req, res) => {

  if (!req.user) {
    return res.status(401).json({
      error: "No has iniciado sesión",
    })
  }

  const steamId = req.user.steamId

  // The Binding of Isaac: Rebirth
  const appId = 250900

  const url =
    `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/` +
    `?appid=${appId}` +
    `&key=${process.env.STEAM_API_KEY}` +
    `&steamid=${steamId}` +
    `&l=english`

  try {

    const steamResponse = await fetch(url)

    const text = await steamResponse.text()

    if (!steamResponse.ok) {

      return res.status(steamResponse.status).json({
        error: "Steam API devolvió un error",
        response: text,
      })

    }

    const data = JSON.parse(text)

    res.json(data)

  } catch (error) {

    console.error("Error obteniendo achievements:")
    console.error(error)

    res.status(500).json({
      error: error.message,
    })

  }
})

app.get("/auth/logout", (req, res, next) => {
  req.logout((error) => {
    if (error) {
      return next(error)
    }

    req.session.destroy(() => {
      res.clearCookie("connect.sid")
      res.redirect("http://localhost:5173/")
    })
  })
})
// ===============================
// 10. ARRANCAR SERVIDOR
// ===============================

app.listen(3001, () => {
  console.log("Servidor iniciado en http://localhost:3001")
})