# shell-dex

Minimal bootstrap for the Shell DEX submodule.

## Scope

This repository starts as a lightweight frontend/bootstrap workspace for the future Shell DEX product surface. It intentionally does **not** ship the full trading stack in the first commit; the goal is to provide:

- a standalone repository under `ShellDAO/shell-dex`
- a local development fork workflow via `LucienSong/shell-dex`
- a runnable web app skeleton for iterative feature work
- a dedicated `agents/` directory for AI-agent-specific assets

## Local development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Scripts

- `npm run dev` — start local development server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run typecheck` — TypeScript no-emit validation

## Repository conventions

- Application code lives in `app/`
- Shared agent assets must live in `agents/`
- Root workspace mirror lives in `workspace/projects/shell-dex/` in the parent `shell-dev` repository
