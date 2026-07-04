$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
& $docker logs mv-app --tail 50 2>&1 | Where-Object { $_ -match 'Automation|Telegram|status_changed|updateStatus' } | Select-Object -Last 20
