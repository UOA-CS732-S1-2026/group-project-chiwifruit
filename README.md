# Group Project Chiwifruit

[![CI/CD](https://github.com/UOA-CS732-S1-2026/group-project-chiwifruit/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/UOA-CS732-S1-2026/group-project-chiwifruit/actions/workflows/ci.yml)
![Backend tests](https://img.shields.io/badge/backend_tests-Jest%20%2B%20Supertest-blue)
![API coverage](https://img.shields.io/badge/API%20coverage-auth%20%7C%20rooms%20%7C%20game%20state-green)

Full-stack workspace for the Sound Chain game project.

This repository contains:
- A React + Vite frontend in [client](client)
- An Express + MongoDB backend in [server](server)
- A birdcall metadata CSV used as reference data at the repository root

## Architecture Overview

The project follows a **modular monorepo** architecture with clear separation between presentation, API, domain logic, and infrastructure concerns:

- **Frontend (`client/`)**: React + Vite SPA focused on UI state, routing, and websocket/API integration.
- **Backend (`server/`)**: Express REST API + Socket-based real-time game coordination.
- **Database**: MongoDB Atlas for cloud persistence of users, rooms, and game-related entities (local MongoDB is used for local development).
- **Deployment target**: Backend service is deployed on AWS EC2.
- **CI/CD**: GitHub Actions validates code quality and build health before merge/deploy.
- **Shared contract by convention**: frontend calls backend endpoints under `/api` and listens to socket events exposed by the server.

### High-level Runtime View

```text
Browser (React/Vite)
   |
   | HTTP (REST) + WebSocket
   v
Express API + Realtime Gateway (Socket helpers)
   |
   | service/repository calls
   v
MongoDB
```

### Delivery & Deployment Architecture

```text
GitHub PR/Push
   |
   | GitHub Actions (lint/build/test/smoke/docker-build)
   v
Protected branch (dev/main)
   |
   | deployment pipeline/release step
   v
AWS EC2 (Express backend runtime)
   |
   | MONGODB_URI (Atlas connection string)
   v
MongoDB Atlas
```

- **CI/CD guardrails**: PRs to `dev`/`main` run validation jobs to reduce regression risk before integration.
- **Runtime hosting**: EC2 is used as the backend compute host for the Express + realtime server.
- **Managed data layer**: MongoDB Atlas provides managed cloud database capabilities for production data.
- **Environment split**: local development can use local MongoDB; deployed environment points to Atlas via environment variables.

### Backend Layering (Architectural Intent)

To keep the codebase clean and maintainable, backend code is organized with layered responsibilities:

- **Routes/Controllers**: request parsing, validation handoff, response shaping.
- **Services (domain logic)**: core game rules (turn progression, elimination, timeout, forfeit), token logic, and business workflows.
- **Data access/models**: MongoDB schema/model interactions.
- **Infrastructure utilities**: auth/token helpers, socket helpers, environment and integration glue.

This separation supports easier unit testing and reduces coupling between transport (HTTP/socket) and domain rules.

### Frontend Responsibilities

The frontend is intentionally kept as a client of backend contracts:

- Handles user interaction, room/game UI state, and realtime event rendering.
- Delegates authority for game-rule decisions to backend services (server is source of truth).
- Uses environment-based configuration for API/socket endpoints for local vs container workflows.

### Architectural Decisions and Best-practice Rationale

1. **Monorepo with npm workspaces**
   - One repository for coordinated frontend/backend evolution.
   - Root scripts reduce onboarding friction and make CI command execution consistent.

2. **Backend as authoritative game engine**
   - Prevents divergent client-side rule implementations.
   - Improves fairness and consistency for multiplayer scenarios.

3. **REST + realtime split**
   - REST endpoints for CRUD/auth/room lifecycle operations.
   - Socket flows for latency-sensitive multiplayer state updates.

4. **Test strategy aligned to architecture**
   - API contract tests validate route behavior.
   - Service tests validate deterministic game logic.
   - Focused helper tests cover realtime utilities without over-coupled integration suites.

5. **CI gate on quality signals**
   - Lint/build/test/smoke + image build verification protect `dev` and `main` from regressions.

## Project Structure

```text
group-project-chiwifruit/
├── client/                  # React frontend
├── server/                  # Node/Express backend
├── Dockerfile
├── package.json
└── README.md
```

## Prerequisites

- Node.js 18+ and npm
- MongoDB running locally (default: `mongodb://localhost:27017`)

## Root Workspace Scripts

The root [package.json](package.json) is configured as an npm workspace and can start both apps from one command.

- `npm run dev` starts frontend and backend together
- `npm run dev:client` starts only frontend
- `npm run dev:server` starts only backend
- `npm run build` builds frontend
- `npm run start` starts backend in non-dev mode

## Testing and Coverage

Backend tests are written with Jest and Supertest. They cover:
- Auth API contract tests
- Room API contract tests, including happy paths and key error paths
- Core game-state unit tests for turn progression, elimination, timeout, and forfeit edge cases
- Token service unit tests
- Focused socket helper tests

Run all backend tests:

```bash
npm test --workspace=server
```

Run backend tests with coverage:

```bash
npm run test:coverage --workspace=server
```

The coverage report is generated locally under:

```text
server/coverage/lcov-report/index.html
```

The CI pipeline runs the backend Jest suite as part of the server validation gate.

## GitHub Actions CI (PR Gate for `dev` and `main`)

This repository includes a workflow at [.github/workflows/ci.yml](.github/workflows/ci.yml) that runs on:
- Pull requests targeting `dev` or `main`
- Direct pushes to `dev` or `main`

The CI pipeline runs in a GitHub-hosted Ubuntu runner and executes:
- Frontend integrity checks: `npm run lint` + `npm run build`
- Backend syntax check: `node --check src/server.js`
- Backend Jest test suite: API, service, and focused socket helper tests
- Backend smoke test: starts the Express app in-process and verifies `GET /health` returns `{ status: "ok" }`
- Docker image build validation

### Why no full Docker-based test pipeline right now?

The CI currently runs code validation directly on GitHub Actions runners, then separately validates that the Docker image can be built. This keeps PR feedback fast while still catching container packaging issues.

You can extend this later with a containerized test job if production parity becomes more important.

### Required GitHub repo settings (one-time)

To make CI truly block merges to `dev` and `main`, enable branch protection rules:

1. Go to **GitHub → Settings → Branches**.
2. Add (or edit) a branch protection rule for `main`.
3. Enable:
   - **Require a pull request before merging**
   - **Require status checks to pass before merging**
4. In status checks, select the jobs **`validate`** and **`docker-build`** from this workflow.
5. Repeat the same rule for `dev`.

Optional hardening:
- Enable **Require branches to be up to date before merging**
- Include administrators if you want the rule to apply to admins too
- Disable direct pushes to protected branches

## Quick Start

1. Install all dependencies from repository root:

```bash
npm install
```

2. Configure backend environment:
- Copy [server/.env.example](server/.env.example) to `server/.env`
- Fill required values (MongoDB, JWT, AWS)

3. Configure frontend environment:
- Copy [client/.env.example](client/.env.example) to `client/.env`

4. Ensure MongoDB is running locally.

5. Start both services from root:

```bash
npm run dev
```

6. Verify services:
- Frontend: `http://localhost:5173`
- Backend health endpoint: `http://localhost:3000/health`

## Local Docker Development Environment

This project can be run locally using Docker with two containers:

- `kichain-db`: MongoDB container
- `kichain-dev-local`: application container running both the Vite client and Express server

The app container connects to MongoDB through a shared Docker network.

### 1. Create a Docker network

```bash
docker network create kichain-net
```

If the network already exists, Docker may show an error. This is fine and can be ignored.

### 2. Start MongoDB

```bash
docker run -d \
  --name kichain-db \
  --network kichain-net \
  -p 27017:27017 \
  mongo:latest
```

This starts a MongoDB container named kichain-db.

### 3. Configure environment variables

Create or update server/.env:

```bash
PORT=3000
FRONTEND_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://kichain-db:27017/kichain-db
JWT_SECRET=local_dev_secret_change_later
JWT_EXPIRES_IN=1d
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=dummy
AWS_SECRET_ACCESS_KEY=dummy
AWS_S3_BUCKET=dummy
```

Create or update client/.env:

```bash
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
VITE_APP_NAME=KiChain
VITE_APP_ENV=development
```

Note: When the backend runs inside a Docker container, localhost does not refer to the MongoDB container. The backend should connect to MongoDB using the container name kichain-db on the shared Docker network.

### 4. Build the app image

From the project root:

```bash
docker build -t kichain-dev:local .
```

The Docker build context excludes local dependencies, test files, coverage output, Git metadata, and environment files through [.dockerignore](.dockerignore).

### 5. Start the app container

```bash
docker run --rm \
  --name kichain-dev-local \
  --network kichain-net \
  --env-file docker.local.env \
  -p 5173:5173 \
  -p 3000:3000 \
  kichain-dev:local
```

The app will be available at:

`http://localhost:5173`

### 6. Check running containers

In another terminal:

```bash
docker ps
```

You should see both containers running:

```bash
kichain-db
kichain-dev-local
```

### 7. Stop the containers

To stop the app container:

```bash
docker stop kichain-dev-local
```

To stop MongoDB:

```bash
docker stop kichain-db
```

To remove the MongoDB container if needed:

```bash
docker rm kichain-db
```

### 8. Reset local MongoDB container

If you need a clean MongoDB container:

```bash
docker stop kichain-db
docker rm kichain-db
```

Then start MongoDB again:

```bash
docker run -d \
  --name kichain-db \
  --network kichain-net \
  -p 27017:27017 \
  mongo:latest
```
