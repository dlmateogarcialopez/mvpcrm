$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
$query = 'SHOW COLUMNS FROM users'
& $docker exec -i mv-database mysql -umv_user -pmv_password cotizador_leads -e $query 2>&1 | Out-String
