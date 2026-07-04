Add-Content -Path 'E:\programacion\MVP\0018-apply.sql' -Value 'ALTER TABLE `users` ADD COLUMN `telegramChatId` varchar(64) NULL AFTER `role`;'
$content = Get-Content 'E:\programacion\MVP\0018-apply.sql' -Raw
Write-Output $content
Remove-Item 'E:\programacion\MVP\0018-apply.sql' -Force
