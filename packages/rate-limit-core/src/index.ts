export { createRedisClientFactory } from "./redis-client.js";
export type {
  RedisCredentialsProvider,
  RedisClientFactoryOptions,
} from "./redis-client.js";

export { createRateLimiterFactory } from "./rate-limiter.js";
export type {
  RateLimitConfig,
  RateLimiterFactoryOptions,
  RateLimiterDegradation,
} from "./rate-limiter.js";

export { getRateLimitErrorMessage } from "./error-message.js";
export type { RateLimitErrorMessageOptions } from "./error-message.js";
