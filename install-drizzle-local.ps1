$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
& $docker exec -i mv-app sh -c 'cd /app && npm install --no-save drizzle-kit tsx 2>&1 | tail -3' | Select-Object -Last 5
