# eShoferi frontend

React app for eShoferi, built with Vite and React Router.

## Run locally

The Django backend must be running on `http://127.0.0.1:8000` (see `../backend`).
Vite forwards every `/api` request to it, so cookies and CSRF work without CORS.

```
npm install
npm run dev
```

Then open http://localhost:5173.
