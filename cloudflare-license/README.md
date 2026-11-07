# ADNER licenses: local Firebase + Cloudflare integration

This branch prepares Cloudflare D1 licenses without deploying Firebase Functions.
Public Worker deployed on 2026-11-07; see DEPLOYMENT.md for verified URL and tests.
The web config now points to it. IPA license enforcement remains disabled.

Verified locally on 2026-11-07: the user signed into the actual local web admin;
Worker logs confirmed GET /admin/session 200, POST /admin/licenses 201 and
GET /admin/licenses 200. No ID tokens or generated keys are included in this report.
The initial web login was verified locally. Remote authenticated operations still
need a separate check from the published administrator origin.

## Local checks (PowerShell 5.1)

```powershell
cd C:\Users\hp\Documents\Codex\adner-admin-publicar\cloudflare-license
npm.cmd test
npm.cmd run check
node test/d1-smoke.mjs
```

`check` is `wrangler deploy --dry-run`: bundles only, no remote deployment.
The D1 smoke uses its own `.wrangler/isolated-integration` persistence. It creates
test licenses but never removes the existing database, keys or backups.

Local preview currently uses `http://localhost:8766/WEB-ADMIN/` with a separate
Worker at `http://127.0.0.1:8790`. The pre-existing 8789 server is untouched.
The local server's database is separate from the user's prior test key database.

```powershell
npx.cmd --no-install wrangler d1 execute adner-yt-ios-licenses --local --persist-to .wrangler/isolated-integration --file migrations/0001_licenses.sql
npx.cmd --no-install wrangler dev --port 8790 --var ALLOW_LOCAL_ORIGINS:true --persist-to .wrangler/isolated-integration
```

Do not add `--remote` to these local commands. The existing production D1 binding
and migration file are retained. No destructive migration was introduced.

## Authentication and CORS

The active `src/index.js` now accepts Firebase ID tokens through
`src/firebase-auth.js`: Google RS256 signature, project audience/issuer, exact
admin UID, exp/iat/auth_time. The user confirmed the configured UID. The existing
ADMIN_SECRET path works only outside production with local origins enabled; it
is never sent to the web UI and no remote secret was configured. JWT verification does not currently check Firebase refresh-token
revocation/disabled-user state online; an issued ID token can remain valid until
its expiration. Review this before production deployment.

Production browser origin: `https://adneryt.github.io`. Development origins are
accepted only with `ALLOW_LOCAL_ORIGINS=true`. The origin of a GitHub Pages site
is shared across its paths: CORS cannot restrict to the WEB-ADMIN path. UID and
cryptographic authentication remain mandatory. Do not enable local origins in
the production deployment.

## Routes

- GET `/health`: local D1 health (no keys or secrets).
- GET `/admin/session`: verifies the administrator token; no DB mutation.
- GET/POST `/admin/licenses`: list latest 200 / create 1..25 keys atomically.
- POST `/admin/licenses/<id>/pause`, `/resume`, `/revoke`, `/reset-devices`.
- GET `/admin/licenses/<id>/history`: latest 200 entries.
- POST `/v1/license/check`: signed native device proof, no admin token.

Keys: ADNER- plus 24 random bytes in hexadecimal; only SHA-256 is stored. One-use
display at creation. Duration 1..8760 hours, 0 installations means no imposed
device cap. First-use duration is common to all installations. Pausing extends
expiry by the pause interval on resume. Resetting installations does not reset
the duration or revoke the key; a holder can register again.

D1 batch checks device limit and first activation atomically. Proof format is
SHA256(key) + "|" + base64(Ed25519 raw public key) + "|" + timestamp milliseconds,
signed by that private key. Timestamp tolerance five minutes, lease up to 60s.
Use TLS, never log keys/tokens/proof bodies. Production now uses a coarse
120 requests/minute/IP/location limiter; see DEPLOYMENT.md for limitations.

## Administrator / files

`license-service-client.js` sends the existing Firebase session token to the
configured license service. Localhost uses 8790; public use requires enabled=true
and the actual pinned HTTPS Worker URL. `services.js` routes only license actions
there. `uploadFile` remains on the previous Firebase Functions endpoint and is
not implemented by this Worker; advanced GitHub uploads are retained.

## Pending before release

1. Local Firebase-session validation and key creation/listing are verified. Repeat
   after deployment on the final HTTPS origin; never record ID tokens or keys.
2. Test a real new key locally, then pause/revoke/expiry and restore conflicts on
   the actual iPhone. Verify network loss and app suspension behavior.
3. Review Firebase token revocation handling, rate limits, pagination, and UI
   feedback for expired keys. Paused licenses can reach the IPA's previously
   cached expiry while offline; this behavior needs an explicit device test.
4. Only after authorization and tests: deploy Worker/D1 migration non-destructively,
   configure public base URL, pin the same origin in the IPA, enable licenses.
5. Compile V4.5 on macOS Actions. Windows tests do not verify Swift compilation.

The original PowerShell signInWithPassword HTTP 400 cause was not recovered.
Do not label it a password error: the user's web-admin screenshot shows a valid
session, but the original REST request's Firebase error code remains unknown.
