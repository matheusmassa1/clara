.PHONY: dev down clean

dev: ## Start MongoDB and run app with hot reload
	@docker-compose up -d mongodb
	@echo "Waiting for MongoDB to be ready..."
	@until docker exec clara-mongodb mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; do sleep 1; done
	@echo "MongoDB ready. Starting app with hot reload..."
	@$(shell go env GOPATH)/bin/air

down: ## Stop MongoDB
	@docker-compose down

clean: ## Stop MongoDB and remove data
	@docker-compose down -v
