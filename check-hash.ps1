$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
& $docker exec -i mv-app sh -c "cat /app/dist/public/index.html" 2>&1 | grep -oE 'index-[A-Za-z0-9_]+\.js' | head -3
