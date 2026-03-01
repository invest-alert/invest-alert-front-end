# Invest Alert Frontend MVP

Frontend MVP for the Invest Alert product:
"Don't tell me everything, tell me what matters to my money."

This app is built with React + TypeScript + Vite and is wired to your FastAPI backend for:

- JWT auth (`register`, `login`, `refresh`, `logout`, `me`)
- Watchlist management (`GET`, `POST`, `DELETE`)
- Unified API envelope handling for success/error responses

## Tech Stack

- React 18
- TypeScript
- Vite
- Plain CSS (custom visual style, responsive desktop/mobile)

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Configure backend URL:

Create `.env` in project root:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

3. Run development server:

```bash
npm run dev
```

4. Build production bundle:

```bash
npm run build
```

## API Contract Support

The frontend expects every backend response in this envelope:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {},
  "error": null
}
```

On failures:

```json
{
  "success": false,
  "message": "Validation error",
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "details": []
  }
}
```

## Notes

- Access + refresh tokens are stored in `localStorage`.
- If an authenticated request returns `401`, the app auto-calls `/api/v1/auth/refresh` once and retries.
- Watchlist UI enforces max 15 stocks on the client side to match backend rules.
