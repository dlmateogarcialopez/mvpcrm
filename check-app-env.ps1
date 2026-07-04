$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
& $docker exec -i mv-app sh -c 'env | grep -iE "DATABASE|HOST"' 2>&1
