# VPS preview deployment

This path keeps Nginx and TLS on the host and publishes only Next.js on `127.0.0.1:3000`. The same process serves the application, the fixed catalog/artifact API, and authenticated steward actions. The `data/` directory holds catalog metadata, original source artifacts, and versioned Parquet tables.

## 1. Package and copy

From the project directory on the development machine:

```bash
tar --exclude=.git --exclude=node_modules --exclude='**/target' --exclude='**/.next' --exclude=data \
  -czf chartize-preview.tgz .
scp chartize-preview.tgz your-vps:/tmp/
```

On the VPS:

```bash
sudo mkdir -p /srv/chartize
sudo tar -xzf /tmp/chartize-preview.tgz -C /srv/chartize
cd /srv/chartize
cp .env.example .env
```

Set a long random `ADMIN_TOKEN`, keep `AI_TEXT_MODEL=gpt-5.6-luna`, and add the OpenAI key to `/srv/chartize/.env`. Restrict that file with `chmod 600 .env`.

## 2. Start the private application

```bash
docker compose up --build -d web
docker compose ps
curl --fail http://127.0.0.1:3000/engine/api/health
curl --fail http://127.0.0.1:3000/explore >/dev/null
```

Do not start the `caddy` service when host Nginx owns ports 80 and 443.

## 3. Seed the dataset catalog

The Compose tool profile runs the acquisition manifest inside the same private network:

```bash
docker compose --profile tools run --rm seed
```

This publishes the starter polling, Census population and boundary tables plus CDC PLACES and the two BEA county economic tables. The MIT county election file and ACS profile remain deliberate manual imports because Harvard requires a download-guestbook response and Census requires an API key, respectively.

## 4. Put Nginx and Basic Auth in front

```bash
sudo apt-get update
sudo apt-get install -y nginx apache2-utils certbot python3-certbot-nginx
sudo htpasswd -c /etc/nginx/.htpasswd-chartize YOUR_PREVIEW_USERNAME
sudo cp /srv/chartize/infra/nginx/chartize.conf.example /etc/nginx/sites-available/chartize
sudo sed -i 's/chartize.example.com/YOUR_CHARTIZE_SUBDOMAIN/' /etc/nginx/sites-available/chartize
sudo ln -s /etc/nginx/sites-available/chartize /etc/nginx/sites-enabled/chartize
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d YOUR_CHARTIZE_SUBDOMAIN
```

Basic Auth credentials should only be used after HTTPS is active. The ACME challenge path is exempt so certificate renewal remains unattended.

## 5. Update and back up

Before replacing the application directory, keep `/srv/chartize/data`. To update code, unpack a new archive over `/srv/chartize`, then run:

```bash
docker compose up --build -d web
docker image prune -f
```

Back up Chartize data as one unit while the service is stopped or from a filesystem snapshot:

```bash
docker compose stop web
sudo tar -C /srv/chartize -czf /var/backups/chartize-data-$(date +%F).tgz data
docker compose start web
```

Monitor disk use with `du -sh /srv/chartize/data` and `df -h /srv/chartize`. The importer stages the original, normalized table, and Parquet copy, and refuses an import when its safety reserve cannot be met.
