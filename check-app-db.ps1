$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
$query = 'SELECT DATABASE() as current_db, USER() as current_user, @@hostname as host'
& $docker exec -i mv-app sh -c "mysql -h db -u mv_user -pmv_password cotizador_leads -e '$query' 2>&1" 2>&1
