# Starts the Firebase emulators (sign-in and database) for local testing.
# Open http://localhost:8765/?emu while they run. Needs Java and firebase-tools.
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  $jdk = Get-ChildItem 'C:\Program Files\Microsoft' -Directory -Filter 'jdk-*' -ErrorAction SilentlyContinue | Select-Object -Last 1
  if ($jdk) { $env:JAVA_HOME = $jdk.FullName; $env:Path = "$($jdk.FullName)\bin;$env:Path" }
}
Set-Location (Split-Path $PSScriptRoot -Parent)
firebase emulators:start --only auth,firestore --project demo-tab
