# TBOI Achievement Viewer

Visor de logros y desbloqueables de **The Binding of Isaac: Rebirth** conectado
con Steam y diseñado con un estilo inspirado en el juego.

## Funcionalidades

- Carrusel de personajes controlable con el teclado.
- Progreso de logros para cada personaje.
- Listado de jefes y recompensas desbloqueables.
- Descripciones en inglés y español.
- Diseño responsive.

> El perfil de Steam y **Game details** deben ser públicos para consultar los
> logros. El proyecto todavía está en una fase temprana y puede contener
> errores.

## Desarrollo local

Instala las dependencias del frontend y del servidor:

```bash
npm install
cd server
npm install
```

Copia `server/.env.example` como `server/.env`, añade tu Steam API Key y ejecuta:

```text
start-dev.bat
```

La web queda en `http://localhost:5173/` y la API en `http://localhost:3001`.

## Despliegue en Coolify

La app es **un solo servicio**: Express sirve la web (`dist`) y la API de Steam.

1. Crea un recurso en Coolify con tipo **Dockerfile** (o Docker Compose con
   `compose.yaml`).
2. Puerto **3001** y healthcheck **`/health`**.
3. Añade estas variables:

| Variable | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `STEAM_API_KEY` | tu clave de Steam |
| `SESSION_SECRET` | secreto aleatorio de 32+ caracteres |
| `AUTH_TOKEN_SECRET` | otro secreto aleatorio de 32+ caracteres |
| `BACKEND_URL` | `https://tu-dominio` |
| `FRONTEND_URLS` | `https://tu-dominio` |

`BACKEND_URL` y `FRONTEND_URLS` tienen que ser la URL pública HTTPS exacta.
La vuelta de Steam OpenID es `https://tu-dominio/auth/steam/return`.

Este proyecto no está afiliado con los creadores de The Binding of Isaac,
Valve ni Steam.
