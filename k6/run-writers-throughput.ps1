param(
    [int]$WritesPerSecond = 25,
    [int]$DurationSeconds = 30,
    [int]$PreAllocatedVus = 0,
    [int]$MaxVus = 0,
    [int]$GracefulStopSeconds = 30,
    [string]$BaseUrl = "http://127.0.0.1:3000"
)

if ($WritesPerSecond -le 0) {
    throw "WritesPerSecond must be greater than zero."
}
if ($DurationSeconds -le 0) {
    throw "DurationSeconds must be greater than zero."
}
if ($GracefulStopSeconds -le 0) {
    throw "GracefulStopSeconds must be greater than zero."
}
if ($PreAllocatedVus -le 0) {
    $PreAllocatedVus = $WritesPerSecond * 2
}
if ($MaxVus -le 0) {
    $MaxVus = $PreAllocatedVus * 2
}
if ($MaxVus -lt $PreAllocatedVus) {
    throw "MaxVus must be greater than or equal to PreAllocatedVus."
}

$ExpectedWrites = $WritesPerSecond * $DurationSeconds

Write-Host "Starting survey-create throughput test"
Write-Host "Target rate:       $WritesPerSecond creates/second"
Write-Host "Duration:          $DurationSeconds seconds"
Write-Host "Expected minimum:  $ExpectedWrites persisted documents"
Write-Host "Preallocated VUs:  $PreAllocatedVus"
Write-Host "Maximum VUs:       $MaxVus"
Write-Host "Graceful stop:     $GracefulStopSeconds seconds"
Write-Host "Target:            $BaseUrl"
Write-Host "Warning: this creates at least $ExpectedWrites real documents in the configured dataset."

& "$PSScriptRoot\k6.exe" run `
    -e "WRITES_PER_SECOND=$WritesPerSecond" `
    -e "DURATION_SECONDS=$DurationSeconds" `
    -e "PRE_ALLOCATED_VUS=$PreAllocatedVus" `
    -e "MAX_VUS=$MaxVus" `
    -e "GRACEFUL_STOP_SECONDS=$GracefulStopSeconds" `
    -e "BASE_URL=$BaseUrl" `
    "$PSScriptRoot\writers-throughput.js"

exit $LASTEXITCODE
