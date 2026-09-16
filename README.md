# TBOI Achievement Viewer

Visor de logros y desbloqueables de The Binding of Isaac conectado con Steam.

## Desarrollo local

1. Copia `server/.env.example` como `server/.env`.
2. Completa `STEAM_API_KEY` y genera un `SESSION_SECRET` seguro.
3. Ejecuta `start-dev.bat`.

El frontend usa `http://localhost:3001` automáticamente durante el desarrollo.

## Despliegue

GitHub Pages solo sirve el frontend. El servidor de autenticación de Steam debe
estar desplegado por separado.

### Backend en Render

1. En Render, crea un **Blueprint** desde este repositorio. Render utilizará
   `render.yaml`.
2. Introduce `STEAM_API_KEY` cuando Render la solicite.
3. Espera al despliegue y copia la URL HTTPS del servicio.

`SESSION_SECRET` se genera automáticamente. Render también proporciona la URL
del backend al servidor, por lo que el callback de Steam no depende de
`localhost`.

### Frontend en GitHub Pages

1. Abre **Settings → Secrets and variables → Actions → Variables** en GitHub.
2. Crea `VITE_API_BASE_URL` con la URL del servicio de Render, sin `/` final.
3. Vuelve a ejecutar el workflow **Deploy to GitHub Pages**.

El frontend envía su URL actual al iniciar o cerrar sesión, por lo que conserva
automáticamente el dominio y la ruta actuales después de volver desde Steam.

Si cambia el dominio del frontend, actualiza `FRONTEND_URLS` en Render. Admite
varias direcciones separadas por comas. Si cambia la URL del backend, actualiza
`VITE_API_BASE_URL` en GitHub.
