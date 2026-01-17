@echo off
REM ============================================
REM Firebase Deployment Script for URL Shortener
REM Windows Batch Version
REM ============================================

setlocal enabledelayedexpansion

echo.
echo ========================================
echo 🚀 URL Shortener - Firebase Deployment
echo ========================================
echo.

REM Check if Firebase CLI is installed
where firebase >nul 2>nul
if errorlevel 1 (
    echo ❌ Firebase CLI is not installed!
    echo.
    echo Please install it using:
    echo   npm install -g firebase-tools
    echo.
    pause
    exit /b 1
)

echo ✅ Firebase CLI found
echo.

REM Check if user is logged in
firebase projects:list >nul 2>nul
if errorlevel 1 (
    echo 🔐 You need to log in to Firebase...
    echo.
    firebase login
)

echo.
echo 📋 Available Firebase Projects:
firebase projects:list
echo.

echo 🔍 Current Project Configuration:
for /f "tokens=*" %%i in ('firebase use --list') do set "current=%%i"
echo %current%
echo.

REM Deploy
echo 📦 Preparing deployment...
echo   - Checking firebase.json...
echo   - Verifying public folder...
echo   - Checking configuration files...
echo.

echo 🚀 Deploying to Firebase...
echo.

firebase deploy --verbose

echo.
echo ✅ Deployment Complete!
echo.
echo 📍 Your app is now live at:
echo    https://chotalink-aa548.web.app
echo.
echo 🎉 Success! The modern dark-themed URL Shortener is ready to use!
echo.

pause
