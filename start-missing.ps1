# Starts only the HustleUp services that aren't currently listening, leaving healthy
# ones untouched (the full start script kills every JVM, which is needless downtime).
$root = "c:\Users\User\hustleup"
# -- Secrets ------------------------------------------------------------------
# Loaded from backend\.env (gitignored), never hardcoded here. These values were
# previously pinned inline, which meant committing them to git AND meant services
# started by this script silently disagreed with ones started from .env: a different
# JWT_SECRET makes every cross-service call 401, and a placeholder Stripe key makes
# every payment fail with "Invalid API Key".
$envFile = Join-Path $root "backend\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: backend\.env not found. Copy backend\.env.example to backend\.env and fill it in." -ForegroundColor Red
    exit 1
}
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $k, $v = $line -split "=", 2
        [Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim(), "Process")
    }
}
foreach ($required in @("MYSQL_PASSWORD", "JWT_SECRET")) {
    if (-not [Environment]::GetEnvironmentVariable($required, "Process")) {
        Write-Host "ERROR: $required is not set in backend\.env" -ForegroundColor Red
        exit 1
    }
}
$env:UPLOAD_DIR = "$root\uploads"
$env:AWS_REGION = "us-east-1"
$env:AWS_S3_BUCKET = "hustle-up"

$services = @(
  @{ Name = "social";      Port = 8082 },
  @{ Name = "marketplace"; Port = 8083 }
)

foreach ($s in $services) {
  $listening = Get-NetTCPConnection -LocalPort $s.Port -State Listen -ErrorAction SilentlyContinue
  if ($listening) { Write-Output ("skip {0} - already up" -f $s.Name); continue }

  $jar = Join-Path $root ("backend\hustleup-" + $s.Name + "\target\hustleup-" + $s.Name + "-1.0.0.jar")
  $cfg = Join-Path $root ("backend\hustleup-" + $s.Name + "\src\main\resources\application.yml")
  $out = Join-Path $root ("backend\logs\" + $s.Name + ".log")
  $err = Join-Path $root ("backend\logs\" + $s.Name + "_error.log")

  Start-Process -FilePath "java" `
    -ArgumentList @("-jar", $jar, "--spring.config.location=file:$cfg") `
    -WorkingDirectory $root -RedirectStandardOutput $out -RedirectStandardError $err `
    -WindowStyle Minimized
  Write-Output ("launched {0} on {1}" -f $s.Name, $s.Port)
}
