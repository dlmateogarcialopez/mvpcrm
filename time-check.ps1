$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'

Write-Output "=== Node.js Date.now() ==="
& $docker exec -i mv-app node -e "console.log(Date.now())"

Write-Output ""
Write-Output "=== MySQL UNIX_TIMESTAMP(NOW(3))*1000 ==="
& $docker exec -i mv-database mysql -umv_user -pmv_password cotizador_leads -sN -e "SELECT UNIX_TIMESTAMP(NOW(3))*1000"
