#Requires -Version 5.1
<#
.SYNOPSIS
    Start Nexus 智询 locally (backend + frontend).

.DESCRIPTION
    Opens the FastAPI backend in one window and the Vite dev server in another.
    Existing listeners on :8000 or :5173 are left alone.

.EXAMPLE
    .\scripts\dev.ps1
    .\scripts\dev.ps1 -BackendOnly
#>
[CmdletBinding()]
param(
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $root 'backend'
$frontendDir = Join-Path $root 'frontend'
$python = Join-Path $backendDir '.venv\Scripts\python.exe'

function Test-Listening {
    param([int]$Port)

    # TCP probe instead of Get-NetTCPConnection: works in Windows PowerShell
    # 5.1, in sandboxes where the NetTCPIP cmdlet is restricted, and without
    # depending on seeing the owning process.
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $client.Connect('127.0.0.1', $Port)
        return $true
    }
    catch {
        return $false
    }
    finally {
        $client.Close()
    }
}

if (-not $FrontendOnly) {
    if (-not (Test-Path -LiteralPath $python)) {
        throw 'backend\.venv 不存在，请先按 README 完成首次安装。'
    }

    if (Test-Listening -Port 8000) {
        Write-Host '[skip] backend already listening on :8000'
    }
    else {
        Start-Process -FilePath $python `
            -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000') `
            -WorkingDirectory $backendDir
        Write-Host '[ok] backend starting on :8000'
    }
}

if (-not $BackendOnly) {
    if (-not (Test-Path -LiteralPath (Join-Path $frontendDir 'node_modules'))) {
        throw 'frontend\node_modules 不存在，请先执行 npm install。'
    }

    if (Test-Listening -Port 5173) {
        Write-Host '[skip] frontend already listening on :5173'
    }
    else {
        Start-Process -FilePath 'npm.cmd' `
            -ArgumentList @('run', 'dev', '--', '--host', '127.0.0.1') `
            -WorkingDirectory $frontendDir
        Write-Host '[ok] frontend starting on :5173'
    }
}

Write-Host ''
Write-Host 'Frontend : http://127.0.0.1:5173'
Write-Host 'API docs : http://127.0.0.1:8000/api/docs'
Write-Host 'Health   : http://127.0.0.1:8000/api/health'
