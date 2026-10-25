# Repo-level shortcuts. The real gates live in frontend/package.json and backend/Makefile.

.PHONY: up down logs check

up:        ## build and start the whole app on http://localhost:8080 (backend also on :8000)
	docker compose up --build -d

down:      ## stop and remove the containers
	docker compose down

logs:      ## follow both containers
	docker compose logs -f

check:     ## run both gates
	cd frontend && npm run check
	cd backend && $(MAKE) check
