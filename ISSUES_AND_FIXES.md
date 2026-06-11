# Issues Summary & Fixes

## Issue 1: ✅ FIXED - Clone returns HTML instead of JSON
**What was happening:** When cloning repos, the client received HTML error pages instead of JSON.  
**Root cause:** Unhandled exceptions in Express defaulted to HTML error responses.  
**Fix applied:**
- Added try/catch around clone operation (✅ done)
- Added global Express error handler to return JSON (✅ done)
- Updated frontend to check content-type before parsing JSON (✅ done)

**Status:** ✅ Working! Logs show successful clones returning JSON.

---

## Issue 2: ❌ Background embedding fails with "TypeError: fetch failed"
**What was happening:** After clone succeeds and returns JSON, background embedding fails during OpenAI API call.  
**Root cause:** Invalid/missing `OPENAI_API_KEY` OR network connectivity issue to OpenAI embeddings endpoint.  
**Symptoms in logs:**
```
TypeError: fetch failed
Qdrant: Collection 'your_collection' does NOT exist. Creating...
```

**Fix:** Check your `backend/.env` file:
```bash
cat /home/hassanahmed/Desktop/LLM-powered-code-issue-resolver/backend/.env
```

Ensure you have:
- `OPENAI_API_KEY=<valid-key>` (get from https://platform.openai.com/account/api-keys)
- `GROQ_API_KEY=<valid-key>` (get from https://console.groq.com)
- `QDRANT_URL=<valid-url>` (e.g., http://localhost:6333)

If keys are missing or invalid, embeddings will fail silently in background.

**Testing:**
```bash
curl -X POST http://localhost:5001/api/test-embedding \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world test"}'
```

If this fails or returns errors, your OpenAI API key is invalid.

---

## Issue 3: ✅ FIXED - Directory already exists errors on retry clones
**What was happening:** Cloning same repo twice failed with "destination path already exists and is not an empty directory".  
**Root cause:** Git clone refuses to clone into non-empty directories.  
**Fix applied:**
- Added code to remove existing directory before cloning (fresh clone each time)
- Logs now show "Removing existing directory" messages

**Status:** ✅ Fixed! You can now clone the same repo multiple times.

---

## How to verify everything works

**Step 1: Verify your credentials**
```bash
cat /home/hassanahmed/Desktop/LLM-powered-code-issue-resolver/backend/.env
```

Check that these are filled in (not empty):
- `GROQ_API_KEY`
- `OPENAI_API_KEY`
- `QDRANT_URL`

**Step 2: Restart backend with new code**
```bash
cd /home/hassanahmed/Desktop/LLM-powered-code-issue-resolver/backend
node server.js
```

**Step 3: Test clone (new terminal)**
```bash
curl -i -X POST http://localhost:5001/api/clone \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/vercel/next.js.git"}'
```

Expected response (JSON, NOT HTML):
```json
{
  "message": "Repo cloned to ... Embedding will run in background.",
  "repoName": "next.js",
  "targetDir": "/path/to/cloned_repos/next.js"
}
```

Check backend logs for embedding progress:
```
✅ Background embedding complete for repo: next.js { ... }
```

Or if OpenAI key is bad, you'll see:
```
❌ Background embedding failed for repo: next.js
   Error message: TypeError: fetch failed
```

**Step 4: Test again with same repo**
```bash
curl -i -X POST http://localhost:5001/api/clone \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/vercel/next.js.git"}'
```

Should work without "directory exists" error (fresh clone each time).

---

## Deployment checklist

Before deploying to Firebase/Cloud Run, ensure:

- [ ] `backend/.env` has valid `GROQ_API_KEY`
- [ ] `backend/.env` has valid `OPENAI_API_KEY`  
- [ ] `backend/.env` has valid `QDRANT_URL` and `QDRANT_API_KEY`
- [ ] Test curl clone returns JSON (not HTML)
- [ ] Test embedding completes successfully (check logs for ✅)
- [ ] Frontend builds: `cd frontend && npm run build` (produces `out` folder)
- [ ] `gcloud` and `firebase-tools` installed
- [ ] `firebase.json` updated with your Cloud Run region and service ID
- [ ] Secrets stored in Cloud Run environment or Secret Manager (not in code)
