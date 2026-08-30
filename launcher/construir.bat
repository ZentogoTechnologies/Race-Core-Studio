@echo off
REM Reconstruye race-core-studio.exe a partir del script del lanzador.
REM Ejecutar desde la raiz del proyecto:  launcher\construir.bat

cd /d "%~dp0.."

echo Empaquetando el lanzador...
Backend\venv\Scripts\python.exe -m PyInstaller ^
  --onefile --console --clean --noconfirm ^
  --name race-core-studio ^
  --hidden-import pymongo ^
  --distpath launcher\dist --workpath launcher\build --specpath launcher ^
  launcher\race_core_studio.py

if errorlevel 1 (
  echo.
  echo FALLO el empaquetado. Si falta PyInstaller:
  echo   Backend\venv\Scripts\python.exe -m pip install pyinstaller
  pause
  exit /b 1
)

copy /Y launcher\dist\race-core-studio.exe race-core-studio.exe
echo.
echo Listo: race-core-studio.exe
pause
