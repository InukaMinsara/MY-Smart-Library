$maxRetries = 10
$retryCount = 0
$success = $false

while (-not $success -and $retryCount -lt $maxRetries) {
    Write-Host "Attempt $( $retryCount + 1 ) of $maxRetries..."
    
    if (Test-Path "build_electron") {
        Remove-Item -Recurse -Force "build_electron" -ErrorAction SilentlyContinue
    }
    
    # Run just the electron builder since the vite app is already compiled
    npx electron-builder --win
    
    if ($LASTEXITCODE -eq 0) {
        $success = $true
        Write-Host "Build Succeeded!"
    } else {
        $retryCount++
        Write-Host "Build failed with EPERM, waiting 3 seconds before retry..."
        Start-Sleep -Seconds 3
    }
}

if (-not $success) {
    Write-Host "Failed after $maxRetries attempts."
    exit 1
}
