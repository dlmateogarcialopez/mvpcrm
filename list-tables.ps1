$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
$query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'cotizador_leads' ORDER BY table_name"
& $docker exec -i mv-database mysql -umv_user -pmv_password cotizador_leads -e $query 2>&1
