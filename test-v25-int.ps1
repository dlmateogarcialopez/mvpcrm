$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
& $docker cp 'E:\programacion\MVP\check-v25.js' mv-app:/tmp/check-v25.js 2>&1
& $docker exec -i mv-app node /tmp/check-v25.js 2>&1
