"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5001";

export default function ConnectPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Cloning...");
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;

      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        // If server returned HTML (like an error page), read text to avoid JSON parse error
        const text = await res.text();
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 500)}`);
      }

      if (!res.ok) {
        throw new Error(data.error || data.message || `HTTP ${res.status}`);
      }

      setStatus("✅ " + (data.message || "Repo cloned successfully!"));
      // Redirect to issue page after 2 seconds
      setTimeout(() => {
        router.push("/issue");
      }, 2000);
    } catch (err: any) {
      setStatus(`❌ Failed cloning repo: ${err?.message || "Unknown error"}`);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900">
      <form onSubmit={handleSubmit} className="bg-gray-800 p-8 rounded-xl shadow-md flex flex-col gap-6 items-center">
        <h1 className="text-2xl font-bold text-white">Clone a GitHub Repo</h1>
        <input
          type="text"
          value={repoUrl}
          onChange={e => setRepoUrl(e.target.value)}
          placeholder="Enter GitHub repo URL"
          className="px-4 py-2 rounded w-80 bg-gray-900 text-white border border-gray-700"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold"
        >
          {loading ? "Cloning..." : "Clone Repo"}
        </button>
        {status && <div className="text-white">{status}</div>}
      </form>
    </main>
  );
}