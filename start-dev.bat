@echo off
title Yumi Lechon Dev Launcher

echo Setting up ADB reverse tunnel on port 5199...
adb reverse tcp:5199 tcp:5199

echo Launching all servers in a single tiled Windows Terminal...
wt -w 0 -d "%~dp0LechonSystem.Api" cmd /k "dotnet run" ; split-pane -V -d "%~dp0lechon-system-web" cmd /k "npm run dev" ; split-pane -H -d "%~dp0lechon-system-mobile" cmd /k "npx expo start"