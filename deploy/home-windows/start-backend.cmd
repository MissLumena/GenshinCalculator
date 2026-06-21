@echo off
chcp 65001 >nul
cd /d "%~dp0..\.."
title Genshin Calculator — home server

echo.
echo  Backend:  http://127.0.0.1:8010
echo  Сайт:     https://YOUR_HOST  (через Caddy)
echo.
echo  Не закрывайте это окно. Ctrl+C — остановить backend.
echo.

cd backend
call .venv\Scripts\activate.bat
python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
