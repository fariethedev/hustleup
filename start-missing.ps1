# Starts only the HustleUp services that aren't currently listening, leaving healthy
# ones untouched (the full start script kills every JVM, which is needless downtime).
$root = "c:\Users\User\hustleup"
$env:MYSQL_PASSWORD = "francis"
$env:JWT_SECRET = "HustleUpSecretKeyForJWTTokenGenerationMustBe256BitsLongAtLeast!!2026"
$env:UPLOAD_DIR = "$root\uploads"
$env:AWS_REGION = "us-east-1"
$env:AWS_S3_BUCKET = "hustle-up"
$env:STRIPE_SECRET_KEY = "sk_test_placeholder"
$env:STRIPE_WEBHOOK_SECRET = "whsec_placeholder"

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
