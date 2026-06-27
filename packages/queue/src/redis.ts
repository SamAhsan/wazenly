import IORedis from "ioredis";

export const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// BullMQ bundles its own ioredis; casting to any avoids the duplicate-types conflict.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const redisConnection: any = redis;

redis.on("error", (err) => {
  console.error("[Redis] Connection error:", err.message);
});

redis.on("connect", () => {
  console.log("[Redis] Connected");
});
