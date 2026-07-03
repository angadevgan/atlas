"use client";

import { useEffect, useState } from "react";
import { Star, Trash2, GitBranch, Scale } from "lucide-react";
import AuthedLayout from "@/components/AuthedLayout";
import Card from "@/components/ui/Card";
import {
  MLModel, Dataset, listModels, listDatasets, startTraining, getJobStatus,
  toggleBookmark, deleteModel, getVersionHistory, compareModels, TrainingJobStatus,
} from "@/lib/api";

const ALGORITHMS: Record<string, string[]> = {
  classification: ["random_forest", "logistic_regression"],
  regression: ["random_forest", "linear_regression"],
};

export default function ModelsPage() {
  const [models, setModels] = useState<MLModel[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [search, setSearch] = useState("");
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);

  const [modelName, setModelName] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [taskType, setTaskType] = useState<"classification" | "regression">("classification");
  const [algorithm, setAlgorithm] = useState(ALGORITHMS["classification"][0]);
  const [job, setJob] = useState<TrainingJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [compareData, setCompareData] = useState<MLModel[] | null>(null);
  const [versionsFor, setVersionsFor] = useState<MLModel[] | null>(null);

  useEffect(() => { loadModels(); }, [search, bookmarkedOnly]);
  useEffect(() => { loadDatasets(); }, []);
  useEffect(() => { setAlgorithm(ALGORITHMS[taskType][0]); }, [taskType]);

  async function loadModels() {
    try {
      const res = await listModels(1, search, bookmarkedOnly);
      setModels(res.items);
    } catch { /* not authed yet */ }
  }

  async function loadDatasets() {
    try {
      const res = await listDatasets(1);
      setDatasets(res.items);
    } catch { /* not authed yet */ }
  }

  async function handleTrain() {
    if (!datasetId || !modelName) return;
    setError(null);
    try {
      const { job_id } = await startTraining(datasetId, taskType, algorithm, modelName);
      setJob({ job_id, status: "queued" });

      const poll = setInterval(async () => {
        const status = await getJobStatus(job_id);
        setJob(status);
        if (status.status === "completed" || status.status === "failed") {
          clearInterval(poll);
          if (status.status === "completed") loadModels();
        }
      }, 2000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to start training");
    }
  }

  async function handleBookmark(id: string) {
    await toggleBookmark(id);
    loadModels();
  }

  async function handleDelete(id: string) {
    await deleteModel(id);
    loadModels();
  }

  function toggleCompareSelect(id: string) {
    setSelectedForCompare((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleCompare() {
    if (selectedForCompare.length < 2) return;
    const data = await compareModels(selectedForCompare);
    setCompareData(data);
  }

  async function handleVersions(id: string) {
    const data = await getVersionHistory(id);
    setVersionsFor(data);
  }

  const statusColor = { queued: "text-warn", running: "text-accent", completed: "text-accent2", failed: "text-danger" } as const;

  return (
    <AuthedLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display text-2xl font-semibold">Models</h1>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setBookmarkedOnly((v) => !v)}
            className={`text-xs px-2.5 py-1.5 rounded-md border transition ${bookmarkedOnly ? "bg-accent text-white border-accent" : "border-border text-muted"}`}
          >
            Bookmarked
          </button>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models…"
            className="bg-card border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:border-accent w-56"
          />
        </div>
      </div>

      <Card title="Train a new model" className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <input
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="Model name"
            className="bg-bg border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <select
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
            className="bg-bg border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">Select dataset…</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>{d.filename}</option>
            ))}
          </select>
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value as any)}
            className="bg-bg border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="classification">Classification</option>
            <option value="regression">Regression</option>
          </select>
          <select
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value)}
            className="bg-bg border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {ALGORITHMS[taskType].map((a) => (
              <option key={a} value={a}>{a.replace("_", " ")}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleTrain}
          disabled={!datasetId || !modelName}
          className="bg-accent text-white text-sm font-medium rounded-md px-4 py-2 hover:opacity-90 transition disabled:opacity-40"
        >
          Start training
        </button>

        {error && <p className="text-danger text-sm mt-2">{error}</p>}

        {job && (
          <div className="mt-3 border border-border rounded-md p-3 text-sm font-mono">
            <div className="flex justify-between">
              <span className="text-muted">job {job.job_id.slice(0, 8)}</span>
              <span className={statusColor[job.status]}>{job.status}</span>
            </div>
            {job.error_message && <p className="text-danger text-xs mt-1">{job.error_message}</p>}
          </div>
        )}
      </Card>

      {selectedForCompare.length >= 2 && (
        <button
          onClick={handleCompare}
          className="mb-3 flex items-center gap-1.5 text-sm bg-accent2 text-white px-3 py-1.5 rounded-md hover:opacity-90 transition"
        >
          <Scale size={14} /> Compare {selectedForCompare.length} models
        </button>
      )}

      <Card title={`Your models (${models.length})`}>
        {models.length === 0 ? (
          <p className="text-sm text-muted">No models trained yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted uppercase tracking-wider border-b border-border">
                <th className="pb-2 w-6"></th>
                <th className="pb-2">Name</th>
                <th className="pb-2">Version</th>
                <th className="pb-2">Task</th>
                <th className="pb-2">Metrics</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="py-2">
                    <input type="checkbox" checked={selectedForCompare.includes(m.id)} onChange={() => toggleCompareSelect(m.id)} />
                  </td>
                  <td className="py-2 font-medium">{m.name}</td>
                  <td className="py-2 font-mono text-xs">v{m.version}</td>
                  <td className="py-2 text-xs text-muted">{m.task_type}</td>
                  <td className="py-2 text-xs font-mono">
                    {Object.entries(m.metrics || {}).slice(0, 2).map(([k, v]) => `${k}:${v}`).join("  ")}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button onClick={() => handleVersions(m.id)} className="p-1.5 hover:text-accent transition"><GitBranch size={14} /></button>
                    <button onClick={() => handleBookmark(m.id)} className="p-1.5 hover:text-accent transition">
                      <Star size={14} fill={m.is_bookmarked ? "currentColor" : "none"} />
                    </button>
                    <button onClick={() => handleDelete(m.id)} className="p-1.5 hover:text-danger transition"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {(compareData || versionsFor) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => { setCompareData(null); setVersionsFor(null); }}>
          <div className="bg-card border border-border rounded-lg p-5 max-w-2xl w-full max-h-[70vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-mono text-xs text-muted uppercase tracking-widest mb-3">
              {compareData ? "Model comparison" : "Version history"}
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-1.5">Name</th>
                  <th className="p-1.5">Version</th>
                  <th className="p-1.5">Metrics</th>
                  <th className="p-1.5">Created</th>
                </tr>
              </thead>
              <tbody>
                {(compareData || versionsFor || []).map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="p-1.5">{m.name}</td>
                    <td className="p-1.5 font-mono">v{m.version}</td>
                    <td className="p-1.5 font-mono">{Object.entries(m.metrics || {}).map(([k, v]) => `${k}:${v}`).join(" ")}</td>
                    <td className="p-1.5">{new Date(m.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AuthedLayout>
  );
}
