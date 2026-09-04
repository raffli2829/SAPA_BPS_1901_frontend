@echo off
title SAPA BPS 1901
cd /d "%~dp0"

echo ============================================================
echo   SAPA BPS 1901 - Membuka Website & Memastikan Server Aktif
echo ============================================================
echo.

:: 1. Cek & Auto-Start Backend WhatsApp & REST API (Port 80)
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel% neq 0 (
    echo [INFO] Backend WhatsApp server belum aktif di Port 80.
    echo [INFO] Memulai Backend WhatsApp & REST API di background...
    if exist "%~dp0..\START_SAPA_BPS_HIDDEN.vbs" (
        start "" wscript.exe "%~dp0..\START_SAPA_BPS_HIDDEN.vbs"
    ) else (
        start "SAPA BPS - [Backend WhatsApp & REST API]" cmd /c "cd /d "%~dp0..\backend" && npm run dev"
    )
    timeout /t 2 /nobreak >nul
) else (
    echo [OK] Backend WhatsApp Server (Port 80) sudah berjalan aktif.
)

:: 2. Buka browser langsung ke website
start "" "http://localhost:3000"

:: 3. Cek apakah frontend port 3000 sudah aktif
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 (
    echo [OK] Server website (Port 3000) sudah berjalan di background.
    echo Website berhasil dibuka di browser default Anda!
    timeout /t 3 >nul
    exit
) else (
    echo [INFO] Server website belum aktif, memulai server dev Next.js...
    echo Jangan tutup jendela ini selama menggunakan website.
    echo.
    npm run dev
)

