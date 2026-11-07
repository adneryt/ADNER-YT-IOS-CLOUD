import {createRemoteJWKSet,jwtVerify} from "jose";

const PROJECT_ID = "adner-yt-ios-cloud";
const ADMIN_UID = "OxWCNpO2vRQT0ejIRPFmjU5Ygit2";

const keys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
  {timeoutDuration:5000,cooldownDuration:30000}
);

// The factory permits offline tests with generated keys. Production always uses Google's JWKS.
export function createFirebaseVerifier(keySet, projectId = PROJECT_ID, adminUid = ADMIN_UID) {
 return async function(token) {
  if (typeof token !== 'string' || !token || token.length > 10000) return false;

  try {
    const {payload} = await jwtVerify(token, keySet, {
      algorithms: ["RS256"],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
      requiredClaims:['sub','iat','exp','auth_time']
    });

    const now = Math.floor(Date.now() / 1000);

    return (
      payload.sub === adminUid && payload.sub.length <= 128 &&
      typeof payload.iat === "number" &&
      payload.iat > 0 && payload.iat <= now &&
      typeof payload.auth_time === "number" &&
      payload.auth_time > 0 && payload.auth_time <= now
    );
  } catch {
    return false;
  }
 };
}
export const verifyFirebaseAdmin = createFirebaseVerifier(keys);
