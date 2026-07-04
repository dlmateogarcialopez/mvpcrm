$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
$remaining = @('0014_multi_tenant.sql', '0014_multi_tenant_v2.sql', '0015_dialer.sql', '0016_phone_lists.sql', '0017_phone_lists_auto_message.sql')
foreach ($name in $remaining) {
    $f = Get-ChildItem 'E:\programacion\MVP\drizzle\' -Filter $name
    if ($f) {
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
}
Write-Output '--- Tables now ---'
& $docker exec -i mv-database mysql -umv_user -pmv_password cotizador_leads -e 'SHOW TABLES' 2>&1
