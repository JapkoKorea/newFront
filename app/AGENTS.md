# Backend Auth Service Governance

## Module Context

`japan-taxi-tour/app` is the FastAPI backend service for Kakao OAuth authentication and JWT token management.

- Purpose: exchange Kakao auth code for user info and issue service JWT tokens
- Scope: authentication callback flow, token issuance, and user session management
- Integration: serves the React frontend running on port 5173

## Tech Stack and Constraints

- Runtime: Python + FastAPI + Uvicorn (port 8000)
- Auth-related packages: `python-jose`, `jwt`, `python-dotenv`
- Constraint: keep authentication logic isolated from business logic (reservation handling)
- Constraint: token issuance/claims format must remain explicit and documented in code
- Constraint: CORS configured for frontend at localhost:5173 (dev) and production domain

## Implementation Patterns

- Keep provider API calls in router/service helpers, not in utility scripts.
- Validate callback payloads with Pydantic models.
- Keep JWT construction centralized and avoid duplicated signing logic.
- Use environment variables for client IDs, secrets, and signing keys.

## Testing Strategy

- Recommended run command: `uvicorn app.main:app --reload --port 8000` (from `japan-taxi-tour/app` workspace context where applicable).
- Minimum verification for auth changes:
  - valid code exchange path,
  - invalid code error path,
  - token payload shape check.

## Local Golden Rules

Do:

- Keep OAuth error handling explicit and user-safe.
- Keep outbound requests timeout-bounded.
- Log only non-sensitive diagnostic metadata.

Do Not:

- Do not return provider access tokens to unintended clients.
- Do not hardcode client credentials.
- Do not spread auth logic into unrelated frontend files.
