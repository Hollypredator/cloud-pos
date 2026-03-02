@echo off
cd /d "%~dp0\.."
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>nul
if exist ".next\dev\lock" del /f /q ".next\dev\lock"
npm run dev
