@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem Lightweight Maven Wrapper for Windows. It downloads Maven once into the user's
rem Maven wrapper cache, then delegates every argument to the real mvn.cmd.
set "MAVEN_VERSION=3.9.11"
set "DIST_ROOT=%USERPROFILE%\.m2\wrapper\dists\apache-maven-%MAVEN_VERSION%"
set "MAVEN_HOME=%DIST_ROOT%\apache-maven-%MAVEN_VERSION%"
set "MAVEN_REPO=%USERPROFILE%\.m2\repository"
set "MAVEN_URL=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/%MAVEN_VERSION%/apache-maven-%MAVEN_VERSION%-bin.zip"

if not exist "%MAVEN_HOME%\bin\mvn.cmd" (
  echo Maven %MAVEN_VERSION% is not installed in the wrapper cache. Downloading it...
  if not exist "%DIST_ROOT%" mkdir "%DIST_ROOT%"
  set "ARCHIVE=%DIST_ROOT%\apache-maven-%MAVEN_VERSION%-bin.zip"
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing -Uri '%MAVEN_URL%' -OutFile '!ARCHIVE!'"
  if errorlevel 1 (
    echo [ERROR] Could not download Maven from %MAVEN_URL%
    exit /b 1
  )
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '!ARCHIVE!' -DestinationPath '!DIST_ROOT!' -Force"
  if errorlevel 1 (
    echo [ERROR] Could not extract Maven into %DIST_ROOT%
    exit /b 1
  )
)

call "%MAVEN_HOME%\bin\mvn.cmd" -Dmaven.repo.local="%MAVEN_REPO%" %*
exit /b %ERRORLEVEL%
