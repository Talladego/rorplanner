@echo off
REM Start Vite dev server and redirect output to dev.log (runs in this repo root)
cd /d "%~dp0"
REM Ensure npm resolves to the .cmd shim under Program Files
npm run dev > "%~dp0dev.log" 2>&1
