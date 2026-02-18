# Frontend (Vite)

## Scripts

- `npm run dev` - development server (default `http://localhost:3000`)
- `npm run build` - production build
- `npm run preview` - preview built app locally

## API and media routing (same-origin)

- Frontend calls API via relative prefix: `/api`
- Media URLs are relative: `/uploads/...`
- In local dev, Vite proxies `/api` and `/uploads` to backend
- In production, reverse proxy (nginx) keeps the same contract (`/api`, `/uploads`)

## Environment variables

### Frontend

- Use only `VITE_*` variables
- Do not use `REACT_APP_*` (legacy CRA format)

Example:

```env
VITE_APP_ENV=development
```

### Backend (release-critical)

- `APP_ENV` (`dev` or `prod`)
- `CORS_ORIGINS` (comma-separated list of allowed origins)
- `COOKIE_SECURE` (`true` in production with HTTPS)
- `COOKIE_SAMESITE` (`lax`/`strict`/`none` based on your cookie strategy)

## Dev auth button rule

Dev button is visible only when both conditions are true:

- `import.meta.env.MODE === 'development'`
- `window.location.hostname` is one of: `localhost`, `127.0.0.1`, `::1`
