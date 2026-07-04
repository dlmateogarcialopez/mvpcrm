$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
& $docker exec -i mv-database mysql -umv_user -pmv_password cotizador_leads -e 'SHOW COLUMNS FROM users LIKE "telegramChatId"' 2>&1
