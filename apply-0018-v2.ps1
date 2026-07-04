$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
Get-Content 'E:\programacion\MVP\0018-raw.sql' -Raw | & $docker exec -i mv-database mysql -umv_user -pmv_password cotizador_leads 2>&1
Remove-Item 'E:\programacion\MVP\0018-raw.sql' -Force
