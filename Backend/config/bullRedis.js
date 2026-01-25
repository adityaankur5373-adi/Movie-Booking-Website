import IORedis from "ioredis";

const bullRedis = process.env.REDIS_URL
  ? new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    })
  : new IORedis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6380,
      maxRetriesPerRequest: null,
    });

export default bullRedis;