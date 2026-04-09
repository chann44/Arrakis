package internal

import (
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DBHost                    string
	DBPort                    string
	DBUser                    string
	DBPassword                string
	DBName                    string
	ClickHouseHost            string
	ClickHousePort            string
	ClickHouseUser            string
	ClickHousePassword        string
	ClickHouseDatabase        string
	RedisHost                 string
	RedisPort                 string
	FrontendURL               string
	GithubClientID            string
	GithubClientSecret        string
	GithubRedirectURI         string
	GithubAppID               string
	GithubAppPrivateKey       string
	GithubAppSlug             string
	GithubAppInstallURL       string
	DomainRouterSyncEnabled   bool
	TraefikConfigPath         string
	DomainRecordType          string
	DomainRecordValue         string
	DomainTXTNamePrefix       string
	GHSAAPIToken              string
	NVDAPIKey                 string
	SupplyChainEnabled        bool
	AIAnalyzerEnabled         bool
	AIAnalyzerMode            string
	AIAnalyzerURL             string
	AIAnalyzerToken           string
	AIAnalyzerDockerImage     string
	AIAnalyzerModel           string
	AIAnalyzerMaxDependencies int
	AISandboxNetwork          string
	AISandboxTimeoutSeconds   int
	OpenAIAPIKey              string
	OpenRouterAPIKey          string
	OpenRouterBaseURL         string
	OpenRouterSiteURL         string
	OpenRouterAppName         string
	DockerLogsEnabled         bool
	DockerLogsSocketPath      string
	DockerLogsIncludeAll      bool
	DockerLogsNetwork         string
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
			DBHost:                    os.Getenv("DB_HOST"),
			DBPort:                    os.Getenv("DB_PORT"),
			DBUser:                    os.Getenv("DB_USER"),
			DBPassword:                os.Getenv("DB_PASSWORD"),
			DBName:                    os.Getenv("DB_NAME"),
			ClickHouseHost:            os.Getenv("CLICKHOUSE_HOST"),
			ClickHousePort:            os.Getenv("CLICKHOUSE_PORT"),
			ClickHouseUser:            os.Getenv("CLICKHOUSE_USER"),
			ClickHousePassword:        os.Getenv("CLICKHOUSE_PASSWORD"),
			ClickHouseDatabase:        os.Getenv("CLICKHOUSE_DATABASE"),
			RedisHost:                 os.Getenv("REDIS_HOST"),
			RedisPort:                 os.Getenv("REDIS_PORT"),
			FrontendURL:               os.Getenv("FRONTEND_URL"),
			GithubClientID:            os.Getenv("GITHUB_CLIENT_ID"),
			GithubClientSecret:        os.Getenv("GITHUB_CLIENT_SECRET"),
			GithubRedirectURI:         os.Getenv("GITHUB_REDIRECT_URI"),
			GithubAppID:               os.Getenv("GITHUB_APP_ID"),
			GithubAppPrivateKey:       os.Getenv("GITHUB_APP_PRIVATE_KEY"),
			GithubAppSlug:             os.Getenv("GITHUB_APP_SLUG"),
			GithubAppInstallURL:       os.Getenv("GITHUB_APP_INSTALL_URL"),
			DomainRouterSyncEnabled:   parseEnvBoolDefaultFalse("DOMAIN_ROUTER_SYNC_ENABLED"),
			TraefikConfigPath:         os.Getenv("TRAEFIK_DYNAMIC_CONFIG_PATH"),
			DomainRecordType:          os.Getenv("DOMAIN_RECORD_TYPE"),
			DomainRecordValue:         os.Getenv("DOMAIN_RECORD_VALUE"),
			DomainTXTNamePrefix:       os.Getenv("DOMAIN_TXT_NAME_PREFIX"),
			GHSAAPIToken:              os.Getenv("GHSA_API_TOKEN"),
			NVDAPIKey:                 os.Getenv("NVD_API_KEY"),
			SupplyChainEnabled:        parseEnvBoolDefaultFalse("SUPPLY_CHAIN_ENABLED"),
			AIAnalyzerEnabled:         parseEnvBoolDefaultFalse("AI_ANALYZER_ENABLED"),
			AIAnalyzerMode:            os.Getenv("AI_ANALYZER_MODE"),
			AIAnalyzerURL:             os.Getenv("AI_ANALYZER_URL"),
			AIAnalyzerToken:           os.Getenv("AI_ANALYZER_TOKEN"),
			AIAnalyzerDockerImage:     os.Getenv("AI_ANALYZER_DOCKER_IMAGE"),
			AIAnalyzerModel:           os.Getenv("AI_ANALYZER_MODEL"),
			AIAnalyzerMaxDependencies: parseEnvIntDefault("AI_ANALYZER_MAX_DEPENDENCIES", 120),
			AISandboxNetwork:          os.Getenv("AI_SANDBOX_NETWORK"),
			AISandboxTimeoutSeconds:   parseEnvIntDefault("AI_SANDBOX_TIMEOUT_SECONDS", 180),
			OpenAIAPIKey:              os.Getenv("OPENAI_API_KEY"),
			OpenRouterAPIKey:          os.Getenv("OPENROUTER_API_KEY"),
			OpenRouterBaseURL:         os.Getenv("OPENROUTER_BASE_URL"),
			OpenRouterSiteURL:         os.Getenv("OPENROUTER_SITE_URL"),
			OpenRouterAppName:         os.Getenv("OPENROUTER_APP_NAME"),
			DockerLogsEnabled:         parseEnvBoolDefaultFalse("DOCKER_LOGS_ENABLED"),
			DockerLogsSocketPath:      os.Getenv("DOCKER_LOGS_SOCKET_PATH"),
			DockerLogsIncludeAll:      parseEnvBoolDefaultFalse("DOCKER_LOGS_INCLUDE_ALL"),
			DockerLogsNetwork:         os.Getenv("DOCKER_LOGS_NETWORK"),
		}

		if cfg.FrontendURL == "" {
			cfg.FrontendURL = "http://localhost:5173"
		}
		if cfg.ClickHouseHost == "" {
			cfg.ClickHouseHost = "localhost"
		}
		if cfg.ClickHousePort == "" {
			cfg.ClickHousePort = "9000"
		}
		if cfg.ClickHouseUser == "" {
			cfg.ClickHouseUser = "default"
		}
		if cfg.ClickHousePassword == "" {
			cfg.ClickHousePassword = "clickhouse"
		}
		if cfg.ClickHouseDatabase == "" {
			cfg.ClickHouseDatabase = "default"
		}
		if cfg.DomainRecordType == "" {
			cfg.DomainRecordType = "A"
		}
		if cfg.DomainTXTNamePrefix == "" {
			cfg.DomainTXTNamePrefix = "_tge-challenge"
		}
		if cfg.DockerLogsSocketPath == "" {
			cfg.DockerLogsSocketPath = "/var/run/docker.sock"
		}
		if strings.TrimSpace(cfg.AIAnalyzerMode) == "" {
			cfg.AIAnalyzerMode = "docker"
		}
		if strings.TrimSpace(cfg.AISandboxNetwork) == "" {
			cfg.AISandboxNetwork = "bridge"
		}
	}
	return cfg
}

func parseEnvBoolDefaultFalse(key string) bool {
	v := os.Getenv(key)
	parsed, err := strconv.ParseBool(v)
	if err != nil {
		return false
	}
	return parsed
}

func parseEnvIntDefault(key string, fallback int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return parsed
}
