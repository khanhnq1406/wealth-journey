# Build stage
# Note: Requires ENABLE_ALPINE_PRIVATE_NETWORKING=true on Railway (see docs/deployment/railway-env-vars.md)
FROM golang:1.25-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates make bash

# Set working directory
WORKDIR /app

# Copy go mod files
COPY src/go-backend/go.mod src/go-backend/go.sum ./
RUN go mod download

# Copy source code
COPY src/go-backend/ ./

# Build the application with size optimization
# -ldflags="-s -w" strips debug info to reduce binary size
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o bin/server ./cmd/server/main.go

# Final stage: use distroless for minimal size
FROM gcr.io/distroless/static-debian12:nonroot

# Copy CA certificates for HTTPS requests
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

# Copy the binary from builder
COPY --from=builder /app/bin/server /server

# Use non-root user (distroless includes nonroot user)
USER nonroot:nonroot

# Expose port (Railway detects this automatically)
EXPOSE 8080

# Run the binary
ENTRYPOINT ["/server"]
