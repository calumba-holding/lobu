import { createLogger } from "../logger";
import { decrypt, encrypt } from "./encryption";

const logger = createLogger("worker-auth");

/**
 * Worker authentication using encrypted thread ID
 * Token format: encrypted(userId:threadId:deploymentName:timestamp)
 */

export interface WorkerTokenData {
  userId: string;
  threadId: string;
  deploymentName: string;
  timestamp: number;
}

/**
 * Generate a worker authentication token by encrypting thread metadata
 */
export function generateWorkerToken(
  userId: string,
  threadId: string,
  deploymentName: string
): string {
  const timestamp = Date.now();
  const payload = JSON.stringify({
    userId,
    threadId,
    deploymentName,
    timestamp,
  });

  // Encrypt the payload
  const encrypted = encrypt(payload);
  return encrypted;
}

/**
 * Verify and decrypt a worker authentication token
 */
export function verifyWorkerToken(token: string): WorkerTokenData | null {
  try {
    // Decrypt the token
    const decrypted = decrypt(token);
    const data = JSON.parse(decrypted) as WorkerTokenData;

    // No expiration check - workers are ephemeral and short-lived
    return data;
  } catch (error) {
    logger.error("Error verifying token:", error);
    return null;
  }
}
