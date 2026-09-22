# VPS deployment

Chartize runs as one Node 24 process under PM2, behind the host's Nginx. Docker is not needed. The studio and dataset catalog are public. Chartize AI requires ATProto sign-in; the admin console also requires a grant in the private `admin_accounts` table.

## Build and copy

Copy the repository without `.git`, `node_modules`, `.next`, macOS metadata or local auth state. Keep the VPS's `.env` and `data/` intact. If using an archive from macOS, set `COPYFILE_DISABLE=1` and exclude `._*` and `.DS_Store`.

For a first installation, copy the published DuckDB catalog and Parquet artifacts too; they are not in Git. Do not overwrite the VPS's private `data/auth/` with a developer's local test sessions.

A local build is useful for checking the app, but native DuckDB dependencies must match the VPS's OS and architecture. The simplest reproducible production build is on the VPS:

```bash
cd /home/dialup/chartize
pnpm install --frozen-lockfile
pnpm fetch:spatialite
NODE_OPTIONS=--max-old-space-size=1536 pnpm --filter @chartize/web build
cp -R apps/web/public apps/web/.next/standalone/apps/web/public
cp -R apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
```

Next's standalone directory does not include `public/` or `.next/static/` automatically. Missing these produces the HTML-without-CSS/JavaScript failure seen in earlier deployments.

The Next config runs Webpack in a separate, memory-optimized build worker and limits build parallelism to two workers. This lets compilation release its heap before typechecking on the 4 GB VPS. The build command above also caps each Node heap; typechecking remains enabled.

## Environment and PM2

Keep the VPS secrets in `/home/dialup/chartize/.env` (mode 600), with `OPENAI_API_KEY` and `AI_TEXT_MODEL=gpt-6-luna`. Update an existing `AI_TEXT_MODEL` override when upgrading models; it takes precedence over the application default. `ADMIN_TOKEN` is optional for command-line dataset seeding; if enabled, use a real secret rather than the example placeholder. Browser administration uses the signed-in account's role.

[The PM2 config](../infra/pm2/chartize.config.cjs) sets the loopback port, public URL and data directory. Adjust its paths and Node interpreter for another VPS. Keep one instance: transient AI continuations, the Wikipedia queue, and active-request limits are process-local; sessions and daily counters are in SQLite.

```bash
pm2 stop chartize
pm2 startOrRestart infra/pm2/chartize.config.cjs --update-env
pm2 save
```

This restarts only Chartize, never the VPS or other applications. For a brand-new installation omit `pm2 stop chartize`. Stop the app before replacing an existing standalone directory; start it after the new files and static assets are in place.

Local production testing needs an explicit origin:

```bash
CHARTIZE_PUBLIC_URL=http://localhost:3000 pnpm --filter @chartize/web start
```

## ATProto login

Set `CHARTIZE_PUBLIC_URL` to the site's exact HTTPS origin. The checked-in PM2 configuration uses `https://chartize.dileepreddy.com`. Nginx redirects HTTP to that HTTPS hostname, preserving the path and query string; Cloudflare must use Full or Full (strict) SSL mode for HTTPS connections to the origin. The server generates an ES256 signing key in the private auth database on first use; preserve that database across releases.

These discovery endpoints must be publicly readable, without a Basic Auth wall or a Cloudflare bot challenge:

- `/api/auth/client-metadata.json`
- `/api/auth/jwks.json`

The provider returns to `/api/auth/callback`. Do not cache `/api/auth/*` or `/api/ai/*` in Cloudflare; metadata/JWKS can use their short origin cache headers. Callback query strings contain authorization codes, so the Nginx configuration disables access logging on that route.

After a successful callback, the login window closes and the originating tab completes the session and workspace handoff. If the browser blocks closing the window, a manual return page remains. The originating tab also checks for completion when it regains focus or becomes visible.

Authentication state lives in `data/auth/sessions.sqlite` by default, with a private directory and file permissions. `CHARTIZE_AUTH_DIR` can point elsewhere. Back it up with the catalog while the app is stopped or using a consistent filesystem snapshot. Losing it logs everyone out and changes the signing key.

## Replace the remaining admin password wall

**Deploy the role-protected app and grant the administrator before changing Nginx.** Keep the live site's current admin wall while verifying the new app directly on its loopback port.

[The site configuration](../infra/nginx/chartize.dileepreddy.com.conf) delegates `/admin` and `/engine/api/admin/*` authorization to the app, removing their Basic Auth prompt. It also limits AI request size and keeps responses streamed. It retains this VPS's existing Cloudflare/origin TLS setup; other installations should use their own certificate and hostname.

Once the updated app initializes its auth database, grant the account in the VPS's own database using the [admin-account SQL](../README.md#admin-accounts). Check that the `atproto` row for `did:plc:aaaaaaaaaaaaaaaaaaaaaaaa` exists. Preserve existing sessions, signing keys, quotas and other admin rows; do not copy the local auth database to the VPS.

Before opening the site, verify:

1. Signed-out `POST /api/ai/query` cannot invoke the model (401 for a same-origin request).
2. Public homepage, explorer, catalog, WASM and Parquet requests load normally.
3. Metadata/JWKS are reachable from outside the VPS.
4. A real ATProto login works, a chat completes, and logout blocks the next chat.
5. Anonymous and non-admin requests cannot open the admin console or invoke its Server Actions, imports or rollback. Browser API mutations require the correct Origin as well as an admin session.
6. The granted account sees the admin profile-menu button and can open the console without a separate token. Revoking its database row blocks further admin requests from the existing session.

Then install the Nginx configuration, run `nginx -t`, and reload Nginx. Do not reboot the VPS. The old password file becomes unused and need not be copied or modified.

## Usage controls

Defaults: 50 new turns per account per UTC day, 300 across the site, one active request per account, four globally. A browser-data continuation does not count as another new turn. Automatic repair attempts do count.

Set `CHARTIZE_AI_USER_DAILY_TURNS` and `CHARTIZE_AI_DAILY_TURNS` to change the daily allowances. Zero disables new turns. These limits are not a precise spending cap: thinking level, tool rounds and response length affect token use. Configure an OpenAI project budget too.

Each user turn permits one web-enabled model response, six Wikipedia calls, ten model responses, and three browser-data continuations. The built-in tool limit is requested as `max_tool_calls: 1`; a web response can still include search and page-open events, so this is not a guarantee of a fixed billed amount. Luna chooses when to enable paid research. Wikipedia searches include the top article's bounded text; request starts are spaced apart and independent reads can overlap. There is no persistent article cache or dump.
