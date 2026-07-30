param(
    [int]$Vus = 25,
    [int]$Iterations = 0,
    [int]$MaxDurationSeconds = 90,
    [string]$BaseUrl = "http://127.0.0.1:3000"
)

if ($Vus -le 0) {
    throw "Vus must be greater than zero."
}
if ($Iterations -le 0) {
    $Iterations = $Vus
}
if ($MaxDurationSeconds -le 0) {
    throw "MaxDurationSeconds must be greater than zero."
}

Write-Host "Starting survey-create burst ceiling test"
Write-Host "Virtual users:     $Vus"
Write-Host "Create attempts:   $Iterations"
Write-Host "Maximum duration:  $MaxDurationSeconds seconds"
Write-Host "Target:            $BaseUrl"
Write-Host "Warning: this creates $Iterations real documents in the configured dataset."

& "$PSScriptRoot\k6.exe" run `
    -e "WRITERS_VUS=$Vus" `
    -e "WRITERS_ITERATIONS=$Iterations" `
    -e "WRITERS_MAX_DURATION_SECONDS=$MaxDurationSeconds" `
    -e "BASE_URL=$BaseUrl" `
    "$PSScriptRoot\writers-ceiling.js"

exit $LASTEXITCODE
