# KiChain - Group Project Chiwifruit

KiChain is a full-stack multiplayer memory game built for COMPSCI 732. Players join a shared room, listen to sound options, and take turns reproducing an increasingly long sound sequence. The project is implemented as a React + Vite client, an Express + MongoDB backend, and Socket.IO realtime communication.

> [!TIP]
> Start here if you are a marker, reviewer, or new team member. This root README explains the overall product, local setup, Docker setup, testing, deployment, and troubleshooting. More detailed frontend and backend notes are linked near the end.

## 1. Product Overview

### 1.1 Core user flow

1. A player enters as a guest or registered user.
2. A host creates a game room.
3. Other players join using the room code.
4. The host selects the sound mode and difficulty.
5. Players ready up in the waiting room.
6. Players enter a familiarisation phase to hear and practise the sounds.
7. During gameplay, each player repeats the existing sound chain and adds one new sound.
8. Incorrect input eliminates the player from active play.
9. The game ends when the result condition is reached, and rankings are displayed.

### 1.2 Main features

1. Guest and registered-user authentication.
2. Room creation and room-code joining.
3. Host-controlled mode and difficulty selection.
4. Realtime waiting-room updates through Socket.IO.
5. Familiarisation stage before the main game.
6. Turn-based multiplayer sound-chain gameplay.
7. Elimination, forfeit handling, and result ranking.
8. Local CLI development and local Docker development workflows.
9. Backend automated tests and Docker-based deployment support.

## 2. Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS, React Query, Socket.IO client |
| Backend | Node.js, Express, MongoDB, Mongoose, Socket.IO |
| Auth/session | JWT, guest sessions, local/session browser storage |
| Audio/UI | Static frontend audio assets, Howler.js, Framer Motion |
| Testing | Jest, Supertest, MongoDB Memory Server, Vitest, jsdom, Socket.IO client integration tests |
| DevOps/deployment | Docker, GitHub Actions, AWS EC2/ECR, Nginx, CloudFront, MongoDB Atlas |

> [!NOTE]
> Audio files are handled as frontend static assets for the MVP. The backend no longer depends on S3 audio delivery for local development.

## 3. Architecture and Design Rationale

KiChain follows a modular monorepo structure with a clear separation between frontend presentation, backend API/socket coordination, domain logic, and database persistence.

### 3.1 High-level runtime view

```text
Browser (React + Vite)
   |
   | HTTP REST + Socket.IO
   v
Express API + Realtime Gateway
   |
   | service/model calls
   v
MongoDB / MongoDB Atlas
```

### 3.2 Architectural decisions

1. **Monorepo with npm workspaces**
   - The client and server evolve together in one repository.
   - Root scripts make local setup and validation easier for the team.

2. **Backend as the authoritative game engine**
   - The server owns room state, game lifecycle, turn progression, elimination, forfeit handling, and results.
   - This avoids each browser making its own rule decisions in a multiplayer game.

3. **REST plus realtime split**
   - REST APIs handle authentication and room lifecycle operations.
   - Socket.IO handles latency-sensitive multiplayer updates such as room state, familiarisation, active turns, pad presses, and results.

4. **Service-oriented backend logic**
   - Controllers and socket handlers should stay focused on transport-level coordination.
   - Reusable domain rules live in backend services, which makes the game logic easier to test.

5. **Environment-based deployment configuration**
   - Local CLI development can use a host-machine MongoDB URI.
   - Local Docker development can use a container-network MongoDB URI.
   - The shared remote environment uses MongoDB Atlas through environment variables.

> [!IMPORTANT]
> GitHub Actions deployment is currently manual through `workflow_dispatch`. Do not assume every PR or push is automatically protected by a full CI/CD gate. Run the documented validation commands locally before merging significant changes.

## 4. Project Structure

```text
group-project-chiwifruit/
├── client/                  # React + Vite frontend
├── server/                  # Node / Express backend
├── .env.example             # Single shared environment template
├── Dockerfile               # Local / deployment container image definition
└── README.md                # Main project setup and delivery guide
```

## 5. Prerequisites

1. Node.js 18+ and npm.
2. Docker, if using the Docker-based local setup.
3. MongoDB, either running directly on your machine or as a Docker container.

## 6. Environment Configuration

This project uses one shared environment file at the repository root.

### 6.1 Create the root `.env` file

```bash
cp .env.example .env
```

Do not create separate `client/.env` or `server/.env` files. The frontend Vite config and backend dotenv config are both configured to read from the root `.env` file.

> [!IMPORTANT]
> The root `.env` file is intentionally ignored by Git. Commit `.env.example`, but do not commit real secrets or local machine-specific values.

### 6.2 Default local environment values

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

### 6.3 MongoDB URI: host machine vs Docker container

The main value that changes between local run modes is `MONGODB_URI`.

#### 6.3.1 Backend running on the host machine

Use this when the backend is started through npm, for example `npm run dev`, `npm run dev:server`, or `npm run start`:

```bash
MONGODB_URI=mongodb://localhost:27017/kichain-db
```

Here, `localhost` means your Mac / host machine. This works when MongoDB is installed locally, or when MongoDB is running in Docker with port `27017` exposed to the host machine.

#### 6.3.2 Backend running inside a Docker container

Use this when the backend itself runs inside the app container and MongoDB runs in another Docker container:

```bash
MONGODB_URI=mongodb://kichain-db:27017/kichain-db
```

Here, `localhost` would mean the app container itself, not the MongoDB container. The hostname `kichain-db` works only when the app container and MongoDB container are attached to the same user-defined Docker network, `kichain-net`.

#### 6.3.3 Why the Docker command overrides `MONGODB_URI`

The README keeps `.env` suitable for normal CLI development by default:

```bash
MONGODB_URI=mongodb://localhost:27017/kichain-db
```

When running the app inside Docker, the recommended `docker run` command overrides only this one value:

```bash
-e MONGODB_URI=mongodb://kichain-db:27017/kichain-db
```

This means you do not need to edit `.env` every time you switch between CLI development and Docker development.

> [!TIP]
> If you already changed `.env` to use `MONGODB_URI=mongodb://kichain-db:27017/kichain-db`, you can omit the `-e MONGODB_URI=...` line from `docker run`.

## 7. Workspace Scripts

Run these commands from the repository root.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start frontend and backend together for local development |
| `npm run dev:client` | Start only the Vite frontend |
| `npm run dev:server` | Start only the Express backend with nodemon |
| `npm run build` | Build the frontend |
| `npm run start` | Start the backend in non-dev mode |
| `npm run ci` | Run client and server validation checks |

## 8. Local Setup Option 1: CLI Development

Use this option when you want to run the frontend and backend directly from your terminal with npm.

### 8.1 Summary

In this setup:

1. The frontend runs on your host machine through Vite.
2. The backend runs on your host machine through Node / Express.
3. MongoDB can run either directly on your host machine or in a Docker container with port `27017` exposed.
4. The backend should use `mongodb://localhost:27017/kichain-db`.
5. A Docker network is not required, because the backend is not running inside Docker.

### 8.2 Steps

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

## 9. Local Setup Option 2: Docker Development

Use this option when you want to build and run the app inside Docker. This is closer to the shared deployment setup than the CLI option.

### 9.1 Summary

In this setup:

1. MongoDB runs in a Docker container named `kichain-db`.
2. The app runs in a Docker container named `kichain-dev-local`.
3. Both containers must be attached to the same Docker network, `kichain-net`.
4. The app container should use `mongodb://kichain-db:27017/kichain-db`.
5. The Docker network must be created before starting the MongoDB and app containers.

### 9.2 Steps

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

## 10. Clean Up and Reset Local Docker Environment

Use this section when the local Docker environment becomes confusing, for example old containers are still running, ports are already in use, or the app appears to be using stale data.

### 10.1 Project-only reset

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

### 10.2 Reset only the MongoDB data

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

### 10.3 Optional aggressive Docker cleanup

Use this only if Docker itself is cluttered and you are comfortable deleting unused Docker resources across your machine.

```bash
# Remove all stopped containers, unused networks, dangling images, and build cache.
docker system prune

# More aggressive: also remove all unused images.
docker system prune -a
```

> [!WARNING]
> Do not use `docker system prune -a` if you want to keep images from other projects.

## 11. Testing and Coverage

KiChain uses a layered automated testing strategy. The goal is to keep domain logic highly covered at lower levels, then use integration tests for the cross-layer behaviour that matters most in a realtime multiplayer game.

| Area | Tooling | Scope |
| --- | --- | --- |
| Backend unit tests | Jest | Auth, room, token, game service, and mocked socket logic |
| Backend REST/API integration | Jest, Supertest, MongoDB Memory Server | Express routes, auth middleware, Mongoose models, and Mongo persistence |
| Backend socket integration | Jest, real Socket.IO server, `socket.io-client`, MongoDB Memory Server | Realtime auth, room joining, game start, familiarisation, pad press, wrong-note elimination, forfeit, and score persistence |
| Frontend unit tests | Vitest, jsdom | Axios auth/session storage, room API wrappers, and socket client helpers |

### 11.1 Run all project checks

```bash
npm run ci
```

This runs the configured client and server validation scripts.

### 11.2 Run backend tests

```bash
npm test --workspace=server
```

Run backend tests with coverage:

```bash
npm run test:coverage --workspace=server
```

Run only socket-related backend tests:

```bash
npm test --workspace=server -- socket
```

Run backend syntax check, tests, and health smoke test:

```bash
npm run ci --workspace=server
```

Backend coverage is generated locally under:

```text
server/coverage/lcov-report/index.html
```

For more backend testing details, including the folder structure and test-layer boundaries, see [Backend technical notes](server/README.md#7-testing).

### 11.3 Run frontend tests

```bash
npm test --workspace=client
```

Run frontend tests with coverage:

```bash
npm run test:coverage --workspace=client
```

Run frontend lint, tests, and build:

```bash
npm run ci --workspace=client
```

Frontend coverage is generated locally under:

```text
client/coverage/lcov-report/index.html
```

For more frontend testing details, see [Frontend technical notes](client/README.md#10-frontend-testing-and-validation).

> [!NOTE]
> Generated coverage folders are local artifacts and should not be committed.

## 12. Deployment Overview

The shared development/demo environment is deployed as a Dockerized full-stack app.

1. GitHub Actions builds the Docker image manually through `workflow_dispatch`.
2. The image is pushed to AWS ECR.
3. AWS EC2 runs the app container.
4. Nginx routes frontend, backend API, health check, and Socket.IO traffic.
5. CloudFront provides the HTTPS user-facing entry point.
6. MongoDB Atlas is used for the shared remote database instead of a local MongoDB container on EC2.

> [!NOTE]
> GitHub repository secrets are used for AWS deployment credentials. These deployment secrets are separate from the local `.env` file.

## 13. Additional Documentation

The root README is the main setup and delivery guide. Subdirectory READMEs provide implementation details only.

1. [Frontend technical notes](client/README.md)
2. [Backend technical notes](server/README.md)

## 14. GitHub Actions CI/CD

The workflow at [.github/workflows/ci.yml](.github/workflows/ci.yml) is manual-only:

```yaml
on:
  workflow_dispatch:
```

This avoids unnecessary GitHub Actions usage during rapid debugging. The current deployment job is intended for the `dev2` branch and uses GitHub repository secrets for AWS deployment credentials.

## 15. Troubleshooting

### 15.1 Backend cannot connect to MongoDB in CLI mode

Check that MongoDB is reachable from your host machine:

```bash
curl http://localhost:3000/health
```

If the backend logs show a MongoDB connection error, confirm that MongoDB is running and that `.env` contains:

```bash
MONGODB_URI=mongodb://localhost:27017/kichain-db
```

### 15.2 Backend cannot connect to MongoDB in Docker mode

If the app container logs show a MongoDB connection error, confirm that both containers are on the same Docker network:

```bash
docker network inspect kichain-net
```

For Docker app-container mode, the app must use:

```bash
MONGODB_URI=mongodb://kichain-db:27017/kichain-db
```

### 15.3 Port already in use

If ports `3000`, `5173`, or `27017` are already in use, stop the old containers or local processes:

```bash
docker ps
docker rm -f kichain-db kichain-dev-local 2>/dev/null || true
```

### 15.4 Environment variables appear outdated

After changing `.env`, restart the relevant process or Docker container. Vite and the backend read environment variables at process startup.
