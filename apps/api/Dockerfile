# ── Builder ──────────────────────────────────────────
FROM golang:1.23-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o server ./cmd/server
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o worker ./cmd/worker

# ── Runtime ──────────────────────────────────────────
FROM alpine:3.20
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata
ENV TZ=America/Sao_Paulo

COPY --from=builder /app/server .
COPY --from=builder /app/worker .

EXPOSE 8080
CMD ["./server"]
