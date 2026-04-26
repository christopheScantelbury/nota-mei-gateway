module github.com/christopheScantelbury/nota-mei-gateway/api

go 1.23

require (
	github.com/gofiber/fiber/v2 v2.52.5
	github.com/rs/zerolog v1.33.0
	github.com/jackc/pgx/v5 v5.7.1
	github.com/redis/go-redis/v9 v9.7.0
	github.com/rabbitmq/amqp091-go v1.10.0
	github.com/aws/aws-sdk-go-v2 v1.32.5
	github.com/aws/aws-sdk-go-v2/config v1.28.5
	github.com/aws/aws-sdk-go-v2/service/secretsmanager v1.34.6
	github.com/aws/aws-sdk-go-v2/service/kms v1.37.6
	github.com/stripe/stripe-go/v81 v81.1.0
	github.com/google/uuid v1.6.0
)
