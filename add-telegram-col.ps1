Add-Content -Path 'E:\programacion\MVP\0018-fix.sql' -Value 'ALTER TABLE `users` ADD COLUMN `telegramChatId` varchar(64) NULL AFTER `role`;'
$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
$content = Get-Content 'E:\programacion\MVP\0018-fix.sql' -Raw
& $docker exec -i mv-database mysql -umv_user -pmv_password cotizador_leads 2>&1
Write-Output 'telegramChatId column added'
Remove-Item 'E:\programacion\MVP\0018-fix.sql' -Force
