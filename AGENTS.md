# Japan Taxi Tour - Project Governance

## Project Context and Operations

Full-stack taxi tour booking application for Biei, Japan. Integrates React frontend with FastAPI backend in a unified workspace.

**Architecture:**
- Frontend: React 19 + Vite + React Router (port 5173)
- Backend: FastAPI + Uvicorn (port 8000)
- UI Framework: Tailwind CSS + Radix UI primitives
- Map Integration: Google Maps API

**Operational Commands:**

Frontend development:
- `pnpm dev` - Start Vite dev server
- `pnpm build` - Production build
- `pnpm lint` - ESLint checks
- `pnpm preview` - Preview production build

Backend development:
- `uvicorn app.main:app --reload --port 8000` - Start FastAPI server
- `python app/main.py` - Alternative startup

Full stack (concurrent):
- Frontend: http://localhost:5173
- Backend: http://localhost:8000

## Golden Rules

Immutable:

- Never commit `.env` or `.env.local` files containing API keys.
- Never hardcode Kakao Client ID or Google Maps API key in source.
- Never disable CORS entirely in production (`allow_origins=["*"]`).
- Never expose JWT secret keys or user tokens in logs.

Do:

- Keep all API keys in environment variables only.
- Use Vite's `import.meta.env` for frontend env vars (VITE_* prefix).
- Use python-dotenv for backend env vars.
- Validate Google Maps API responses before using coordinates.
- Keep Kakao OAuth redirect URIs synchronized between frontend and backend.

Do Not:

- Do not mix backend Python code into frontend src/ directory.
- Do not use different formatting rules between frontend and backend.
- Do not bypass React state management for form data.
- Do not commit build artifacts (dist/) to version control.

## Standards and References

Frontend (React/Vite):

- Use functional components with hooks only.
- Keep components focused: presentational vs container separation.
- Use Tailwind for styling; avoid inline styles.
- Import UI components from `@/components/ui/` (Radix-based).
- Use `lucide-react` for icons consistently.
- Format: Prettier (if configured), ESLint enforced.

Backend (FastAPI):

- Follow PEP 8 style guide.
- Use Pydantic models for all request/response schemas.
- Keep routes thin; business logic in service modules.
- Use async/await for I/O operations (HTTP calls, DB).
- Type hints required for all function signatures.

Git:

- Commit format: `<type>: <description>`
- Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`
- Example: `feat: add multi-step booking form validation`

API Contracts:

- Backend routes prefixed with `/api`
- Kakao OAuth callback: POST `/api/auth/kakao/callback`
- CORS configured for localhost:5173 in dev, production domain in prod.

## Context Map (Action-Based Routing)

- **[Frontend UI Components](./src/components/)** — React components, booking flows, map integration.
- **[Frontend UI Primitives](./src/components/ui/)** — Radix UI based reusable components (Button, Dialog, etc.).
- **[Frontend Entry & Routing](./src/App.jsx)** — Main app component, route definitions, page layout.
- **[Frontend Assets](./src/assets/)** — Images, fonts, static files.
- **[Backend API Routes](./app/routers/)** — FastAPI route handlers (auth, etc.).
- **[Backend Entry Point](./app/main.py)** — FastAPI app factory, middleware registration.
- **[Configuration](./vite.config.js)** — Vite build configuration, path aliases.
- **[Environment Config](./.env.local)** — Local environment variables (not committed).

## Workspace Structure

```
japan-taxi-tour/
├── src/                          # Frontend React application
│   ├── components/              # React components
│   │   ├── TaxiBooking.jsx     # Main booking modal (multi-step)
│   │   ├── MapContainer.jsx    # Google Maps integration
│   │   ├── ChatSupport.jsx     # Customer chat widget
│   │   ├── FAQ.jsx             # FAQ modal
│   │   ├── LoginKakao.jsx      # Kakao login button
│   │   └── ui/                 # Radix UI primitive components
│   ├── assets/                 # Static images
│   ├── App.jsx                 # Main app with routing
│   └── main.jsx                # React entry point
├── app/                         # Backend FastAPI application
│   ├── main.py                 # FastAPI entry
│   └── routers/
│       └── auth/
│           └── kakao.py        # Kakao OAuth handler
├── public/                      # Static public assets
├── package.json                 # Node dependencies
├── pyproject.toml              # Python dependencies
├── vite.config.js              # Vite configuration
└── .env.local                  # Local environment (gitignored)
```

## Key Implementation Notes

Booking Flow:
- Multi-step form in TaxiBooking.jsx (4 steps: course, schedule, route, contact).
- Google Maps integration for pickup/dropoff selection.
- Form state managed via React useState (not React Hook Form in this version).
- Hot toast notifications for user feedback.

Authentication:
- Kakao OAuth only (no local auth).
- JWT tokens issued by backend.
- Frontend stores tokens and user info.

Map Integration:
- Google Maps JavaScript API required.
- Custom markers for pickup/dropoff spots.
- Route visualization between points.
- Region restricted to Biei/Asahikawa area.

Build & Deploy:
- Frontend builds to `dist/` directory.
- Backend serves API only (no static files from backend).
- Production: Frontend served via CDN or static hosting, backend via serverless or container.
