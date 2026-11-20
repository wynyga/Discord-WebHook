import { Redis } from 'ioredis';

export interface RedisConnection {
  client: Redis;
  ping: () => Promise<void>;
  close: () => Promise<void>;
}

export function createRedisConnection(url: string): RedisConnection {
  // BullMQ workers block on Redis and require unlimited retries per request.
  const client = new Redis(url, { maxRetriesPerRequest: null });

  return {
    client,
    ping: async () => {
      await client.ping();
    },
    close: async () => {
      await client.quit();
    },
  };
}
