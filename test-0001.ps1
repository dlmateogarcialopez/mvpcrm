$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
# Drop and recreate to start clean
& $docker exec -i mv-database mysql -uroot -proot_password -e 'DROP DATABASE cotizador_leads; CREATE DATABASE cotizador_leads CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL ON cotizador_leads.* TO "mv_user"@"%"; FLUSH PRIVILEGES;' 2>&1 | Out-Null
Write-Output 'Recreated DB'
# Apply just 0001 and see error
$tmp = New-TemporaryFile
Copy-Item 'E:\programacion\MVP\drizzle\0001_empty_unicorn.sql' $tmp.FullName -Force
& $docker cp $tmp.FullName 'mv-database:/tmp/apply.sql' 2>&1 | Out-Null
& $docker exec -i mv-database mysql -umv_user -pmv_password cotizador_leads -e 'SOURCE /tmp/apply.sql' 2>&1
Remove-Item $tmp -Force
