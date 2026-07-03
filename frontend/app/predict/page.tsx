"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import AuthedLayout from "@/components/AuthedLayout";
import Card from "@/components/ui/Card";
import { MLModel, listModels, predict, getPredictionHistory, getExportUrl } from "@/lib/api";

export default function PredictPage() {
  const [models, setModels] = useState<MLModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [inputJson, setInputJson] = useState('{\n  "feature_1": 0,\n  "feature_2": 0\n}');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    listModels(1).then((res) => setModels(res.items)).catch(() => {});
  }, []);

  useEffect(() => {
    if (modelId) loadHistory();
  }, [modelId]);

  async function loadHistory() {
    const res = await getPredictionHistory(modelId);
    setHistory(res.items);
  }

  async function handlePredict() {
    setError(null);
    setResult(null);
    try {
      const parsed = JSON.parse(inputJson);
      setLoading(true);
      const res = await predict(modelId, parsed);
      setResult(res);
      loadHistory();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Prediction failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthedLayout>
      <h1 className="font-display text-2xl font-semibold mb-6">Prediction Playground</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Run a prediction">
          <div className="space-y-3">
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">Select a model…</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name} v{m.version} — {m.task_type}</option>
              ))}
            </select>

            <textarea
              value={inputJson}
              onChange={(e) => setInputJson(e.target.value)}
              rows={6}
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm font-mono outline-none focus:border-accent"
            />

            {error && <p className="text-danger text-sm">{error}</p>}

            <button
              onClick={handlePredict}
              disabled={!modelId || loading}
              className="w-full bg-accent text-white font-medium rounded-md py-2 text-sm hover:opacity-90 transition disabled:opacity-40"
            >
              {loading ? "Running inference…" : "Run prediction"}
            </button>

            {result && (
              <div className="border border-border rounded-md p-3 text-sm font-mono space-y-1">
                <div className="flex justify-between text-xs text-muted">
                  <span>{result.cache_hit ? "cache hit" : "cache miss"}</span>
                  <span>{result.latency_ms}ms</span>
                </div>
                <pre className="text-accent whitespace-pre-wrap break-words">
                  {JSON.stringify(result.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-mono text-xs text-muted uppercase tracking-widest">Prediction history</h2>
            {modelId && (
              <a href={getExportUrl(modelId)} className="flex items-center gap-1 text-xs text-accent hover:underline">
                <Download size={12} /> Export CSV
              </a>
            )}
          </div>

          {!modelId ? (
            <p className="text-sm text-muted">Select a model to see its prediction history.</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted">No predictions yet for this model.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-auto">
              {history.map((h) => (
                <div key={h.id} className="border border-border rounded-md p-2 text-xs font-mono">
                  <div className="flex justify-between text-muted mb-1">
                    <span>{new Date(h.created_at).toLocaleString()}</span>
                    <span>{h.latency_ms?.toFixed(1)}ms {h.cache_hit && "· cached"}</span>
                  </div>
                  <div className="text-text">→ {JSON.stringify(h.output?.prediction)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AuthedLayout>
  );
}
