param([switch]$BackendOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$backendRoot = Join-Path $projectRoot 'backend'
$envFile = Join-Path $backendRoot '.env'
if (-not (Test-Path -LiteralPath $envFile)) { throw 'Create backend/.env from .env.example first.' }
$savedEnvironment = @{}
function Set-ChildEnvironment([string]$Name, [string]$Value) {
    if (-not $savedEnvironment.ContainsKey($Name)) { $savedEnvironment[$Name] = [Environment]::GetEnvironmentVariable($Name, 'Process') }
    [Environment]::SetEnvironmentVariable($Name, $Value, 'Process')
}
function Test-LocalPort([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try { return $client.ConnectAsync('127.0.0.1', $Port).Wait(500) -and $client.Connected }
    catch { return $false }
    finally { $client.Dispose() }
}
$logRoot = Join-Path $backendRoot ('logs/dev-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
try {
    foreach ($line in Get-Content -LiteralPath $envFile) {
        if ($line -match '^\s*([A-Z][A-Z0-9_]*)\s*=(.*)$') {
            $name = $Matches[1]
            $value = $Matches[2].Trim()
            if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) { $value = $value.Substring(1, $value.Length - 2) }
            Set-ChildEnvironment $name $value
        }
    }
    foreach ($required in @('MYSQL_PASSWORD', 'JWT_SECRET')) {
        if (-not [Environment]::GetEnvironmentVariable($required, 'Process')) { throw "$required is missing from backend/.env" }
    }
    if ($env:STRIPE_SECRET_KEY -match '^(sk|rk)_live_') { throw 'Local startup refuses live Stripe credentials. Configure a test key in backend/.env.' }
    if (-not (Test-LocalPort 3306)) { throw 'Local MySQL must be running on port 3306.' }
    Set-ChildEnvironment 'SPRING_DATASOURCE_URL' 'jdbc:mysql://localhost:3306/hustleup?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true'
    Set-ChildEnvironment 'FRONTEND_URL' 'http://localhost:5173'
    Set-ChildEnvironment 'UPLOAD_DIR' (Join-Path $projectRoot 'uploads')
    Set-ChildEnvironment 'CORS_ALLOWED_ORIGINS' 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8086,http://127.0.0.1:8086'
    # Keep local startup from sending mail, uploading assets or syncing external indexes.
    foreach ($name in @('MAIL_HOST','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','ALGOLIA_ADMIN_KEY','ADZUNA_APP_KEY','SENTRY_DSN')) { Set-ChildEnvironment $name '' }
    Set-ChildEnvironment 'SES_ENABLED' 'false'
    Set-ChildEnvironment 'DIGEST_NEW_LISTINGS_ENABLED' 'false'
    $javaExecutable = 'C:\Program Files\Java\jdk-21\bin\java.exe'
    if (-not (Test-Path -LiteralPath $javaExecutable)) { $javaExecutable = (Get-Command java -ErrorAction Stop).Source }
    $services = @(
        @{ Name='gateway'; Port=8000 }, @{ Name='auth'; Port=8081 },
        @{ Name='social'; Port=8082 }, @{ Name='marketplace'; Port=8083 },
        @{ Name='subscription'; Port=8084 }, @{ Name='notification'; Port=8085 }
    )
    foreach ($service in $services) {
        if (Test-LocalPort $service.Port) { Write-Output "$($service.Name): port $($service.Port) already occupied; left untouched."; continue }
        $jar = Join-Path $backendRoot "hustleup-$($service.Name)/target/hustleup-$($service.Name)-1.0.0.jar"
        if (-not (Test-Path -LiteralPath $jar)) { throw "Package backend first; missing $jar" }
        $child = Start-Process -FilePath $javaExecutable -ArgumentList @('-Xmx384m','-jar',('"' + $jar + '"')) -WorkingDirectory $backendRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot "$($service.Name).log") -RedirectStandardError (Join-Path $logRoot "$($service.Name).err.log") -PassThru
        Write-Output "$($service.Name): launched PID $($child.Id), port $($service.Port)."
    }
    if (-not $BackendOnly) {
        if (-not (Test-LocalPort 5173)) {
            $child = Start-Process npm.cmd -ArgumentList @('run','dev','--','--host','127.0.0.1','--port','5173','--strictPort') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'web.log') -RedirectStandardError (Join-Path $logRoot 'web.err.log') -PassThru
            Write-Output "Web: launched PID $($child.Id), http://localhost:5173"
        } else { Write-Output 'Web: port 5173 already running; left untouched.' }
        if (-not (Test-LocalPort 8086)) {
            Set-ChildEnvironment 'CI' ''
            Set-ChildEnvironment 'EXPO_OFFLINE' '1'
            $child = Start-Process npm.cmd -ArgumentList @('start','--','--localhost','--port','8086') -WorkingDirectory (Join-Path $projectRoot 'mobile') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'expo.log') -RedirectStandardError (Join-Path $logRoot 'expo.err.log') -PassThru
            Write-Output "Expo: launched PID $($child.Id), http://localhost:8086"
        } else { Write-Output 'Expo: port 8086 already occupied; left untouched.' }
    }
    Write-Output "Logs: $logRoot"
    Write-Output 'Processes launched; check logs and HTTP readiness before treating services as ready.'
} finally {
    foreach ($name in $savedEnvironment.Keys) { [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process') }
}
