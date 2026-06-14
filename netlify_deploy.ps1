# PowerShell script to deploy Netlify with proper env loading

# Load .env variables into process environment
$envFile = "c:/Rishabh/App Development/Auto Apply Jobs/.env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
      $key = $matches[1].Trim()
      $value = $matches[2].Trim()
      # Set environment variable for this session
            Set-Item -Path "Env:$key" -Value $value
    }
  }
}

# Retrieve site ID for autojobsapply
$siteJson = npx netlify-cli sites:list --json
$site = $siteJson | ConvertFrom-Json | Where-Object { $_.name -eq 'autojobsapply' }
$siteId = $site.id

# Deploy to Netlify (production)
npx netlify-cli deploy --prod --site $siteId --auth $env:NETLIFY_AUTH_TOKEN
