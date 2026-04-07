@echo off
REM Batch wrapper to run built native host JS
SET SCRIPT_DIR=%~dp0
SET SIGNALFORGE_DB_PATH=I:\SignalForge\apps\native-host\data\signalforge.db
node "%SCRIPT_DIR%dist\main.js" %*
