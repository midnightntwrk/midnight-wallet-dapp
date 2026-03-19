// @ts-expect-error crypto-browserify has no type declarations
import cryptoBrowserify from 'crypto-browserify';

function timingSafeEqual(a: Buffer | Uint8Array, b: Buffer | Uint8Array): boolean {
  if (a.length !== b.length) {
    throw new RangeError('Input buffers must have the same byte length');
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

const {
  Cipher,
  Cipheriv,
  Decipher,
  Decipheriv,
  DiffieHellman,
  DiffieHellmanGroup,
  Hash,
  Hmac,
  Sign,
  Verify,
  constants,
  createCipher,
  createCipheriv,
  createCredentials,
  createDecipher,
  createDecipheriv,
  createDiffieHellman,
  createDiffieHellmanGroup,
  createECDH,
  createHash,
  createHmac,
  createSign,
  createVerify,
  getCiphers,
  getDiffieHellman,
  getHashes,
  listCiphers,
  pbkdf2,
  pbkdf2Sync,
  privateDecrypt,
  privateEncrypt,
  prng,
  pseudoRandomBytes,
  publicDecrypt,
  publicEncrypt,
  randomBytes,
  randomFill,
  randomFillSync,
  rng,
} = cryptoBrowserify;

export {
  Cipher,
  Cipheriv,
  Decipher,
  Decipheriv,
  DiffieHellman,
  DiffieHellmanGroup,
  Hash,
  Hmac,
  Sign,
  Verify,
  constants,
  createCipher,
  createCipheriv,
  createCredentials,
  createDecipher,
  createDecipheriv,
  createDiffieHellman,
  createDiffieHellmanGroup,
  createECDH,
  createHash,
  createHmac,
  createSign,
  createVerify,
  getCiphers,
  getDiffieHellman,
  getHashes,
  listCiphers,
  pbkdf2,
  pbkdf2Sync,
  privateDecrypt,
  privateEncrypt,
  prng,
  pseudoRandomBytes,
  publicDecrypt,
  publicEncrypt,
  randomBytes,
  randomFill,
  randomFillSync,
  rng,
  timingSafeEqual,
};

export default { ...cryptoBrowserify, timingSafeEqual };
