import {verifyFirebaseAdmin} from "./firebase-auth.js";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if(url.pathname !== "/health") {
      return new Response("Not Found", {status:404});
    }

    return Response.json({
      ok:true,
      firebaseModule:typeof verifyFirebaseAdmin,
      service:"ADNER FIREBASE AUTH TEST"
    });
  }
};