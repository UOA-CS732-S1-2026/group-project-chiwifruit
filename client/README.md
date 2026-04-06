# Frontend - React + Vite

A modern React frontend application built with Vite, featuring real-time communication via Socket.io, state management with Zustand, and a polished UI using TailwindCSS and shadcn components.

## Table of Contents

- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [Tech Stack & Packages](#tech-stack--packages)
- [Key Features](#key-features)

## Quick Start

### Prerequisites

- **Node.js** v16+ and **npm** (or yarn/pnpm)

### Installation & Setup

1. **Navigate to the client directory:**
   ```bash
   cd client
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173` (or the port shown in your terminal)

4. **Build for production:**
   ```bash
   npm run build
   ```

5. **Preview the production build:**
   ```bash
   npm run preview
   ```

## Project Structure

```
client/
├── src/
│   ├── api/
│   │   └── axios.js              # Axios HTTP client configuration
│   ├── assets/
│   │   ├── icons/                # SVG icons and icon assets
│   │   └── images/               # Image assets
│   ├── components/
│   │   └── ui/                   # Reusable UI components (shadcn/radix-ui)
│   │       └── button.jsx
│   ├── hooks/
│   │   ├── mutations/            # TanStack Query mutations
│   │   │   ├── useCreateRoomMutation.js
│   │   │   └── useJoinRoomMutation.js
│   │   ├── queries/              # TanStack Query queries
│   │   │   └── useRoomQuery.js
│   │   └── useSocketListeners.js # Socket.io event listeners
│   ├── lib/
│   │   └── utils.js              # Utility functions and helpers
│   ├── pages/
│   │   ├── LandingPage.jsx
│   │   └── StartupPage.jsx
│   ├── socket/
│   │   ├── socket.js             # Socket.io client initialization
│   │   └── socketEvents.js       # Socket event definitions
│   ├── store/
│   │   ├── useGameStore.js       # Game state management (Zustand)
│   │   └── useRoomStore.js       # Room state management (Zustand)
│   ├── App.jsx                   # Main app component
│   ├── main.jsx                  # Application entry point
│   └── index.css                 # Global styles
├── public/                        # Static assets
├── vite.config.js                # Vite configuration with React & Tailwind plugins
├── jsconfig.json                 # JavaScript path aliases configuration
├── eslint.config.js              # ESLint rules
├── components.json               # Component configuration file
└── package.json                  # Project dependencies and scripts
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the development server with HMR (hot reload) |
| `npm run build` | Build the app for production to the `dist` folder |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint to check code quality |

## Tech Stack & Packages

### Core Framework
- **React** (v19.1.1) - UI library for building components
- **Vite** (v7.1.7) - Ultra-fast build tool and dev server
- **React Router DOM** (v7.13.1) - Client-side routing

### State Management
- **Zustand** (v5.0.12) - Lightweight state management library for game and room state

### API & Data Fetching
- **Axios** (v1.13.6) - HTTP client for API requests
- **TanStack Query/React Query** (v5.95.0) - Server state management with caching

### Real-Time Communication
- **Socket.io Client** (v4.8.3) - WebSocket communication for real-time features

### UI & Styling
- **TailwindCSS** (v4.2.1) - Utility-first CSS framework
- **Radix UI** (v1.4.3) - Unstyled, accessible component primitives
- **shadcn** (v4.0.8) - Pre-built Radix UI components with Tailwind styling
- **Lucide React** (v0.577.0) - Icon library with React components
- **Framer Motion** (v12.38.0) - Animation library for React
- **class-variance-authority** (v0.7.1) - CSS class composition utility
- **clsx** (v2.1.1) - Utility for constructing className strings
- **tailwind-merge** (v3.5.0) - Merge Tailwind CSS classes intelligently

### Typography & Fonts
- **@fontsource-variable/geist** (v5.2.8) - Geist variable font

### Audio
- **Howler** (v2.2.4) - Audio playback library

### Development
- **ESLint** (v9.36.0) - Code linting
- **@vitejs/plugin-react** (v5.0.3) - Vite React plugin with fast refresh
- **TypeScript types** - Type definitions for React and React DOM

## Key Features

- ⚡ **Fast Development** - Vite provides instant HMR for rapid development
- 🎮 **Real-Time Communication** - Socket.io integration for live game interactions
- 🎨 **Modern UI** - shadcn components with TailwindCSS for a polished interface
- 📦 **State Management** - Zustand for lightweight state + TanStack Query for server state
- 🔄 **Data Fetching** - Axios with TanStack Query for efficient API calls
- ✨ **Animations** - Framer Motion for smooth, professional animations
- 🎵 **Audio Integration** - Howler.js for sound effects and background music
- 📍 **Routing** - React Router for seamless navigation between pages
