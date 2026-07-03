# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (React/Vite)
```bash
npm run build        # Build frontend to dist/public/
npm run check        # TypeScript type check
```

### Backend (Go)
```bash
go build -o boxTracker             # Build for current platform
GOOS=linux GOARCH=amd64 go build -o server_linux_amd64  # Cross-compile for production
go vet ./...                       # Lint Go code
```

### Running locally
The Go server listens on `127.0.0.1:8091` and serves the built frontend from `dist/public/`. You must build the frontend first, then run the Go server:
```bash
npm run build && go run .
```

For frontend development with hot reload, run Vite's dev server alongside the Go backend:
```bash
# Terminal 1
go run .
# Terminal 2
cd client && npx vite
```

### Deploy
```bash
./deploy.sh   # Builds both frontend and backend, then deploys to boxtracker.net via SSH
```

## Architecture

This is a **full-stack SPA** with a Go HTTP server backend and a React frontend built separately with Vite.

### Backend (Go)
- **`main.go`** — Sets up the Gorilla mux router, registers all routes, and serves the built React SPA from `dist/public/` via a custom `spaHandler` that falls back to `index.html` for client-side routes.
- **`models.go`** — MongoDB document structs: `User`, `Box`, `Item`. All IDs are `primitive.ObjectID` (MongoDB BSON). `Box` includes a generated `BoxNumber` (format: `BXT-YYYYMMDD-NNNN`) and a unique `QRToken` used for QR code scanning.
- **`db.go`** — Initializes the MongoDB connection (`boxtracker` database, collections: `users`, `boxes`, `items`, `counters`). Uses an atomic counter in the `counters` collection to generate sequential box numbers.
- **`auth.go`** — Cookie-based session auth using `gorilla/sessions`. `RequireAuth` middleware gates all `/api/*` endpoints except login/register. Session key is hardcoded as a development secret — **must be changed for production**.
- **`oauth.go`** — Google and Facebook OAuth2 login. OAuth users are stored with their email as username and no password. Base URL switches between `https://boxtracker.net` and `http://localhost:8091` based on `ENV` env var.
- **`handlers.go`** — All REST API handlers. The search handler uses MongoDB case-insensitive regex to match items (name/description) and boxes (name/location/box_number), then groups results by box.

All protected endpoints require a valid session. User data is always scoped to `user.ID` — no user can access another user's boxes or items.

### Frontend (React/TypeScript)
Root: `client/src/`

- **`App.tsx`** — Top-level providers: `QueryClientProvider`, `AuthProvider`, `SplashScreen`. Routes via `wouter`: `/auth`, `/qr/:token`, `/` (home), `/box/:id`.
- **`hooks/use-auth.tsx`** — `AuthContext` wrapping login/logout/register mutations. Auth state comes from `GET /api/user`; on 401 it returns null (not a throw), so unauthenticated state is handled gracefully.
- **`lib/queryClient.ts`** — Shared TanStack Query client. All queries use the URL as the query key and fetch with `credentials: "include"`. `staleTime: Infinity` means data is never re-fetched automatically — mutations must call `queryClient.invalidateQueries()` after writes.
- **`pages/home-page.tsx`** — Box list with live autocomplete search (fires as user types) and a separate full-content search on button click. Sort (numerical/alphabetical) and "Important only" filter are client-side. The QR scanner opens a camera dialog to scan a box QR and navigate to it.
- **`pages/box-page.tsx`** — Item CRUD for a single box. Items can be moved to other boxes via a select dropdown.
- **`pages/qr-redirect-page.tsx`** — Handles `/qr/:token` URLs (printed on physical labels), looks up the box by QR token and redirects to `/box/:id`.
- **`lib/print-label.ts`** — Opens a print window with the box name, location, box number, and QR code image for physical labeling.
- **`shared/schema.ts`** — Shared Zod schemas and TypeScript types used by both form validation on the frontend and as the canonical type definitions. Import with `@shared/schema`.

### Key environment variables
| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string (defaults to `mongodb://localhost:27017`) |
| `ENV` | Set to `development` to use `localhost:8091` OAuth redirect URLs |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | Facebook OAuth credentials |

### Production deployment
The app runs as a systemd service (`boxtracker.service`) on `boxtracker.net`. The Go binary is `server_linux_amd64`. The service requires MongoDB (`mongod.service`) to be running. Deploy with `./deploy.sh`.
