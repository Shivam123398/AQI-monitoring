import crypto from 'crypto';

export function verifyHMAC(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export function generateAPIKey(deviceId: string, salt: string): string {
  return crypto
    .createHash('sha256')
    .update(deviceId + salt + Date.now().toString())
    .digest('hex')
    .substring(0, 32);
}