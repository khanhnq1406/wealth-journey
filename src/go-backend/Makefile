.PHONY: deps build run clean test dev deploy help generate-proto clean-proto migrate-currency-vnd

# Directory paths for protobuf
PROTO_DIR := ../../api/protobuf
GEN_DIR := ./gen

# Install dependencies
deps:
	@echo "Installing dependencies..."
	@go mod download
	@go mod tidy
	@echo "Dependencies installed"

# Build the application for local testing (standalone server)
build:
	@echo "Building application..."
	@mkdir -p bin
	@go build -o bin/server ./cmd/server/main.go
	@echo "Build complete: bin/server"

# Run the standalone server locally
run:
	@echo "Running standalone server..."
	@go run ./cmd/server/main.go

# Run tests
test:
	@echo "Running tests..."
	@go test -v ./...

# Clean build artifacts
clean:
	@echo "Cleaning..."
	@rm -rf bin/
	@echo "Clean complete"

# Run with hot reload
dev:
	@go run ./cmd/server/main.go

# Deploy to production (Railway - use Railway dashboard or CLI)
deploy:
	@echo "Deploy via Railway dashboard or: railway up --detach"

# Deploy to preview environment (Railway)
deploy-preview:
	@echo "Deploy preview via Railway CLI: railway up"

# Generate Go code from protobuf files
generate-proto:
	@echo "Generating Go code from protobuf files..."
	@cd ../../api && buf generate --template buf.gen.go.yaml
	@echo "Go code generation complete!"

# Clean generated Go code
clean-proto:
	@echo "Removing generated Go code..."
	@rm -rf $(GEN_DIR)
	@echo "Clean complete!"

# Show help
help:
	@echo "Available commands:"
	@echo "  make deps                  - Install Go dependencies"
	@echo "  make build                 - Build standalone server"
	@echo "  make run                   - Run standalone server locally"
	@echo "  make dev                   - Run with hot reload"
	@echo "  make test                  - Run tests"
	@echo "  make clean                 - Clean build artifacts"
	@echo "  make deploy                - Deploy to production on Railway"
	@echo "  make deploy-preview        - Deploy to preview on Railway"
	@echo "  make generate-proto        - Generate Go code from protobuf files"
	@echo "  make clean-proto           - Remove generated Go code"
	@echo "  make migrate-currency-vnd  - Migrate all wallet currencies to VND"

# Migrate all wallet currencies to VND
migrate-currency-vnd:
	@echo "Running currency migration to VND..."
	@go run ./cmd/migrate-currency-vnd/main.go
