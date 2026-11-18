'use strict';

const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ quiet: true });

const emptyToUndefined = (value) => (value === '' ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());
const optionalNumber = (fallback) => z.preprocess(emptyToUndefined, z.coerce.number().positive().default(fallback));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: optionalNumber(5000),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.string().default('0'),

  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL.'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required.'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long.'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  BCRYPT_SALT_ROUNDS: optionalNumber(12),

  ADMIN_NAME: optionalString,
  ADMIN_EMAIL: optionalString,
  ADMIN_PASSWORD: optionalString,

  OTP_EXPIRY_MINUTES: optionalNumber(10),
  OTP_RESEND_COOLDOWN_SECONDS: optionalNumber(60),
  OTP_MAX_ATTEMPTS: optionalNumber(5),

  SMTP_HOST: optionalString,
  SMTP_PORT: optionalNumber(587),
  SMTP_SECURE: z.string().default('false'),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  SMTP_FROM_NAME: z.string().default('RetailTrack'),
  SMTP_FROM_EMAIL: optionalString,

  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${details}\nCopy backend/.env.example to backend/.env and fill in the values.`);
}

const env = parsed.data;

module.exports = Object.freeze({
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  frontendOrigins: env.FRONTEND_URL.split(',').map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean),
  trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY.toLowerCase() === 'true',

  supabaseUrl: env.SUPABASE_URL,
  supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,

  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN,
  bcryptRounds: env.BCRYPT_SALT_ROUNDS,

  admin: {
    name: env.ADMIN_NAME,
    email: env.ADMIN_EMAIL ? env.ADMIN_EMAIL.toLowerCase() : undefined,
    password: env.ADMIN_PASSWORD,
  },

  otp: {
    expiryMinutes: env.OTP_EXPIRY_MINUTES,
    cooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
    maxAttempts: env.OTP_MAX_ATTEMPTS,
  },

  smtp: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE.toLowerCase() === 'true',
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    fromName: env.SMTP_FROM_NAME,
    fromEmail: env.SMTP_FROM_EMAIL || env.SMTP_USER,
  },

  cloudinary: {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
    enabled: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
  },
});
