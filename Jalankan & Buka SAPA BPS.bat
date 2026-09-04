@echo off
title SAPA BPS 1901
cd /d "%~dp0"

echo ============================================================
echo   SAPA BPS 1901 - Membuka Website & Memastikan Server Aktif
echo ============================================================
echo.

:: Buka browser langsung ke website
start "" "http://localhost:3000"

:: Cek apakah port 3000 sudah aktif
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Server website sudah berjalan di background.
    echo Website berhasil dibuka di browser default Anda!
    timeout /t 3 >nul
    exit
) else (
    echo [INFO] Server belum aktif, memulai server dev Next.js...
    echo Jangan tutup jendela ini selama menggunakan website.
    echo.
    npm run dev
)
