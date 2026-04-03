package internal

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DBHost             string
	DBPort             string
	DBUser             string
	DBPassword         string
	DBName             string
	RedisHost          string
	RedisPort          string
	FrontendURL        string
	GithubClientID     string
	GithubClientSecret string
	GithubRedirectURI  string
}

var cfg *Config

func init() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found")
	}
}

func GetConfig() *Config {
	if cfg == nil {
		cfg = &Config{
			DBHost:             os.Getenv("DB_HOST"),
			DBPort:             os.Getenv("DB_PORT"),
			DBUser:             os.Getenv("DB_USER"),
			DBPassword:         os.Getenv("DB_PASSWORD"),
			DBName:             os.Getenv("DB_NAME"),
			RedisHost:          os.Getenv("REDIS_HOST"),
			RedisPort:          os.Getenv("REDIS_PORT"),
			FrontendURL:        os.Getenv("FRONTEND_URL"),
			GithubClientID:     os.Getenv("GITHUB_CLIENT_ID"),
			GithubClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"),
			GithubRedirectURI:  os.Getenv("GITHUB_REDIRECT_URI"),
		}

		if cfg.FrontendURL == "" {
			cfg.FrontendURL = "http://localhost:5173"
		}
	}
	return cfg
}
