param(
    [int]$ReadsPerSecond = 100,
    [int]$DurationSeconds = 30,
    [int]$PreAllocatedVus = 0,
    [int]$MaxVus = 0,
    [int]$GracefulStopSeconds = 30,
    [string]$SseLimit = "all",
    [string]$BaseUrl = "http://127.0.0.1:3000"
)

if ($ReadsPerSecond -le 0) {
    throw "ReadsPerSecond must be greater than zero."
}
if ($DurationSeconds -le 0) {
    throw "DurationSeconds must be greater than zero."
}
if ($GracefulStopSeconds -le 0) {
    throw "GracefulStopSeconds must be greater than zero."
}
if ($PreAllocatedVus -le 0) {
    $PreAllocatedVus = $ReadsPerSecond * 2
}
if ($MaxVus -le 0) {
    $MaxVus = $PreAllocatedVus * 2
}
if ($MaxVus -lt $PreAllocatedVus) {
    throw "MaxVus must be greater than or equal to PreAllocatedVus."
}

$ExpectedReads = $ReadsPerSecond * $DurationSeconds

Write-Host "Starting SSE read-throughput test"
Write-Host "Target rate:       $ReadsPerSecond complete SSE reads/second"
Write-Host "Duration:          $DurationSeconds seconds"
Write-Host "Expected minimum:  $ExpectedReads complete SSE reads"
Write-Host "Preallocated VUs:  $PreAllocatedVus"
Write-Host "Maximum VUs:       $MaxVus"
Write-Host "Graceful stop:     $GracefulStopSeconds seconds"
Write-Host "SSE limit:         $SseLimit"
Write-Host "Target:            $BaseUrl"

& "$PSScriptRoot\k6.exe" run `
    -e "READS_PER_SECOND=$ReadsPerSecond" `
    -e "DURATION_SECONDS=$DurationSeconds" `
    -e "PRE_ALLOCATED_VUS=$PreAllocatedVus" `
    -e "MAX_VUS=$MaxVus" `
    -e "GRACEFUL_STOP_SECONDS=$GracefulStopSeconds" `
    -e "SSE_LIMIT=$SseLimit" `
    -e "BASE_URL=$BaseUrl" `
    "$PSScriptRoot\sse-throughput.js"

exit $LASTEXITCODE
