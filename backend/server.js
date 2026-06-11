const express = require('express');
const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { QdrantClient } = require('@qdrant/js-client-rest');
const axios = require('axios');
const crypto = require('crypto');
const Groq = require('groq-sdk');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = express();
app.use(express.json());
app.use(cors());

// ─── ENV SETUP ───────────────────────────────────────────────────────────────

const rawQdrantUrl = (process.env.QDRANT_URL || 'http://localhost:6333').trim();
if (rawQdrantUrl.includes('|')) {
  console.warn(
    'WARNING: QDRANT_URL contains more than one value separated by "|". Using the first URL only.'
  );
}
const QDRANT_URL = rawQdrantUrl.split(/\s*\|\s*/).find(Boolean)?.trim() || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const HF_API_KEY = process.env.HF_API_KEY; // Hugging Face API key (free tier)

if (!GROQ_API_KEY) {
  console.error("ERROR: GROQ_API_KEY is missing.");
  process.exit(1);
}

if (!HF_API_KEY) {
  console.error("ERROR: HF_API_KEY is missing. Get a free key at https://huggingface.co/settings/tokens");
  process.exit(1);
}

try {
  new URL(QDRANT_URL);
} catch (urlError) {
  console.error(`ERROR: QDRANT_URL is invalid: ${QDRANT_URL}`);
  process.exit(1);
}

console.log(`Using Qdrant URL: ${QDRANT_URL}`);

const qdrant = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY,
  checkCompatibility: false
});

const groq = new Groq({ apiKey: GROQ_API_KEY });

console.log('Qdrant URL:', QDRANT_URL);
console.log('Qdrant API Key:', QDRANT_API_KEY ? 'Present' : 'Not present');
console.log('Groq API Key:', GROQ_API_KEY ? 'Present' : 'Not present');
console.log('HuggingFace API Key:', HF_API_KEY ? 'Present' : 'Not present');
console.log("CORS enabled for all origins");

// ─── EMBEDDING via Hugging Face (free, 384 dimensions, all-MiniLM-L6-v2) ─────

const HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const VECTOR_SIZE = 384;

async function getEmbedding(text, retries = 5) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios.post(
        `https://router.huggingface.co/hf-inference/models/${HF_MODEL}/pipeline/feature-extraction`,
        { inputs: text },
        {
          headers: {
            Authorization: `Bearer ${HF_API_KEY}`,
            "Content-Type": "application/json"
          },
          timeout: 30000
        }
      );

      // HF returns a nested array [[...embeddings...]]
      const data = response.data;
      let vector;

      if (Array.isArray(data) && Array.isArray(data[0])) {
        // Sentence-transformers returns [[vec]] — take first item
        vector = data[0];
      } else if (Array.isArray(data)) {
        vector = data;
      } else {
        throw new Error("Unexpected HuggingFace response format");
      }

      return vector;
    } catch (error) {
      const statusCode = error.response?.status;
      const errorMsg = error.response?.data?.error || error.message;

      console.error(`HF Embedding error (attempt ${attempt + 1}/${retries}): ${statusCode} - ${errorMsg}`);

      // Model is loading — wait and retry
      if (statusCode === 503) {
        const waitTime = (error.response?.data?.estimated_time || 20) * 1000;
        console.log(`Model loading, waiting ${waitTime / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      if (statusCode === 401 || statusCode === 403) {
        throw new Error(`HuggingFace auth error: ${statusCode} - Check HF_API_KEY`);
      }

      if (attempt < retries - 1) {
        const delayMs = Math.pow(2, attempt) * 1000;
        console.log(`Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      throw error;
    }
  }
}

// ─── FILE UTILITIES ───────────────────────────────────────────────────────────

function shouldEmbedFile(filePath) {
  const skipExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.pdf',
    '.zip', '.tar', '.gz', '.exe', '.dll', '.bin', '.so', '.dylib'];
  const skipDirs = ['.git', 'node_modules', '.vscode', '.idea', 'target',
    'build', 'dist', 'bin', '__pycache__'];

  for (const skipDir of skipDirs) {
    if (filePath.includes(`${path.sep}${skipDir}${path.sep}`) ||
        filePath.includes(`${path.sep}${skipDir}`)) {
      return false;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  return !skipExtensions.includes(ext);
}

function getAllFiles(dir, files = []) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (shouldEmbedFile(fullPath)) {
      files.push(fullPath);
    }
  });
  return files;
}

function extractNotebookContent(notebookContent) {
  const notebook = JSON.parse(notebookContent);
  let extractedText = '';

  if (notebook.cells && Array.isArray(notebook.cells)) {
    notebook.cells.forEach((cell, index) => {
      if (cell.cell_type === 'markdown' && cell.source) {
        extractedText += `\n## Markdown Cell ${index + 1}\n`;
        extractedText += Array.isArray(cell.source) ? cell.source.join('') : cell.source;
        extractedText += '\n';
      } else if (cell.cell_type === 'code' && cell.source) {
        extractedText += `\n## Code Cell ${index + 1}\n`;
        extractedText += Array.isArray(cell.source) ? cell.source.join('') : cell.source;
        extractedText += '\n';
      }
    });
  }

  return extractedText.trim();
}

function cleanTextForEmbedding(text) {
  if (!text || typeof text !== 'string') return null;

  let cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  if (cleaned.length < 10 || cleaned.length > 50000) return null;

  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return cleaned;
}

// ─── EMBED FILES ──────────────────────────────────────────────────────────────

async function embedFiles(repoName, repoPath) {
  const COLLECTION_NAME = "your_collection";

  // 1. Ensure collection exists with correct vector size (384 for MiniLM)
  let exists = true;
  try {
    await qdrant.getCollection(COLLECTION_NAME);
    console.log(`Qdrant: Collection '${COLLECTION_NAME}' already exists.`);
  } catch (err) {
    exists = false;
  }

  if (!exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: VECTOR_SIZE, // 384
        distance: "Cosine"
      }
    });
    console.log(`Qdrant: Collection '${COLLECTION_NAME}' created with size ${VECTOR_SIZE}.`);
  }

  try {
    await qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: "repoName",
      field_schema: "keyword"
    });
  } catch (_) {
    console.log("Index already exists. Skipping.");
  }

  // 2. Collect files
  const files = getAllFiles(repoPath);
  console.log(`Found ${files.length} files to embed.`);

  // 3. Embed & collect points
  const points = [];
  for (const filePath of files) {
    let rawContent;
    try {
      rawContent = fs.readFileSync(filePath, "utf8");
    } catch (e) {
      console.log(`Skipping unreadable file: ${filePath}`);
      continue;
    }

    let content = rawContent;
    if (path.extname(filePath).toLowerCase() === '.ipynb') {
      content = extractNotebookContent(rawContent) || rawContent;
    }

    const cleaned = cleanTextForEmbedding(content);
    if (!cleaned) {
      console.log(`Skipping empty/invalid file: ${filePath}`);
      continue;
    }

    try {
      const embedding = await getEmbedding(cleaned);

      if (!Array.isArray(embedding) || embedding.length !== VECTOR_SIZE) {
        console.error(`Invalid embedding for ${filePath}, length=${embedding?.length}`);
        continue;
      }

      points.push({
        vector: embedding,
        payload: {
          repoName,
          filePath: filePath.replace(repoPath + path.sep, ""),
          text: cleaned
        }
      });

      console.log(`Embedded: ${path.basename(filePath)}`);
    } catch (embedErr) {
      console.error(`Failed to embed ${filePath}: ${embedErr.message}`);
    }
  }

  // 4. Upload to Qdrant
  if (points.length === 0) {
    console.warn("No valid embeddings to upload.");
    return { totalFiles: files.length, embeddedFiles: 0 };
  }

  console.log(`Uploading ${points.length} embeddings to Qdrant...`);

  const baseId = Date.now();
  await qdrant.upsert(COLLECTION_NAME, {
    wait: true,
    points: points.map((p, idx) => ({
      id: baseId + idx,
      vector: p.vector,
      payload: p.payload
    }))
  });

  console.log(`Embedding upload complete.`);
  return { totalFiles: files.length, embeddedFiles: points.length };
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

app.get('/api/repos', async (req, res) => {
  try {
    const clonedReposPath = path.join(__dirname, 'cloned_repos');

    if (!fs.existsSync(clonedReposPath)) {
      return res.json({ repos: [] });
    }

    const repos = [];
    const repoNames = fs.readdirSync(clonedReposPath);

    for (const repoName of repoNames) {
      const repoPath = path.join(clonedReposPath, repoName);
      if (fs.statSync(repoPath).isDirectory()) {
        const stats = fs.statSync(repoPath);
        repos.push({
          id: repoName,
          name: repoName,
          owner: "unknown",
          full_name: repoName,
          clonedAt: stats.birthtime.toISOString().split('T')[0],
          status: "active",
          path: repoPath
        });
      }
    }

    repos.sort((a, b) => new Date(b.clonedAt) - new Date(a.clonedAt));
    res.json({ repos });
  } catch (error) {
    console.error('Error fetching repos:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

app.post('/api/search', async (req, res) => {
  const { query, limit = 10, repoName = null } = req.body;

  if (!query) {
    return res.status(400).json({ message: "Query is required" });
  }

  const COLLECTION_NAME = "your_collection";
  const queryVector = await getEmbedding(query);

  if (!queryVector) {
    return res.status(500).json({ message: "Failed to get query embedding" });
  }

  let filter = {};
  if (repoName) {
    filter = { must: [{ key: "repoName", match: { value: repoName } }] };
  }

  try {
    await qdrant.createPayloadIndex(COLLECTION_NAME, { field_name: "repoName", field_schema: "keyword" });
  } catch (_) {}

  const searchResults = await qdrant.search(COLLECTION_NAME, {
    vector: queryVector,
    limit: limit,
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    with_payload: true,
    with_vector: false
  });

  res.json({
    query: query,
    results: searchResults.map(result => ({
      score: result.score,
      filePath: result.payload.filePath,
      repoName: result.payload.repoName,
      text: result.payload.text
    }))
  });
});

app.post('/api/clone', async (req, res) => {
  const { repoUrl } = req.body;
  if (!repoUrl || typeof repoUrl !== "string") {
    return res.status(400).json({ message: "Invalid repo URL." });
  }

  const repoName = repoUrl.split("/").pop()?.replace(".git", "") || "repo";
  const targetDir = path.join(__dirname, "cloned_repos", repoName);

  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });

  const git = simpleGit();
  try {
    let effectiveRepoUrl = repoUrl;
    const gitToken = process.env.GIT_AUTH_TOKEN;
    if (gitToken && repoUrl.startsWith('https://')) {
      const encoded = encodeURIComponent(gitToken.trim());
      effectiveRepoUrl = repoUrl.replace('https://', `https://${encoded}@`);
    }

    await git.clone(effectiveRepoUrl, targetDir);
    console.log(`Repository cloned to: ${targetDir}`);

    res.json({
      message: `Repo cloned. Embedding running in background.`,
      repoName,
      targetDir
    });

    (async () => {
      try {
        const embedResult = await embedFiles(repoName, targetDir);
        console.log(`✅ Background embedding complete for: ${repoName}`, embedResult);
      } catch (embedErr) {
        console.error(`❌ Background embedding failed for: ${repoName}`, embedErr.message);
      }
    })();
  } catch (err) {
    console.error('Clone error:', err.message);
    return res.status(500).json({
      message: 'Failed to clone repository',
      error: err.message
    });
  }
});

app.post('/api/embed', async (req, res) => {
  const { repoName } = req.body;
  if (!repoName) {
    return res.status(400).json({ message: "Repository name is required" });
  }

  const repoPath = path.join(__dirname, "cloned_repos", repoName);
  if (!fs.existsSync(repoPath)) {
    return res.status(404).json({ message: `Repository ${repoName} not found` });
  }

  const embedResult = await embedFiles(repoName, repoPath);
  res.json({ message: "Embeddings stored successfully", embedStats: embedResult });
});

app.get('/api/test-qdrant', async (req, res) => {
  const collections = await qdrant.getCollections();
  res.json({
    status: 'Connected to Qdrant successfully',
    collections: collections.collections,
    qdrantUrl: QDRANT_URL
  });
});

app.get('/api/collection-info', async (req, res) => {
  const collectionName = 'your_collection';
  const info = await qdrant.getCollection(collectionName);
  const count = await qdrant.count(collectionName);
  res.json({ collection: collectionName, info, pointCount: count.count });
});

app.get('/api/collection-info/:collectionName', async (req, res) => {
  const collectionName = req.params.collectionName;
  const info = await qdrant.getCollection(collectionName);
  const count = await qdrant.count(collectionName);
  res.json({ collection: collectionName, info, pointCount: count.count });
});

app.post('/api/test-embedding', async (req, res) => {
  const { text = "Hello world, this is a test." } = req.body;
  const vector = await getEmbedding(text);
  res.json({
    success: true,
    textLength: text.length,
    vectorLength: vector?.length || 0,
    vectorSample: vector?.slice(0, 5),
    provider: 'HuggingFace sentence-transformers/all-MiniLM-L6-v2'
  });
});

app.get('/api/test-embedding-status', async (req, res) => {
  const testVector = await getEmbedding("This is a test message for embeddings");
  res.json({
    status: 'Embedding API is working',
    vectorLength: testVector.length,
    vectorSample: testVector.slice(0, 5),
    model: HF_MODEL
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

app.post('/api/solve-issue', async (req, res) => {
  try {
    const { issue, repoName = null, topK = 5 } = req.body;

    if (!issue) {
      return res.status(400).json({ message: "Issue description is required" });
    }
    if (typeof issue !== 'string') {
      return res.status(400).json({ message: "Issue description must be a string" });
    }

    const issueContent = issue.trim();
    if (!issueContent) {
      return res.status(400).json({ message: "Issue description cannot be empty" });
    }
    if (issueContent.length > 5000) {
      return res.status(400).json({ message: "Issue too long (max 5000 chars)" });
    }

    const COLLECTION_NAME = "your_collection";

    let issueVector;
    try {
      issueVector = await getEmbedding(issueContent);
    } catch (embeddingError) {
      console.error('Embedding error:', embeddingError.message);
      return res.status(500).json({
        message: "Failed to process issue with embedding service",
        error: embeddingError.message
      });
    }

    if (!issueVector || !Array.isArray(issueVector) || issueVector.length === 0) {
      return res.status(500).json({ message: "Failed to get embedding for issue" });
    }

    let filter = {};
    if (repoName && typeof repoName === 'string' && repoName.trim()) {
      filter = { must: [{ key: "repoName", match: { value: repoName.trim() } }] };
    }

    try {
      await qdrant.getCollection(COLLECTION_NAME);
    } catch {
      return res.status(404).json({
        message: "No repositories cloned yet. Please clone a repository first.",
        hint: "Use /api/clone to clone a repo"
      });
    }

    try {
      await qdrant.createPayloadIndex(COLLECTION_NAME, { field_name: "repoName", field_schema: "keyword" });
    } catch (_) {}

    let searchResults = [];
    try {
      searchResults = await qdrant.search(COLLECTION_NAME, {
        vector: issueVector,
        limit: topK,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        with_payload: true,
        with_vector: false
      });
    } catch (searchError) {
      return res.status(500).json({ message: "Error searching context", error: searchError.message });
    }

    if (searchResults.length === 0) {
      return res.status(404).json({
        message: "No relevant context found. Try cloning a relevant repository.",
      });
    }

    const topChunks = searchResults
      .map(r => r.payload?.text || r.payload?.chunkText || "")
      .filter(Boolean)
      .join("\n\n---\n\n");

    const solutionResponse = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an expert developer. Help solve coding issues based on provided context."
        },
        {
          role: "user",
          content: `Issue:\n\n"${issueContent}"\n\nRelevant context:\n\n${topChunks}\n\nProvide a concise, helpful solution.`
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
      max_tokens: 1024
    });

    const responseText = solutionResponse.choices[0]?.message?.content;

    res.json({
      issue: issueContent,
      solution: responseText?.trim() || "No solution generated.",
      contextUsed: searchResults.map(r => ({
        score: r.score,
        filePath: r.payload.filePath,
        text: r.payload.text?.substring(0, 200)
      }))
    });
  } catch (error) {
    console.error('Error in /api/solve-issue:', error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

app.post('/send-email', async (req, res) => {
  const { name, email, message } = req.body;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: email,
    to: process.env.GMAIL_USER,
    subject: `New Contact Form Message from ${name}`,
    text: `Email: ${email}\n\nMessage:\n${message}`
  });

  res.status(200).json({ message: 'Message sent successfully' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err?.stack || err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: 'Internal server error', error: err?.message || String(err) });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});