$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
& $docker exec -i mv-app cat /app/dist/public/index.html 2>&1 | Select-String -Pattern 'index-' | Select-Object -First 5
