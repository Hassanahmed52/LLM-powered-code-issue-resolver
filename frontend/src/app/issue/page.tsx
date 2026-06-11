"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5001";

export default function Issue() {
    const [issue, setIssue] = useState("");
    const [error, setError] = useState("");
    const [repoName, setRepoName] = useState("");
    const [repos, setRepos] = useState<Array<{ id: string | number; name: string }>>([]);
    const [loadingRepos, setLoadingRepos] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const router = useRouter();
    const topK = 5;

    useEffect(() => {
        const fetchRepos = async () => {
            setLoadingRepos(true);
            try {
                const response = await fetch(`${apiBase}/api/repos`);
                if (!response.ok) {
                    throw new Error(`Failed to load repos: ${response.status}`);
                }
                const data = await response.json();
                setRepos(data.repos || []);
            } catch (err: any) {
                console.error("Error fetching repos:", err);
            } finally {
                setLoadingRepos(false);
            }
        };

        fetchRepos();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setIssue(value);

        if (value.length === 0) {
            setError("Issue description cannot be empty.");
            return;
        }

        if (value.length > 100) {
            setError("Issue description must be less than 100 characters.");
            return;
        }

        setError("");
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!issue.trim()) {
            setError("Issue description cannot be empty.");
            return;
        }
        if (!repoName.trim()) {
            setError("Please select or enter a repository name.");
            return;
        }

        setError("");
        setSubmitting(true);

        try {
            const response = await axios.post(`${apiBase}/api/solve-issue`, { issue, repoName, topK });
            localStorage.setItem("solutionData", JSON.stringify(response.data));
            router.push("/solution");
        } catch (err: any) {
            console.error("Issue submission error:", err);
            const message = err?.response?.data?.message || err?.message || "Failed to submit the issue. Please try again.";
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-[#0a0a0a] to-[#23272f] flex flex-col items-center justify-center px-4 py-12">
            <div className="max-w-md w-full bg-[#181c23] rounded-2xl shadow-xl border border-[#23272f] p-8 space-y-6">
                <h1 className="text-2xl md:text-3xl font-extrabold text-white text-center mb-2">
                    Report an Issue
                </h1>
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    {error && <div className="text-red-400 text-center text-sm">{error}</div>}
                    <div>
                        <label className="block text-gray-200 font-medium mb-1" htmlFor="issue">Issue</label>
                        <input
                            id="issue"
                            type="text"
                            name="issue"
                            value={issue}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2 rounded-lg bg-[#23272f] border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Describe your issue in one sentence"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-200 font-medium mb-1" htmlFor="repoName">Repository Name</label>
                        {repos.length > 0 ? (
                            <select
                                id="repoName"
                                name="repoName"
                                value={repoName}
                                onChange={(e) => setRepoName(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg bg-[#23272f] border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Select a cloned repository</option>
                                {repos.map((repo) => (
                                    <option key={repo.id} value={repo.name}>{repo.name}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                id="repoName"
                                type="text"
                                name="repoName"
                                value={repoName}
                                onChange={(e) => setRepoName(e.target.value)}
                                required
                                className="w-full px-4 py-2 rounded-lg bg-[#23272f] border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder={loadingRepos ? "Loading repo list..." : "Enter repository name"}
                            />
                        )}
                        {repos.length === 0 && !loadingRepos && (
                            <p className="mt-2 text-xs text-gray-400">No cloned repositories found. Clone one from Connect page first.</p>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                    >
                        {submitting ? "Submitting..." : "Submit Issue"}
                    </button>
                </form>
                <p className="text-gray-400 text-sm text-center mt-4">
                    By submitting an issue, you agree to our <Link href="/terms" className="text-blue-500 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-blue-500 hover:underline">Privacy Policy</Link>.
                </p>
            </div>
        </main>
    );
}
