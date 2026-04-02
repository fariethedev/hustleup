@echo off
del /F /Q "hustleup-social\src\main\java\com\hustleup\social\controller\StoryControllerNew.java"
if %ERRORLEVEL% EQU 0 (
    echo File deleted successfully
) else (
    echo Failed to delete file or file not found
)
