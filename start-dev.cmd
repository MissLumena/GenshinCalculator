@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Genshin Calculator Dev
echo.
echo  Genshin Calculator — dev-сервер
echo  Frontend: http://127.0.0.1:5173
echo  Backend:  http://127.0.0.1:8010
echo.
echo  Не закрывайте это окно пока работаете с приложением.
echo  Ctrl+C — остановить.
echo.
npm run dev:full
