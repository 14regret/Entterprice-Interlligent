#Requires -Version 5.1
<#
.SYNOPSIS
    Stop whatever is listening on the Nexus dev ports (8000 / 5173).

.DESCRIPTION
    Only processes that own a LISTEN socket on those two ports are stopped.
#>
[CmdletBinding()]
param(
    [int[]]$Ports = @(8000, 5173)
)

foreach ($port in $Ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $connections) {
        Write-Host "[skip] nothing on :$port"
        continue
    }

    foreach ($connection in $connections) {
        $processId = $connection.OwningProcess
        try {
            Stop-Process -Id $processId -Force -ErrorAction Stop
            Write-Host "[ok] stopped :$port (pid $processId)"
        }
        catch {
            Write-Warning "could not stop :$port (pid $processId): $($_.Exception.Message)"
        }
    }
}
