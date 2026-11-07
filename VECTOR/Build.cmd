@echo off
setlocal
cd /d "%~dp0"
if errorlevel 1 exit /b 1

if not exist "VECTOR.vcxproj" (
    echo Projet VECTOR.vcxproj introuvable.
    pause
    exit /b 1
)

set "VECTOR_MSBUILD="
for /f "delims=" %%M in ('where msbuild 2^>nul') do if not defined VECTOR_MSBUILD set "VECTOR_MSBUILD=%%M"
if not defined VECTOR_MSBUILD (
    if exist "%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" (
        for /f "usebackq delims=" %%M in (`"%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -find MSBuild\**\Bin\MSBuild.exe`) do if not defined VECTOR_MSBUILD set "VECTOR_MSBUILD=%%M"
    )
)
if not defined VECTOR_MSBUILD (
    echo Installe Visual Studio 2022 ou Build Tools avec :
    echo - Developpement Desktop en C++
    echo - MSVC v143 x64/x86
    echo - Windows 10 ou Windows 11 SDK
    echo Le SDK .NET seul ne compile pas ce projet C++.
    pause
    exit /b 1
)

echo Ferme VECTOR avant de compiler.
"%VECTOR_MSBUILD%" "VECTOR.vcxproj" /m /p:Configuration=Release /p:Platform=x64 /nologo
if errorlevel 1 (
    echo Compilation echouee. Conserve les erreurs affichees.
    pause
    exit /b 1
)
if not exist "dist\Release\VECTOR.exe" (
    echo Executable de sortie introuvable.
    pause
    exit /b 1
)
echo Compilation terminee : %CD%\dist\Release\VECTOR.exe
pause
exit /b 0
