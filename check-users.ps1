$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
& $docker exec -i mv-database mysql -umv_user -pmv_password cotizador_leads -e 'DESCRIBE users' 2>&1
