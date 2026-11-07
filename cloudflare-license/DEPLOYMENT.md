# First production deployment — 2026-11-07

- Worker: `adner-yt-ios-license`
- Account subdomain registered and read back: `adnerytios`
- Verified HTTPS URL: https://adner-yt-ios-license.adnerytios.workers.dev
- Worker version: `e5f3925e-b301-4df6-902d-2076707f87ee`
- Source commit deployed: `e32ebbe`
- D1 binding: `DB` / `adner-yt-ios-licenses` (existing database).

Remote inspection found `licenses`, `license_devices`, `license_history` and
`d1_migrations`. No migration was reapplied and no existing data was removed.
The Worker did not exist before deployment. The API confirms workers.dev enabled,
preview URLs disabled, and an empty list of remote secrets. No ADMIN_SECRET was
uploaded. Production ignores that credential even if accidentally provided later.

Production config: DEPLOYMENT_ENV=production; ALLOW_LOCAL_ORIGINS=false;
REQUEST_LIMITER binding at 120 requests/60 seconds per client IP and Cloudflare
location. This is coarse abuse protection with approximate distributed counters,
not a strict global quota. Shared mobile IPs may share this budget.

## Verified remotely over HTTPS

| Request | Status |
| --- | --- |
| GET /health | 200, D1 connected |
| GET /admin/session without authorization | 401 |
| GET /admin/session with invalid token | 401 |
| GET /admin/session from unrelated Origin | 403 |
| OPTIONS /admin/session from https://adneryt.github.io | 204 |
| OPTIONS /admin/session from localhost | 403 |
| POST /v1/license/check with invalid proof | 403 |

Five local tests and Wrangler dry-run passed before deployment. The first HTTPS
probe immediately after registration failed during TLS setup; a subsequent normal
Windows curl request succeeded. Certificate verification was never disabled.

## Still pending

- Actual Firebase administrator token accepted by the public Worker: must test
  from the published administrator origin after web publication. Prior successful
  login/key creation was against the local server, not this remote deployment.
- Real web operations against remote D1 and iPhone Ed25519 validation.
- iPhone pause/expiry/revocation, offline behavior, restoration and conflicts.
- The IPA remains licenseEnabled=false; no claim of active key protection.
- Firebase ID-token revocation/disabled-user lookup is not implemented. A signed
  ID token can remain valid until its expiration. Do not confuse license revocation
  (implemented in D1) with revocation of the Firebase administrator session.
- ZIP upload remains separate. This Worker has no uploadFile route.

Never record authorization headers, keys, signatures or private device material
in this file or public diagnostics. Do not migrate local test keys automatically.
