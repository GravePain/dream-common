# Hosting plan: VPS (BinaryLane, Australia)

Goal: the portal, World Builder and Skyfall Blade always online at one domain, on a VPS.

## 1. The rule that shapes everything

World Builder (~730 MB) and Skyfall (~78 MB) serve bought asset-store files from `public/assets/`.
Until that art is replaced or its licences are checked, **the whole site sits behind a login**
(Cloudflare Access, which is free for up to 50 users, with invited emails only). Nothing under `/assets/` is ever reachable without it.
When an asset set is cleared for public use, open the paths that use it and leave the rest behind Access.

## 2. The box

- **BinaryLane Standard, 2 vCPU / 4 GB / 60 GB NVMe / 3000 GB transfer: A$19.60/mo ex GST** (A$21.56 inc), Ubuntu 24.04, in **Sydney** (or whichever city is closest to most players).
  Billed hourly and resizable from the control panel, so start here and move up or down as needed.
  - The 1 vCPU / 2 GB plan (A$9.80) can serve the sites, but `vite build` and the Node servers are tight in 2 GB. Build on this PC and upload `dist/` if you choose it.
  - The 4 vCPU / 8 GB plan (A$39.20) is the step up for when Hafen moves onto the box.
- **Transfer:** 3000 GB a month is about 3,500 full first loads of World Builder's ~730 MB. Cloudflare caches `/assets/` at its Sydney/Melbourne edges, so repeat visits don't count against it.
- **Backups:** BinaryLane's automated daily backups add-on, plus the gallery tarball below.
- **Domain** (about $10/yr) with DNS on Cloudflare. It's proxied, so Cloudflare handles HTTPS at the edge, Access, and caching of `/assets/`.
- **Caddy** as the reverse proxy on the box, using a Cloudflare origin certificate.
- **Node 22 LTS**, with each app run as a systemd service.
- The firewall allows only 22 (SSH key only) and 443 from Cloudflare's IP ranges.

## 3. Layout

| URL | Service | Port (local) |
|---|---|---|
| `/` | portal (static) | Caddy serves files |
| `/world-builder/` | World Builder production server | 5180 |
| `/skyfall/` | Skyfall production server (+ `/skyfall/coop` WebSocket) | 5190 |

Paths, not subdomains, so a single Access policy covers everything.

## 4. Code changes before deploying

1. **World Builder**
   - Set `base: '/world-builder/'` in vite.config, and make asset URLs base-relative.
   - Add `server/prod.ts`: a plain Node HTTP server that serves `dist/` and `public/assets/`, and mounts the gallery routes from `server/gallery.ts`. That means splitting the gallery's handlers out of the Vite plugin so both dev and prod use them.
   - The gallery's "local only" moderation check (`isLocal`) must change, because behind a proxy every request comes from 127.0.0.1. Use the Access identity header (`Cf-Access-Authenticated-User-Email`) and an owner email allowlist instead.
2. **Skyfall Blade**
   - Same `base: '/skyfall/'`.
   - `server/prod.ts` serves `dist/` and `public/assets/`, and hosts `coop.ts` (WebSocket) and `scores.ts`.
   - Leave `devsnap.ts` and `worldbuilder.ts` out of production, or check them for what they read (Skyfall reads World Builder's data read-only, so it needs a copy or a path to it on the box).
3. **Portal**
   - Change the links to `/world-builder/` and `/skyfall/`.
   - The "is it running" check goes through the same paths.
4. **Assets**
   - Pre-compress (gzip/brotli) the large text formats.
   - Give `/assets/` long cache headers so Cloudflare serves repeat loads.
   - FBX doesn't compress well; converting to GLB with Draco/meshopt would cut the 730 MB a lot. That's optional, and a later step.

About 1 agent-day for items 1–3.

## 5. Deploying

- **Code:** `git pull` on the box, `npm ci && npm run build`, `systemctl restart <app>`. This goes in one `deploy.sh` per app.
- **Assets:** they're gitignored, so they never go through GitHub. Use `rsync` from this PC to `/srv/<app>/public/assets/` over SSH, as a `sync-assets.bat` here.
- **Gallery data:** `/srv/world-builder/gallery/`, with a nightly tarball copied off the box to R2 (BinaryLane backups cover the box itself).

## 6. Costs

| Item | Monthly |
|---|---|
| BinaryLane 2 vCPU / 4 GB | A$21.56 inc GST |
| BinaryLane daily backups add-on | small extra (check the control panel) |
| Gallery off-site copy (R2 at these sizes) | ~A$0–1 |
| Domain (.com.au or .com) | ~A$1–2 |
| Cloudflare (DNS, proxy, Access ≤50 users) | free |
| **Total** | **≈ A$25–30** |

## 7. Later

- **Public launch:** once the art question is settled, drop Access on the cleared paths and add a rate limit on gallery publishing.
- **Hafen server:** after its shared-world refactor it can run on the same box (UDP, or WebSocket if the new client uses one). Resize to 4 vCPU / 8 GB, or a BinaryLane dedicated server, when player counts justify it.
- **R2 for assets** if traffic outgrows the VPS. It isn't needed while Access limits who can load the assets.

## Order

1. Buy the domain and move DNS to Cloudflare.
2. Create the BinaryLane server (Sydney), harden it, install Caddy and Node.
3. Make the code changes (section 4), then test locally with the production servers.
4. Deploy the apps, then rsync the assets.
5. Set up the Cloudflare Access policy, then point DNS at the box.
6. Set up the backup cron job.
