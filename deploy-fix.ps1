$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'

# Clean
& $docker exec mv-app sh -c 'rm -rf /app/dist/public/assets /app/dist/*.js /app/dist/*.map' 2>&1 | Out-Null
& $docker exec mv-app mkdir -p /app/dist/public/assets 2>&1 | Out-Null

# Server dist
foreach ($f in (Get-ChildItem 'E:\programacion\MVP\dist\*.js' -ErrorAction SilentlyContinue)) {
    & $docker cp $f.FullName "mv-app:/app/dist/$($f.Name)" 2>&1 | Out-Null
}

# Client dist (none changed but ensure sync)
$js = (Get-ChildItem 'E:\programacion\MVP\dist\public\assets\index-*.js' | Where-Object Name -notlike '*.css' | Select-Object -First 1).Name
$css = (Get-ChildItem 'E:\programacion\MVP\dist\public\assets\index-*.css' | Select-Object -First 1).Name
$twilio = (Get-ChildItem 'E:\programacion\MVP\dist\public\assets\twilio-*.js' | Select-Object -First 1).Name
if ($js) { & $docker cp "E:\programacion\MVP\dist\public\assets\$js" "mv-app:/app/dist/public/assets/$js" 2>&1 | Out-Null }
if ($css) { & $docker cp "E:\programacion\MVP\dist\public\assets\$css" "mv-app:/app/dist/public/assets/$css" 2>&1 | Out-Null }
if ($twilio) { & $docker cp "E:\programacion\MVP\dist\public\assets\$twilio" "mv-app:/app/dist/public/assets/$twilio" 2>&1 | Out-Null }

# Restart
& $docker restart mv-app 2>&1 | Out-Null
Start-Sleep -Seconds 6
& $docker logs mv-app --tail 3 2>&1
