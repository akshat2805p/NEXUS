package utils

import (
	"context"
	"log"
	"os"

	"github.com/redis/go-redis/v9"
)

var RedisClient *redis.Client
var Ctx = context.Background()

func InitRedis() {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		log.Println("⚠️ REDIS_URL not set. Falling back to in-memory pub/sub (local dev only).")
		return
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Printf("❌ Failed to parse REDIS_URL: %v", err)
		return
	}

	RedisClient = redis.NewClient(opt)
	if err := RedisClient.Ping(Ctx).Err(); err != nil {
		log.Printf("❌ Failed to connect to Redis: %v", err)
		RedisClient = nil
		return
	}

	log.Println("✅ Redis connected successfully")
}
