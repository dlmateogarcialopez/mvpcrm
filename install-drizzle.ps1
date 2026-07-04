$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
$env:DATABASE_URL='mysql://mv_user:mv_password@db:3306/cotizador_leads'
& $docker exec -i mv-app sh -c 'DATABASE_URL=mysql://mv_user:mv_password@db:3306/cotizador_leads npm install -g drizzle-kit 2>&1 | tail -5'
