// Example environment configuration
export const config = {
  // OAuth2 Configuration
  oauth: {
    mercadoPago: {
      clientId: process.env.MERCADO_PAGO_CLIENT_ID,
      clientSecret: process.env.MERCADO_PAGO_CLIENT_SECRET,
      redirectUri:
        process.env.MERCADO_PAGO_REDIRECT_URI ||
        'http://localhost:3000/oauth/callback',
      authUrl: 'https://auth.mercadopago.com/authorization',
      tokenUrl: 'https://api.mercadopago.com/oauth/token',
    },
  },

  // API Base URLs
  api: {
    mercadoPago: {
      base: 'https://api.mercadopago.com',
      sandbox: 'https://api.mercadolibre.com',
    },
  },

  // Token Configuration
  tokens: {
    refreshThresholdMinutes: 60, // Refresh tokens 1 hour before expiry
    defaultExpirationHours: 6, // Default token expiration
  },
};

// Required environment variables for OAuth2
export const requiredOAuthEnvVars = [
  'MERCADO_PAGO_CLIENT_ID',
  'MERCADO_PAGO_CLIENT_SECRET',
];

// Validate OAuth configuration
export function validateOAuthConfig(): boolean {
  return requiredOAuthEnvVars.every((envVar) => !!process.env[envVar]);
}
