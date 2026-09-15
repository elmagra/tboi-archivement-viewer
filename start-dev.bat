@echo off
setlocal

set "PROJECT_ROOT=%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado o no esta en el PATH.
  pause
  exit /b 1
)

if not exist "%PROJECT_ROOT%node_modules\" (
  echo Instalando dependencias del frontend...
  call npm install --prefix "%PROJECT_ROOT%"
  if errorlevel 1 goto :install_error
)

if not exist "%PROJECT_ROOT%server\node_modules\" (
  echo Instalando dependencias del backend...
  call npm install --prefix "%PROJECT_ROOT%server"
  if errorlevel 1 goto :install_error
)

echo Iniciando backend en http://localhost:3001...
start "TBOI Backend" /D "%PROJECT_ROOT%server" cmd /k "node server.js"

echo Iniciando frontend en http://localhost:5173...
start "TBOI Frontend" /D "%PROJECT_ROOT%" cmd /k "npm run dev"

echo.
echo Frontend y backend iniciados en ventanas separadas.
exit /b 0

:install_error
echo.
echo [ERROR] No se pudieron instalar las dependencias.
pause
exit /b 1
