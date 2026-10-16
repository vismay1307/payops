import { createTokenProvider } from './auth.js';
import { SANDBOX_BASE_URL } from './config.js';
import { createPayPalHttp } from './http.js';
import type { Logger } from 'pino';
export interface PayPalClientConfig {
  clientId: string;
  clientSecret: string;
  logger?: Logger;
}

export function createPayPalClient(config: PayPalClientConfig) {
  const tokens = createTokenProvider({
    PAYPAL_CLIENT_ID: config.clientId,
    PAYPAL_CLIENT_SECRET: config.clientSecret,
  });

  return createPayPalHttp({
    baseUrl: SANDBOX_BASE_URL,
    tokens,
    ...(config.logger ? { logger: config.logger } : {}),
  });
}
