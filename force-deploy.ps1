$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'

# Force deploy
& $docker exec mv-app sh -c 'rm -f /app/dist/public/assets/*' 2>&1 | Out-Null
$js = (Get-ChildItem 'E:\programacion\MVP\dist\public\assets\index-*.js' | Where-Object Name -notlike '*.css' | Select-Object -First 1).Name
$css = (Get-ChildItem 'E:\programacion\MVP\dist\public\assets\index-*.css' | Select-Object -First 1).Name
$twilio = (Get-ChildItem 'E:\programacion\MVP\dist\public\assets\twilio-*.js' | Select-Object -First 1).Name

Write-Output "Deploying: $js, $css, $twilio"
& $docker cp "E:\programacion\MVP\dist\public\assets\$js" "mv-app:/app/dist/public/assets/$js" 2>&1 | Out-Null
& $docker cp "E:\programacion\MVP\dist\public\assets\$css" "mv-app:/app/dist/public/assets/$css" 2>&1 | Out-Null
& $docker cp "E:\programacion\MVP\dist\public\assets\$twilio" "mv-app:/app/dist/public/assets/$twilio" 2>&1 | Out-Null
& $docker cp 'E:\programacion\MVP\dist\public\index.html' mv-app:/app/dist/public/index.html 2>&1 | Out-Null
& $docker restart mv-app 2>&1 | Out-Null
Start-Sleep -Seconds 6
Write-Output "Done"
