$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
$files = Get-ChildItem 'E:\programacion\MVP\drizzle\*.sql' | Where-Object Name -match '^00(0[0-9]|1[0-7])' | Sort-Object Name
# Skip first 3 since they were already applied
$files = $files | Select-Object -Skip 3
foreach ($f in $files) {
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
