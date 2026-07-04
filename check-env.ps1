$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
$output = & $docker inspect mv-app --format '{{json .Config.Env}}' 2>&1 | Out-String
$start = $output.IndexOf('"DATABASE')
if ($start -gt 0) {
    Write-Output $output.Substring($start, 200)
} else {
    Write-Output 'DATABASE not found in env'
}
