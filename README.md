# Group Project Chiwifruit

Full-stack workspace for the Sound Chain game project.

This repository contains:
- A React + Vite frontend in [client](client)
- An Express + MongoDB backend in [server](server)
- A birdcall metadata CSV used as reference data at the repository root

## Project Structure

```text
group-project-chiwifruit/
├── client/                  # React frontend
├── server/                  # Node/Express backend
├── birdscall_data - Sheet1.csv
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

## Environment Variables

### Backend

See [server/.env.example](server/.env.example).

Important defaults:
- `PORT=3000`
- `FRONTEND_ORIGIN=http://localhost:5173`
- `MONGODB_URI=mongodb://localhost:27017/kichain-db`

### Frontend

See [client/.env.example](client/.env.example).

Important defaults:
- `VITE_API_URL=http://localhost:3000/api`
- `VITE_SOCKET_URL=http://localhost:3000`

## Dataset Note

The CSV at repository root is a reference metadata file for bird audio samples.

Fields include:
- `fileName`
- `species`
- `source`
- `location`
- `recordedAt`
- `pageTitle`
- `notes`

Planned usage:
- Audio files in AWS S3
- Metadata persisted in MongoDB

## Troubleshooting

- If backend fails on startup, verify MongoDB is running and `MONGODB_URI` is valid in `server/.env`.
- If frontend cannot call backend, verify `VITE_API_URL` and `VITE_SOCKET_URL` in `client/.env`.
- If S3-related endpoints fail, replace placeholder AWS values in `server/.env` with real credentials and bucket settings.
