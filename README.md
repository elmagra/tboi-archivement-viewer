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

## Despliegue

El frontend se publica en GitHub Pages y el servidor de Steam en Render mediante
`render.yaml`. Render utiliza el plan gratuito.

Después de desplegar el servidor, añade su URL a la variable
`VITE_API_BASE_URL` del repositorio de GitHub y vuelve a ejecutar el workflow de
GitHub Pages.

Este proyecto no está afiliado con los creadores de The Binding of Isaac,
Valve ni Steam.
