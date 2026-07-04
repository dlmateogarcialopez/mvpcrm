$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'

# Recreate DB first
& $docker exec -i mv-database mysql -uroot -proot_password -e 'DROP DATABASE cotizador_leads; CREATE DATABASE cotizador_leads CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL ON cotizador_leads.* TO "mv_user"@"%"; FLUSH PRIVILEGES;' 2>&1 | Out-Null
Write-Output 'Recreated DB'

# Apply all migrations with statement-breakpoint removed
$files = Get-ChildItem 'E:\programacion\MVP\drizzle\*.sql' | Where-Object Name -match '^00(0[0-9]|1[0-7])' | Sort-Object Name
foreach ($f in $files) {
    # Read content, remove Drizzle breakpoints, write to temp
    $content = Get-Content $f.FullName -Raw
    $cleaned = $content -replace '\s*-->\s*statement-breakpoint\s*', "`n"
    $tmp = New-TemporaryFile
    [System.IO.File]::WriteAllText($tmp.FullName, $cleaned, [System.Text.UTF8Encoding]::new($false))
    & $docker cp $tmp.FullName 'mv-database:/tmp/apply.sql' 2>&1 | Out-Null
    $result = & $docker exec -i mv-database mysql -umv_user -pmv_password cotizador_leads -e 'SOURCE /tmp/apply.sql' 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Output ('OK: ' + $f.Name)
    } else {
        Write-Output ('FAIL: ' + $f.Name + ' - ' + $result)
    }
    Remove-Item $tmp -Force
}
