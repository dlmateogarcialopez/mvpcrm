Get-ChildItem 'E:\programacion\MVP\drizzle\*.sql' | Where-Object Name -match '^00(0[0-9]|1[0-7])' | Sort-Object Name | ForEach-Object { $_.Name }
