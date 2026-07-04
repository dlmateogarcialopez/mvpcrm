$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
$query = "SELECT TABLE_SCHEMA, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'telegramChatId'"
& $docker exec -i mv-database mysql -umv_user -pmv_password cotizador_leads -e $query 2>&1
