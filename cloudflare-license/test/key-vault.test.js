import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes, webcrypto, createHash} from "node:crypto";
import {
  importMasterKey,
  encryptLicenseKey,
  decryptLicenseKey
} from "../src/key-vault.js";

test("AES-256-GCM cifra y recupera una key", async () => {
  const secret = randomBytes(32).toString("base64");
  const masterKey = await importMasterKey(secret);

  const key = "ADNER-" + randomBytes(24).toString("hex").toUpperCase();
  const id = createHash("sha256").update(key).digest("hex");

  const encrypted = await encryptLicenseKey(masterKey,id,key);
  const recovered = await decryptLicenseKey(
    masterKey,id,encrypted.ciphertext,encrypted.nonce
  );

  assert.equal(recovered,key);
  assert.equal(encrypted.nonce.length,12);
  assert.notEqual(Buffer.from(encrypted.ciphertext).toString(),key);
});

test("No se puede descifrar con otra clave", async () => {
  const masterA = await importMasterKey(randomBytes(32).toString("base64"));
  const masterB = await importMasterKey(randomBytes(32).toString("base64"));

  const key = "ADNER-" + randomBytes(24).toString("hex").toUpperCase();
  const id = createHash("sha256").update(key).digest("hex");

  const encrypted = await encryptLicenseKey(masterA,id,key);

  await assert.rejects(
    decryptLicenseKey(
      masterB,id,encrypted.ciphertext,encrypted.nonce
    )
  );
});

test("No permite cambiar la licencia asociada", async () => {
  const master = await importMasterKey(randomBytes(32).toString("base64"));

  const key = "ADNER-" + randomBytes(24).toString("hex").toUpperCase();
  const id = createHash("sha256").update(key).digest("hex");
  const otherId = "a".repeat(64);

  const encrypted = await encryptLicenseKey(master,id,key);

  if(otherId !== id) {
    await assert.rejects(
      decryptLicenseKey(
        master,otherId,encrypted.ciphertext,encrypted.nonce
      )
    );
  }
});

test("Rechaza secretos de longitud incorrecta", async () => {
  await assert.rejects(
    importMasterKey(randomBytes(16).toString("base64"))
  );
});