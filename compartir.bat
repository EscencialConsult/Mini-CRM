@echo off
rem ==========================================================================
rem  compartir.bat - Comparte tu Mini-CRM Y sus landings con alguien de afuera
rem  por un tunel temporal de Cloudflare (trycloudflare.com). No hace falta
rem  cuenta de Cloudflare ni dominio.
rem
rem  Con UNA sola direccion alcanza para todo:
rem    https://DIRECCION/          -> el CRM (la aplicacion privada)
rem    https://DIRECCION/<slug>    -> una landing publicada
rem    https://DIRECCION/<slug>/privacidad -> su politica de privacidad
rem
rem  Uso:
rem    compartir.bat                 -> pide (opcional) un slug y abre el tunel
rem    compartir.bat <slug>          -> idem, mostrando el link de esa landing
rem
rem  Mientras esta ventana siga abierta, el link funciona.
rem  Para cortar el tunel: Ctrl+C o cerra la ventana.
rem
rem  Seguridad: el link abre el CRM REAL (la base de produccion). Por eso el script
rem  pide el email de quien va a entrar; sin email solo sigue si escribis ABIERTO.
rem  El servidor de desarrollo escucha solo en 127.0.0.1, asi que nadie de tu red
rem  local lo alcanza; solo llega el tunel.
rem
rem  Nota tecnica: el servidor de desarrollo rutea por ruta (el CRM vive en "/"
rem  y las landings en "/<slug>"). El script fuerza el Host a "localhost:5173"
rem  con --http-host-header para que Vite no lo bloquee; no hay que tocar nada.
rem ==========================================================================

setlocal enabledelayedexpansion
chcp 65001 >nul
title Compartir por Cloudflare
cd /d "%~dp0"

set "PUERTO=5173"
set "CFDIR=%LOCALAPPDATA%\cloudflared"
rem Version de cloudflared que se descarga y su SHA-256 (digest del release en GitHub).
rem Para actualizar: cambiar las dos lineas con los datos de https://github.com/cloudflare/cloudflared/releases
set "CFVERSION=2026.11.1"
set "CFSHA256=341deda3db5ec498a0482254d6c38c0b7cf01a30c37bb5dd95d2216d08955e35"
set "CFEXE="
set "SLUG=%~1"
set "EMAIL="

echo.
echo  ============================================================
echo    Compartir por Cloudflare  (link temporal, sin cuenta)
echo  ============================================================
echo.

rem -- 1. cloudflared -------------------------------------------------------
for %%I in (cloudflared.exe) do if not defined CFEXE set "CFEXE=%%~$PATH:I"
if defined CFEXE if not exist "%CFEXE%" set "CFEXE="
if not defined CFEXE if exist "%CFDIR%\cloudflared.exe" set "CFEXE=%CFDIR%\cloudflared.exe"

if not defined CFEXE (
  echo  No encontre "cloudflared" ^(el programa que abre el tunel^).
  echo  Lo puedo bajar ahora y dejarlo en:
  echo     %CFDIR%
  echo  No se instala nada en el sistema.
  echo.
  set "RESP="
  set /p RESP="  Bajar cloudflared ahora? [S/n]: "
  if /i "!RESP!"=="n" goto :fin
  if not exist "%CFDIR%" mkdir "%CFDIR%" >nul 2>nul
  echo.
  echo  Bajando cloudflared %CFVERSION% ^(unos 55 MB^) y verificando su huella...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; $tmp='%CFDIR%\cloudflared.exe.descarga'; try { Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/cloudflare/cloudflared/releases/download/%CFVERSION%/cloudflared-windows-amd64.exe' -OutFile $tmp; if ((Get-FileHash -Algorithm SHA256 -Path $tmp).Hash -ne '%CFSHA256%') { Remove-Item -Force $tmp; exit 2 }; Move-Item -Force $tmp '%CFDIR%\cloudflared.exe'; exit 0 } catch { exit 1 }"
  if errorlevel 2 (
    echo.
    echo  La huella del archivo bajado NO coincide con la esperada: se descarto.
    echo  No se ejecuto nada. Reintenta mas tarde o instalalo a mano con:
    echo     winget install --id Cloudflare.cloudflared
    goto :fin
  )
  if errorlevel 1 (
    echo.
    echo  No se pudo bajar. Revisa la conexion, o instalalo a mano con:
    echo     winget install --id Cloudflare.cloudflared
    goto :fin
  )
  set "CFEXE=%CFDIR%\cloudflared.exe"
  echo  Listo.
)

rem -- 2. servidor de desarrollo -------------------------------------------
call :puerto_abierto
if errorlevel 1 (
  echo.
  echo  El servidor de desarrollo no esta corriendo en el puerto %PUERTO%.
  set "ARRANCAR="
  set /p ARRANCAR="  Lo arranco ahora en otra ventana? [S/n]: "
  if /i "!ARRANCAR!"=="n" goto :fin
  start "Mini-CRM dev" cmd /k "npm run dev"
  echo  Esperando a que arranque...
  for /l %%i in (1,1,25) do (
    timeout /t 1 >nul
    call :puerto_abierto
    if not errorlevel 1 goto :servidor_listo
  )
  echo.
  echo  No arranco a tiempo. Mira la otra ventana y volve a intentar.
  goto :fin
)
:servidor_listo

rem -- 3. slug (opcional) y email (hace falta, salvo que escribas ABIERTO) -----
if "%SLUG%"=="" (
  echo.
  echo  Si queres, escribi el slug de una landing publicada para mostrarte
  echo  el link exacto. ^(Enter para no poner ninguna.^)
  set /p SLUG="  Slug (opcional): "
)

echo.
echo  Ojo: con el link se ve el login del CRM REAL ^(la misma base de datos
echo  de produccion^). Conviene que entre solo quien vos quieras.
echo  Escribi el correo de esa persona: entra con un PIN que le llega por email.
:pedir_email
set "EMAIL="
set /p EMAIL="  Email de quien va a entrar: "
if not "%EMAIL%"=="" goto :email_listo
echo.
echo  Sin email, entra CUALQUIERA que tenga el link.
set "ABIERTO="
set /p ABIERTO="  Escribi ABIERTO para seguir sin proteger, o Enter para indicar un email: "
if /i not "!ABIERTO!"=="ABIERTO" goto :pedir_email
:email_listo

rem -- 4. abrir el tunel ---------------------------------------------------
echo.
echo  ============================================================
echo   Abriendo el tunel. Cuando aparezca la direccion
echo   https://algo.trycloudflare.com  esa es la que compartis.
echo.
echo   Con esa sola direccion alcanza para todo:
echo     CRM      -^>  https://DIRECCION/
if not "%SLUG%"=="" (
  echo     Landing  -^>  https://DIRECCION/%SLUG%
) else (
  echo     Landing  -^>  https://DIRECCION/slug-de-la-landing
)
echo.
echo   Es el CRM real: cerra esta ventana apenas termines.
echo   Para cortar el tunel: Ctrl+C o cerra esta ventana.
echo  ============================================================
echo.

set "CFARGS=tunnel --url http://127.0.0.1:%PUERTO% --http-host-header localhost:%PUERTO%"
if not "%EMAIL%"=="" set "CFARGS=%CFARGS% --allowed-mail %EMAIL%"

"%CFEXE%" %CFARGS%
echo.
echo  Tunel cerrado.

:fin
endlocal
exit /b 0

rem -- subrutinas ----------------------------------------------------------
:puerto_abierto
powershell -NoProfile -Command "try { $c=New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1',%PUERTO%); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>nul
if errorlevel 1 exit /b 1
exit /b 0
