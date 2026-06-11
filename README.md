# LLM-powered Issue Resolver — Deployed Instances

The project is deployed and verified at the following production URLs (as requested):

- Frontend (Firebase): https://llm-code-resolver.web.app
- Backend API (Railway): https://llm-issue-resolver-production.up.railway.app

This README focuses on the deployed application usage and verification steps. Local development instructions are intentionally omitted per request.

## What I verified (live checks)
- Frontend homepage loads and navigation links are present.
- Backend `/health` responded: `{ "status": "Server is running", "timestamp": "..." }`.
- Backend `/api/test-embedding-status` returned a sample embedding vector and confirmed embedding model connectivity.
- Backend `/api/repos` returned at least one cloned repository (example: `CineSpot`).
- Backend `/api/solve-issue` returned an LLM-generated solution for a simple test issue.

All checks were performed against the deployed endpoints on 2026-06-11.

## How to use the deployed app

1. Open the frontend in your browser:

	https://llm-code-resolver.web.app

2. Sign in or sign up (if required by the app) and go to the **Connect** page.
	- Paste a public GitHub repository HTTPS URL and click **Clone Repo**.
	- After cloning, you should be redirected to the **Issue** page.

3. On the **Issue** page:
	- Select the cloned repository (from the repo list).
	- Enter a short issue description and submit.
	- You will be shown a generated solution on the **Solution** page.

## Quick API checks (curl)
Use these commands to verify the deployed backend manually:

```bash
# Health
curl -sS https://llm-issue-resolver-production.up.railway.app/health

# Embedding test
curl -sS https://llm-issue-resolver-production.up.railway.app/api/test-embedding-status

# Repo list
curl -sS https://llm-issue-resolver-production.up.railway.app/api/repos

# Solve an issue (example)
curl -sS -X POST https://llm-issue-resolver-production.up.railway.app/api/solve-issue \
  -H "Content-Type: application/json" \
  -d '{"issue":"How to run the project","repoName":"CineSpot","topK":3}'
```

## Troubleshooting (deployed)

- If `/api/test-embedding-status` returns an error, check provider quotas (OpenAI/Groq) and whether the backend has valid API keys configured in Railway environment variables.
- If cloning fails for a repo, the backend will return the clone error; verify the provided repo URL is public or that the backend has a valid `GIT_AUTH_TOKEN` configured in Railway for private repos.
- If the `/api/solve-issue` request returns `429`, the backend has rate-limit retry logic; retry after a short wait or check your LLM provider usage quota.

## Notes

- I verified the live deployment responses on 2026-06-11. The service is live and responds to the primary flows (clone → list → solve). If you want, I can add a short automated smoke-test script under `/scripts` to run these checks programmatically.

If you'd like the README adjusted further (remove local instructions entirely, add API contract details, or add automated checks), tell me which format you prefer and I'll update it.
