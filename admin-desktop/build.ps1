$ErrorActionPreference = "Stop"
$project = Join-Path $PSScriptRoot "LarocheAdmin.vbproj"
$output = Join-Path $PSScriptRoot "publish\win-x64"

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
  throw "Installez le SDK .NET 10 pour Windows avant de compiler."
}

Remove-Item $output -Recurse -Force -ErrorAction SilentlyContinue
dotnet publish $project `
  --configuration Release `
  --runtime win-x64 `
  --self-contained true `
  -p:PublishSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  -p:EnableCompressionInSingleFile=true `
  --output $output

if ($LASTEXITCODE -ne 0) { throw "La compilation de LarocheAdmin.exe a échoué." }
Write-Host "Exécutable créé : $output\LarocheAdmin.exe"
Write-Host "Microsoft Edge WebView2 Runtime doit être installé sur le PC cible."
