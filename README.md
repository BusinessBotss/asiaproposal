# Resto WhatsApp Internal Comms (Monorepo)

Premium-grade internal communications platform for restaurant groups using WhatsApp Cloud API, Firebase Auth, Node/Express, and React.

## Stack
- Backend: Node.js + Express + TypeScript + PostgreSQL
- Bot: Node.js microservice for WhatsApp Cloud API
- Frontend: React (Vite) + Tailwind + Radix UI, dark premium design
- Shared: Type-safe types/constants
- Auth: Firebase Auth (roles: GM, Staff, SuperAdmin), JWT in backend
- Infra: Docker Compose, GitHub Actions CI, HTTPS-ready deploys

## Quickstart (Dev)
1. Copy env: `cp .env.example .env` and fill values
2. Install: `npm install` (uses npm workspaces)
3. Start DB (optional): `docker compose up -d db`
4. Run services:
   - Backend: `npm run dev --workspace backend`
   - Bot: `npm run dev --workspace bot`
   - Frontend: `npm run dev --workspace frontend`

## Docker (All services)
```bash
docker compose up --build
```

## CI
See `.github/workflows/ci.yml`. Pushes run typecheck, build and tests.

## Roadmap
1) Docker + basic APIs 2) WhatsApp integration + DB 3) Frontend + i18n 4) QA/Tests/Payments 5) Deploy/Monitoring/Manual

## License
Proprietary. All rights reserved.