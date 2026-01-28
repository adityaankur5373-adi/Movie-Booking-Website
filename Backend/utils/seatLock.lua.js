export const lockSeatsLua = `
-- KEYS[1] = lockKey
-- ARGV[1] = ttlSeconds
-- ARGV[2] = userId
-- ARGV[3...] = seats

local lockKey = KEYS[1]
local ttl = tonumber(ARGV[1])
local userId = ARGV[2]

-- 1️⃣ check if any seat already locked by someone else
for i = 3, #ARGV do
  local seat = ARGV[i]
  local current = redis.call("HGET", lockKey, seat)
  if current and current ~= userId then
    return {0, seat}
  end
end

-- 2️⃣ lock all seats
for i = 3, #ARGV do
  redis.call("HSET", lockKey, ARGV[i], userId)
end

-- 3️⃣ set expiry ONLY if not already set
if redis.call("TTL", lockKey) == -1 then
  redis.call("EXPIRE", lockKey, ttl)
end

return {1}
`;