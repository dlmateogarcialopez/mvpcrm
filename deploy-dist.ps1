# Copy all dist files to container
$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
$base = 'E:\programacion\MVP\dist\'

# Server dist files
$files = @('index.js','db-46WAVFQA.js','db-OP3SFPTA.js','schema-PORUMI7W.js','schema-PBV7GMCM.js','static-JIMLBLQV.js','chunk-P3VVE3PN.js','chunk-SGZPQXHC.js','chunk-5KLYAQ5F.js','chunk-W6EHTHGP.js','vite.config-NYCQERCE.js','vite-U2C6ZJ4Y.js')
foreach($f in $files) {
  & $docker cp ($base+$f) ('mv-app:/app/dist/'+$f) 2>&1 | Out-Null
}

# Create public dirs and copy
& $docker exec -i mv-app mkdir -p /app/dist/public/assets 2>&1 | Out-Null
& $docker cp ('E:\programacion\MVP\dist\public\index.html') mv-app:/app/dist/public/index.html 2>&1 | Out-Null

# Client assets - get current names
$clientJs = (Get-ChildItem 'E:\programacion\MVP\dist\public\assets\index-*.js' | Select-Object -First 1).Name
$clientCss = (Get-ChildItem 'E:\programacion\MVP\dist\public\assets\index-*.css' | Select-Object -First 1).Name
$twilioJs = (Get-ChildItem 'E:\programacion\MVP\dist\public\assets\twilio-*.js' | Select-Object -First 1).Name

Write-Output "JS: $clientJs, CSS: $clientCss, Twilio: $twilioJs"

& $docker cp ('E:\programacion\MVP\dist\public\assets\'+$clientJs) ('mv-app:/app/dist/public/assets/'+$clientJs) 2>&1 | Out-Null
& $docker cp ('E:\programacion\MVP\dist\public\assets\'+$clientCss) ('mv-app:/app/dist/public/assets/'+$clientCss) 2>&1 | Out-Null
& $docker cp ('E:\programacion\MVP\dist\public\assets\'+$twilioJs) ('mv-app:/app/dist/public/assets/'+$twilioJs) 2>&1 | Out-Null

# Restart
& $docker restart mv-app 2>&1 | Out-Null
Write-Output "Deployed and restarted"
