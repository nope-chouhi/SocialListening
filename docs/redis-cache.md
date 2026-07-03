# Redis Caching Integration

The backend supports an optional Redis caching layer to optimize performance for high-traffic endpoints (such as dashboard summaries).

## Environment Variables

Redis caching is disabled by default and requires the following environment variables to be enabled:

- `REDIS_ENABLED`: Must be set to `true` (or `1`) to enable the cache service.
- `REDIS_URL`: The full connection string to the Redis server (e.g., `redis://localhost:6379/0`). **Do not expose this URL or any other Redis secrets to the frontend. Keep it strictly in the backend.**
- `CACHE_TTL_SECONDS`: The default time-to-live for cached items. Defaults to `60` seconds (matching production environment settings).

## Local Development Fallback

Redis is strictly **optional**. If `REDIS_ENABLED` is `false`, `REDIS_URL` is missing, or the backend fails to connect to the Redis server, the `CacheService` will log a warning and gracefully degrade. The backend APIs will continue functioning normally by querying the primary database directly, ensuring that local development is not blocked by missing Redis infrastructure.

## Caching Logic and Isolation

Currently, caching is integrated into the following safe, high-value endpoints:
- `get_dashboard_summary`

To prevent data leaks across tenants, cache keys are constructed using all contextual parameters that affect the endpoint's response. For instance, the dashboard summary key includes the user ID, project ID, and requested time range:
`dashboard:summary:user:{user_id}:project:{project_id}:range:{time_range}`

## Implementation Details

- **Redis Client**: We use `redis.asyncio` for a non-blocking asynchronous client.
- **Connection**: A reusable lazy singleton instance is maintained within the `CacheService`. Connections are pooled automatically to handle high concurrency.
- **Serialization**: JSON serialization is used to store and retrieve data models securely.
