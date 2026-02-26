# Vibewood

Vibewood is a minimal Express + TypeScript service that turns natural-language prompts into fully rendered HTML mockups. It relies on OpenAI's Responses API to rewrite a base document (or a previously generated page) and serves the results through a small web UI.

## Features

- Playground UI (`public/index.html`) for sending prompts and previewing responses in an iframe.
- `/api/create` endpoint that forwards the current document and user prompt to OpenAI, then persists the returned HTML inside `public/generated/`.
- TypeScript build pipeline with `tsc` and a Node 20+ runtime image backed by Docker.

## Prerequisites

- Node.js 20 or newer (use `nvm use` if you keep multiple versions installed).
- An OpenAI API key with access to the Responses API (`OPENAI_API_KEY`).
- Optional: Docker Desktop if you want to build or run the container image.

## Getting Started

```bash
npm install
npm run build
OPENAI_API_KEY=sk-... npm start
```

During development you can use the watch mode:

```bash
OPENAI_API_KEY=sk-... npm run dev
```

The server listens on `http://localhost:3000`. Open the root URL to use the playground.

## Environment Variables

- `OPENAI_API_KEY` (required): Auth token for OpenAI.
- `OPENAI_MODEL` (optional): Overrides the default `gpt-4.1-mini`.
- `PORT` (optional): HTTP port, defaults to `3000`.

## Docker Usage

Build the image:

```bash
docker build -t vibewood .
```

Run it:

```bash
docker run -p 3000:3000 -e OPENAI_API_KEY=sk-... vibewood
```

Generated HTML files are written under `/app/public/generated/` inside the container.
