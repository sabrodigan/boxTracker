# BoxTracker Security Hardening Checklist

Tracks security hardening for the production deployment at **boxtracker.net**
(GCP VM, Caddy terminating TLS → Go app on `127.0.0.1:8091`, MongoDB local).

_Last updated: 2026-07-04_

## Completed
- [x] MongoDB bound to localhost only (`bindIp: 127.0.0.1`); port 27017 not reachable externally
- [x] Session secret loaded from `SESSION_SECRET` env, fail-closed if unset — `auth.go` + systemd drop-in / `/etc/boxtracker.env`
- [x] IDOR / ownership checks on all box & item handlers (every query scoped by `user_id`, 404 when not owned) — `handlers.go`
- [x] `myadmin` MongoDB password changed from a weak value to a passphrase
- [x] Configurable listen address (`LISTEN_ADDR`, defaults to loopback for prod safety) — `main.go`
- [x] SSH is key-only (password authentication disabled on the VM)

## Remaining

### High
- [ ] **Session cookie flags + CSRF** — in `auth.go`, add `Secure: true` and `SameSite: Lax` to the session options; add CSRF protection for cookie-authed state-changing endpoints (POST/PUT/DELETE/PATCH).
- [ ] **Rotate & relocate inline secrets** — the systemd unit (`/etc/systemd/system/boxtracker.service`) stores the Google/Facebook OAuth client secrets and the `boxtracker_user` Mongo password as plaintext `Environment=` lines. Rotate them and move into a root-only env file (as done for `SESSION_SECRET`).

### Medium
- [ ] **Rate limiting** on `/api/login` and `/api/register` (app-level or via Caddy/fail2ban) to stop password brute force.
- [ ] **HTTP security headers** in the Caddyfile — HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options` (or CSP `frame-ancestors`), `Referrer-Policy`, and a Content-Security-Policy.
- [ ] **Search regex ReDoS** — `searchHandler` in `handlers.go` passes user input straight into a MongoDB regex; escape with `regexp.QuoteMeta` or use a text index.
- [ ] **Request body size limits** — wrap JSON handlers with `http.MaxBytesReader` to prevent memory-exhaustion DoS.
- [ ] **GCP firewall** — remove the now-moot 27017 ingress rule (defense in depth); optionally restrict SSH (22) to known source IPs.

### Low / operational
- [ ] **Username enumeration** — `/api/register` returns "Username already exists"; use a neutral message.
- [ ] **Server banner** — suppress the `Server: Caddy` response header.
- [ ] **systemd sandboxing** — add `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`; consider a dedicated non-login service user.
- [ ] **Backups & patching** — automated encrypted `mongodump` backups; enable `unattended-upgrades` for security patches.

## Reference
- **Prod host:** GCP VM (`34.89.88.206` / `boxtracker.net`); Caddy terminates TLS and reverse-proxies to the Go app on `127.0.0.1:8091`.
- **DB users:** app uses `boxtracker_user` (authSource `boxtracker`); admin is `myadmin` (authSource `admin`). Mongo listens on `127.0.0.1:27017` only.
- **Deploy:** `./deploy.sh` (builds frontend + Go binary, scp to VM, restarts the `boxtracker` systemd service).
- **Local LAN dev:** run with `LISTEN_ADDR=0.0.0.0:8091` to expose the dev server on the LAN.
