$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
& $docker exec -i mv-app sh -c 'cd /app && DATABASE_URL=mysql://mv_user:mv_password@db:3306/cotizador_leads npx drizzle-kit push --config=drizzle.config.ts --force 2>&1' | Select-Object -First 30
