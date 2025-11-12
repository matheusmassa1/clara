.PHONY: help up up-dev down logs logs-app logs-mongo restart restart-dev clean rebuild rebuild-dev shell shell-mongo test

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

up: ## Start production containers
	docker-compose up -d app

up-dev: ## Start development containers with hot reload
	docker-compose --profile dev up -d app-dev

down: ## Stop containers (keeps volumes)
	docker-compose down

logs: ## Tail all logs
	docker-compose logs -f

logs-app: ## Tail app logs
	docker-compose logs -f app

logs-mongo: ## Tail MongoDB logs
	docker-compose logs -f mongodb

restart: ## Restart production app
	docker-compose restart app

restart-dev: ## Restart dev app
	docker-compose restart app-dev

clean: ## Stop containers and remove volumes
	docker-compose down -v

rebuild: ## Rebuild production image
	docker-compose build app
	docker-compose up -d app

rebuild-dev: ## Rebuild dev image
	docker-compose build app-dev
	docker-compose --profile dev up -d app-dev

shell: ## Open shell in app container
	docker exec -it clara-app sh

shell-dev: ## Open shell in dev app container
	docker exec -it clara-app-dev sh

shell-mongo: ## Open MongoDB shell
	docker exec -it clara-mongodb mongosh

test: ## Run tests in container
	docker-compose exec app go test ./...

test-dev: ## Run tests in dev container
	docker-compose exec app-dev go test ./...
