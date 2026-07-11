import rateLimit from "express-rate-limit";

// validate: { trustProxy: false } suppresses ERR_ERL_UNEXPECTED_X_FORWARDED_FOR —
// Express already handles trust proxy correctly via app.set("trust proxy", 1).
// Without this, express-rate-limit v7 throws an unhandled rejection on every
// proxied request, crashing the Node process under PM2.
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many auth attempts. Please try again later." },
  validate: { trustProxy: false },
});

export const contactRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Too many messages sent. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});
