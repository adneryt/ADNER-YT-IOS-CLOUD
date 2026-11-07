const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", {fatal:true});

const bytesToBase64 = bytes => {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};

const base64ToBytes = value => {
  if(typeof value !== "string" ||
     !/^[A-Za-z0-9+/]{43}=$/.test(value)) {
    throw new Error("Clave maestra invalida");
  }

  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
};

export async function importMasterKey(secret) {
  const bytes = base64ToBytes(secret);

  if(bytes.length !== 32) {
    throw new Error("La clave maestra debe tener 256 bits");
  }

  return crypto.subtle.importKey(
    "raw",
    bytes,
    {name:"AES-GCM"},
    false,
    ["encrypt","decrypt"]
  );
}

export async function encryptLicenseKey(masterKey, licenseId, key) {
  if(typeof licenseId !== "string" ||
     !/^[a-f0-9]{64}$/.test(licenseId)) {
    throw new Error("ID de licencia invalido");
  }

  if(typeof key !== "string" ||
     !/^ADNER-[A-F0-9]{48}$/.test(key)) {
    throw new Error("Formato de key invalido");
  }

  const nonce = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    {
      name:"AES-GCM",
      iv:nonce,
      additionalData:enc.encode(licenseId),
      tagLength:128
    },
    masterKey,
    enc.encode(key)
  );

  return {
    ciphertext:new Uint8Array(ciphertext),
    nonce,
    keyVersion:1
  };
}

export async function decryptLicenseKey(
  masterKey, licenseId, ciphertext, nonce
) {
  if(typeof licenseId !== "string" ||
     !/^[a-f0-9]{64}$/.test(licenseId)) {
    throw new Error("ID de licencia invalido");
  }

  const iv = new Uint8Array(nonce);
  const data = new Uint8Array(ciphertext);

  if(iv.length !== 12 || data.length < 17) {
    throw new Error("Registro cifrado invalido");
  }

  const plaintext = await crypto.subtle.decrypt(
    {
      name:"AES-GCM",
      iv,
      additionalData:enc.encode(licenseId),
      tagLength:128
    },
    masterKey,
    data
  );

  const key = dec.decode(plaintext);

  if(!/^ADNER-[A-F0-9]{48}$/.test(key)) {
    throw new Error("Key descifrada invalida");
  }

  return key;
}

export {bytesToBase64};