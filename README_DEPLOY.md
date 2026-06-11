# Deployment guide (Frontend hosting + Backend on Cloud Run)

Required credentials / environment variables (backend):
- `GROQ_API_KEY` — API key for Groq (required)
- `OPENAI_API_KEY` — OpenAI API key (required for embeddings)
- `QDRANT_URL` — Qdrant endpoint (e.g. http://localhost:6333 or hosted URL)
- `QDRANT_API_KEY` — Qdrant API key if using hosted Qdrant with auth
- `GMAIL_USER` / `GMAIL_PASS` — (optional) SMTP creds for email notifications
- `GIT_AUTH_TOKEN` — (optional) token for cloning private repos via HTTPS (use with caution)

Frontend env (development / build):
- `NEXT_PUBLIC_API_BASE_URL` — URL to backend API (e.g. https://<your-cloud-run-url> or use relative `/api` when using Firebase rewrites)

Quick local steps
1. Backend: copy example and add secrets
```
cd backend
cp .env.example .env
# edit .env and add keys
node server.js
```
2. Frontend (build & export)
```
cd frontend
npm install
npm run build
npx next export
# `out` directory will be created
```

Deploy backend to Cloud Run
1. Build and push
```
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
cd backend
gcloud builds submit --tag gcr.io/YOUR_GCP_PROJECT_ID/backend-service
```
2. Deploy to Cloud Run
```
gcloud run deploy backend-service \
  --image gcr.io/YOUR_GCP_PROJECT_ID/backend-service \
  --platform managed --region YOUR_REGION \
  --allow-unauthenticated \
  --set-env-vars GROQ_API_KEY=...,OPENAI_API_KEY=...,QDRANT_URL=...,QDRANT_API_KEY=...
```

Deploy frontend to Firebase Hosting
1. Configure Firebase
```
firebase login
firebase init hosting
# set public directory to `out` and configure SPA rewrite
```
2. Update `firebase.json` rewrites to point to your Cloud Run `backend-service` and region

3. Deploy
```
firebase deploy --only hosting
```

Notes
- Prefer using Cloud Run environment variables (or Secret Manager) for secrets instead of embedding tokens in code.
- For private repo cloning, prefer SSH deploy keys added to GitHub and ensure the service account running Cloud Run has access to the private key via Secret Manager and a startup script that writes it to `/root/.ssh/id_rsa`.
