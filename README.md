# Group Project Chiwifruit

[![CI/CD](https://github.com/UOA-CS732-S1-2026/group-project-chiwifruit/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/UOA-CS732-S1-2026/group-project-chiwifruit/actions/workflows/ci.yml)

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
