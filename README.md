# KiChain - Group Project Chiwifruit

[![CI/CD](https://github.com/UOA-CS732-S1-2026/group-project-chiwifruit/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/UOA-CS732-S1-2026/group-project-chiwifruit/actions/workflows/ci.yml)
![Backend tests](https://img.shields.io/badge/backend_tests-Jest%20%2B%20Supertest-blue)
![API coverage](https://img.shields.io/badge/API%20coverage-auth%20%7C%20rooms%20%7C%20game%20state-green)

KiChain is a full-stack multiplayer memory game built for COMPSCI 732. Players join a shared room, listen to sound options, and take turns reproducing an increasingly long sound sequence. The project is implemented as a React + Vite client, an Express + MongoDB backend, and Socket.IO realtime communication.

## 1. Project Structure

```text
group-project-chiwifruit/
├── client/                  # React + Vite frontend
├── server/                  # Node / Express backend
├── .env.example             # Single shared environment template
├── Dockerfile               # Local / deployment container image definition
└── README.md
```

## 2. Prerequisites

1. Node.js 18+ and npm.
2. Docker, if using the Docker-based local setup.
3. MongoDB, either running directly on your machine or as a Docker container.

## 3. Environment Configuration

This project uses one shared environment file at the repository root.

### 3.1 Create the root `.env` file

```bash
cp .env.example .env
```

Do not create separate `client/.env` or `server/.env` files. The frontend Vite config and backend dotenv config are both configured to read from the root `.env` file.

### 3.2 Default local environment values

The default local configuration is designed for running the client and server directly from the command line:

```bash
PORT=3000
FRONTEND_PORT=5173
FRONTEND_ORIGIN=http://localhost:5173
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/kichain-db
JWT_SECRET=replace_with_long_random_secret
JWT_EXPIRES_IN=1d
```

### 3.3 MongoDB URI: host machine vs Docker container

The main value that changes between local run modes is `MONGODB_URI`.

#### 3.3.1 Backend running on the host machine

Use this when the backend is started through npm, for example `npm run dev`, `npm run dev:server`, or `npm run start`:

```bash
MONGODB_URI=mongodb://localhost:27017/kichain-db
```

Here, `localhost` means your Mac / host machine. This works when MongoDB is installed locally, or when MongoDB is running in Docker with port `27017` exposed to the host machine.

#### 3.3.2 Backend running inside a Docker container

Use this when the backend itself runs inside the app container and MongoDB runs in another Docker container:

```bash
MONGODB_URI=mongodb://kichain-db:27017/kichain-db
```

Here, `localhost` would mean the app container itself, not the MongoDB container. The hostname `kichain-db` works only when the app container and MongoDB container are attached to the same user-defined Docker network, `kichain-net`.

#### 3.3.3 Why the Docker command overrides `MONGODB_URI`

The README keeps `.env` suitable for normal CLI development by default:

```bash
MONGODB_URI=mongodb://localhost:27017/kichain-db
```

When running the app inside Docker, the recommended `docker run` command overrides only this one value:

```bash
-e MONGODB_URI=mongodb://kichain-db:27017/kichain-db
```

This means you do not need to edit `.env` every time you switch between CLI development and Docker development.

If you already changed `.env` to use the Docker value:

```bash
MONGODB_URI=mongodb://kichain-db:27017/kichain-db
```

then you can omit the `-e MONGODB_URI=...` line from `docker run`.

## 4. Workspace Scripts

Run these commands from the repository root.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start frontend and backend together for local development |
| `npm run dev:client` | Start only the Vite frontend |
| `npm run dev:server` | Start only the Express backend with nodemon |
| `npm run build` | Build the frontend |
| `npm run start` | Start the backend in non-dev mode |
| `npm run ci` | Run client and server validation checks |

## 5. Local Setup Option 1: CLI Development

Use this option when you want to run the frontend and backend directly from your terminal with npm.

### 5.1 Summary

In this setup:

1. The frontend runs on your host machine through Vite.
2. The backend runs on your host machine through Node / Express.
3. MongoDB can run either directly on your host machine or in a Docker container with port `27017` exposed.
4. The backend should use `mongodb://localhost:27017/kichain-db`.
5. A Docker network is not required, because the backend is not running inside Docker.

### 5.2 Steps

#### Step 1: Install dependencies

```bash
npm install
```

#### Step 2: Create root `.env`

```bash
cp .env.example .env
```

Keep the default MongoDB URI:

```bash
MONGODB_URI=mongodb://localhost:27017/kichain-db
```

#### Step 3: Start MongoDB

You can use a local MongoDB installation, or start MongoDB quickly through Docker:

```bash
docker rm -f kichain-db 2>/dev/null || true

docker run -d \
  --name kichain-db \
  -p 27017:27017 \
  mongo:latest
```

This MongoDB container does not need to be attached to `kichain-net` for CLI development. The important part is `-p 27017:27017`, which exposes MongoDB to your host machine so the backend can connect through `localhost`.

#### Step 4: Start the app

Start both frontend and backend together:

```bash
npm run dev
```

This starts:

1. Frontend: `http://localhost:5173`
2. Backend: `http://localhost:3000`

Alternatively, start them separately:

```bash
npm run dev:client
npm run dev:server
```

To start the backend without nodemon:

```bash
npm run start
```

#### Step 5: Verify the CLI setup

Check the backend health endpoint:

```bash
curl http://localhost:3000/health
```

Open the frontend:

```text
http://localhost:5173
```

A useful manual smoke test is:

1. Open two browser tabs.
2. Log in as guests in both tabs.
3. Create a room in one tab.
4. Join the room from the other tab.
5. Confirm that room updates appear in real time.

## 6. Local Setup Option 2: Docker Development

Use this option when you want to build and run the app inside Docker. This is closer to the shared deployment setup than the CLI option.

### 6.1 Summary

In this setup:

1. MongoDB runs in a Docker container named `kichain-db`.
2. The app runs in a Docker container named `kichain-dev-local`.
3. Both containers must be attached to the same Docker network, `kichain-net`.
4. The app container should use `mongodb://kichain-db:27017/kichain-db`.
5. The Docker network must be created before starting the MongoDB and app containers.

### 6.2 Steps

#### Step 1: Create the Docker network

```bash
docker network create kichain-net 2>/dev/null || true
```

This must happen before creating the MongoDB container with `--network kichain-net`.

The user-defined Docker network is required because the app container uses `kichain-db` as the MongoDB hostname. Docker provides container-name DNS resolution on this network.

#### Step 2: Start MongoDB on the Docker network

```bash
docker rm -f kichain-db 2>/dev/null || true

docker run -d \
  --name kichain-db \
  --network kichain-net \
  -p 27017:27017 \
  mongo:latest
```

This creates the MongoDB container on `kichain-net`. The app container can then connect to it using:

```bash
mongodb://kichain-db:27017/kichain-db
```

The `-p 27017:27017` mapping is not required for container-to-container access, but it is useful if you also want to inspect the database from your host machine, for example with MongoDB Compass.

#### Step 3: Build the app image

From the repository root:

```bash
docker build -t kichain-dev:local .
```

The Docker build context excludes local dependencies, test files, coverage output, Git metadata, and local environment files through [.dockerignore](.dockerignore).

#### Step 4: Start the app container

Recommended command:

```bash
docker rm -f kichain-dev-local 2>/dev/null || true

docker run --rm \
  --name kichain-dev-local \
  --network kichain-net \
  --env-file .env \
  -e MONGODB_URI=mongodb://kichain-db:27017/kichain-db \
  -p 5173:5173 \
  -p 3000:3000 \
  kichain-dev:local
```

This command does four important things:

1. `--network kichain-net` puts the app container on the same network as MongoDB.
2. `--env-file .env` loads the shared root environment file.
3. `-e MONGODB_URI=...` overrides the CLI-friendly MongoDB URI with the Docker-container URI.
4. `-p 5173:5173` and `-p 3000:3000` expose the frontend and backend to your host machine.

If `.env` already contains `MONGODB_URI=mongodb://kichain-db:27017/kichain-db`, you can omit the `-e MONGODB_URI=...` line.

#### Step 5: Verify the Docker setup

In another terminal:

```bash
docker ps
curl http://localhost:3000/health
```

Open the frontend:

```text
http://localhost:5173
```

You should see both containers running:

```text
kichain-db
kichain-dev-local
```

#### Step 6: Stop Docker containers

Stop the app container:

```bash
docker stop kichain-dev-local
```

Stop MongoDB:

```bash
docker stop kichain-db
```

Remove MongoDB if you want a clean database next time:

```bash
docker rm kichain-db
```

## 7. Clean Up and Reset Local Docker Environment

Use this section when the local Docker environment becomes confusing, for example old containers are still running, ports are already in use, or the app appears to be using stale data.

### 7.1 Project-only reset

This removes only the containers, image, and network used by this project. It does not remove unrelated Docker resources from other projects.

#### Step 1: Remove project Docker resources

```bash
# Stop and remove project containers.
docker rm -f kichain-dev-local kichain-db 2>/dev/null || true

# Remove the local app image built for this project.
docker rmi kichain-dev:local 2>/dev/null || true

# Remove the project network.
docker network rm kichain-net 2>/dev/null || true
```

#### Step 2: Rebuild from a clean Docker state

```bash
docker network create kichain-net 2>/dev/null || true

docker run -d \
  --name kichain-db \
  --network kichain-net \
  -p 27017:27017 \
  mongo:latest

docker build -t kichain-dev:local .

docker run --rm \
  --name kichain-dev-local \
  --network kichain-net \
  --env-file .env \
  -e MONGODB_URI=mongodb://kichain-db:27017/kichain-db \
  -p 5173:5173 \
  -p 3000:3000 \
  kichain-dev:local
```

### 7.2 Reset only the MongoDB data

Use this if the app image is fine but you want an empty local database.

```bash
docker rm -f kichain-db 2>/dev/null || true

docker network create kichain-net 2>/dev/null || true

docker run -d \
  --name kichain-db \
  --network kichain-net \
  -p 27017:27017 \
  mongo:latest
```

This deletes the data stored inside that MongoDB container. This is safe for local development data, but do not use it for any database container that contains data you need to keep.

### 7.3 Optional aggressive Docker cleanup

Use this only if Docker itself is cluttered and you are comfortable deleting unused Docker resources across your machine.

```bash
# Remove all stopped containers, unused networks, dangling images, and build cache.
docker system prune

# More aggressive: also remove all unused images.
docker system prune -a
```

Do not use `docker system prune -a` if you want to keep images from other projects.

## 8. Testing and Coverage

Backend tests are written with Jest and Supertest. They cover:

1. Auth API contract tests.
2. Room API contract tests, including happy paths and key error paths.
3. Core game-state unit tests for turn progression, elimination, timeout, and forfeit edge cases.
4. Token service unit tests.
5. Focused socket helper tests.

### 8.1 Backend tests

Run backend tests:

```bash
npm test --workspace=server
```

Run backend tests with coverage:

```bash
npm run test:coverage --workspace=server
```

Run backend syntax check, tests, and health smoke test:

```bash
npm run ci --workspace=server
```

The coverage report is generated locally under:

```text
server/coverage/lcov-report/index.html
```

### 8.2 Frontend validation

Run frontend validation:

```bash
npm run ci --workspace=client
```

### 8.3 Full workspace checks

Run all configured workspace checks:

```bash
npm run ci
```

## 9. GitHub Actions CI/CD

The workflow at [.github/workflows/ci.yml](.github/workflows/ci.yml) is manual-only:

```yaml
on:
  workflow_dispatch:
```

This avoids unnecessary GitHub Actions usage during rapid debugging. The current deployment job is intended for the `dev2` branch and uses GitHub repository secrets for AWS deployment credentials. These deployment secrets are separate from the app's local `.env` file.

## 10. Troubleshooting

### 10.1 Backend cannot connect to MongoDB in CLI mode

Check that MongoDB is reachable from your host machine:

```bash
curl http://localhost:3000/health
```

If the backend logs show a MongoDB connection error, confirm that MongoDB is running and that `.env` contains:

```bash
MONGODB_URI=mongodb://localhost:27017/kichain-db
```

### 10.2 Backend cannot connect to MongoDB in Docker mode

If the app container logs show a MongoDB connection error, confirm that both containers are on the same Docker network:

```bash
docker network inspect kichain-net
```

For Docker app-container mode, the app must use:

```bash
MONGODB_URI=mongodb://kichain-db:27017/kichain-db
```

### 10.3 Port already in use

If ports `3000`, `5173`, or `27017` are already in use, stop the old containers or local processes:

```bash
docker ps
docker rm -f kichain-db kichain-dev-local 2>/dev/null || true
```

### 10.4 Environment variables appear outdated

After changing `.env`, restart the relevant process or Docker container. Vite and the backend read environment variables at process startup.
