$env:ErrorActionPreference = 'Stop'
# Load .env variables
if (Test-Path -Path ".env") {
  Get-Content ".env" | ForEach-Object {
    if ($_ -match '^(.*?)=(.*)$') {
      $key = $matches[1]
      $value = $matches[2]
      [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
  }
}
# Load siteId from Netlify state
$statePath = "./.netlify/state.json"
if (Test-Path $statePath) {
  $siteId = (Get-Content $statePath -Raw | ConvertFrom-Json).siteId
} else {
  Write-Error "Netlify state file not found"
}
# Ensure Node version for Netlify build
$env:NODE_VERSION = "20"
# Log in to Netlify using the auth token (must be set in environment)
if (-not $env:NETLIFY_AUTH_TOKEN) {
  Write-Error "NETLIFY_AUTH_TOKEN not set in environment"
}
netlify login --auth-token $env:NETLIFY_AUTH_TOKEN
# Deploy to production
netlify deploy --prod --site $siteId --auth $env:NETLIFY_AUTH_TOKEN
