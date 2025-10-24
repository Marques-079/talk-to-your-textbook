.PHONY: help setup start stop restart logs clean migrate dev

help:
	@echo "Available commands:"
	@echo "  make setup    - Initial setup (builds and starts services, runs migrations)"
	@echo "  make start    - Start all services"
	@echo "  make stop     - Stop all services"
	@echo "  make restart  - Restart all services"
	@echo "  make logs     - View logs"
	@echo "  make migrate  - Run database migrations"
	@echo "  make clean    - Stop and remove all containers and volumes"
	@echo "  make dev      - Start services for local development"

setup:
	@bash scripts/setup.sh

start:
	docker compose up -d

stop:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

migrate:
	@bash scripts/migrate.sh

clean:
	docker compose down -v
	rm -rf data/

dev:
	@bash scripts/dev.sh

