param(
    [int]$WaveVus = 254,
    [int]$WaveCount = 40,
    [int]$WaveInterval = 1,
    [int]$PeakHold = 60,
    [string]$SseLimit = "all",
    [string]$BaseUrl = "http://127.0.0.1:3000"
)

$ExpectedPeak = $WaveVus * $WaveCount

Write-Host "Starting staged SSE test"
Write-Host "Wave size:     $WaveVus"
Write-Host "Wave count:    $WaveCount"
Write-Host "Expected peak: $ExpectedPeak"
Write-Host "Wave interval: $WaveInterval seconds"
Write-Host "Peak hold:     $PeakHold seconds"
Write-Host "SSE limit:     $SseLimit"
Write-Host "Target:        $BaseUrl"

& "$PSScriptRoot\k6.exe" run `
    -e "WAVE_VUS=$WaveVus" `
    -e "WAVE_COUNT=$WaveCount" `
    -e "WAVE_INTERVAL=$WaveInterval" `
    -e "PEAK_HOLD=$PeakHold" `
    -e "SSE_LIMIT=$SseLimit" `
    -e "BASE_URL=$BaseUrl" `
    "$PSScriptRoot\staged-readers.js"

exit $LASTEXITCODE