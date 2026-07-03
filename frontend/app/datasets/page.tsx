"use client";

import { useEffect, useState } from "react";
import { Trash2, Eye, Upload } from "lucide-react";
import AuthedLayout from "@/components/AuthedLayout";
import Card from "@/components/ui/Card";
import { Dataset, listDatasets, uploadDataset, deleteDataset, previewDataset } from "@/lib/api";

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [search, setSearch] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [targetColumn, setTargetColumn] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ columns: string[]; rows: any[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    load();
  }, [search]);

  async function load() {
    try {
      const res = await listDatasets(1, search);
      setDatasets(res.items);
    } catch {
      // not authed yet
    }
  }

  async function handleUpload() {
    if (!file || !targetColumn) return;
    setUploading(true);
    setError(null);
    try {
      await uploadDataset(file, targetColumn);
      setFile(null);
      setTargetColumn("");
      load();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteDataset(id);
    load();
  }

  async function handlePreview(id: string) {
    const data = await previewDataset(id);
    setPreview(data);
  }

  return (
    <AuthedLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display text-2xl font-semibold">Datasets</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search datasets…"
          className="bg-card border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:border-accent w-56"
        />
      </div>

      <Card title="Upload dataset" className="mb-6">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) setFile(dropped);
          }}
          className={`flex items-center justify-center border border-dashed rounded-md h-24 mb-3 transition text-sm text-muted ${
            dragOver ? "border-accent bg-accent/5" : "border-border"
          }`}
        >
          <label className="flex flex-col items-center gap-1 cursor-pointer">
            <Upload size={16} />
            <input type="file" accept=".csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file ? file.name : "Drag a CSV here, or click to select"}
          </label>
        </div>

        <div className="flex gap-3">
          <input
            value={targetColumn}
            onChange={(e) => setTargetColumn(e.target.value)}
            placeholder="Target column name"
            className="flex-1 bg-bg border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={handleUpload}
            disabled={!file || !targetColumn || uploading}
            className="bg-accent text-white text-sm font-medium rounded-md px-4 py-2 hover:opacity-90 transition disabled:opacity-40"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
        {error && <p className="text-danger text-sm mt-2">{error}</p>}
      </Card>

      <Card title={`Your datasets (${datasets.length})`}>
        {datasets.length === 0 ? (
          <p className="text-sm text-muted">No datasets yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted uppercase tracking-wider border-b border-border">
                <th className="pb-2">Filename</th>
                <th className="pb-2">Rows</th>
                <th className="pb-2">Target</th>
                <th className="pb-2">Size</th>
                <th className="pb-2">Missing / Dupes</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="py-2">{d.filename}</td>
                  <td className="py-2">{d.n_rows}</td>
                  <td className="py-2 font-mono text-xs">{d.target_column}</td>
                  <td className="py-2">{formatBytes(d.file_size_bytes)}</td>
                  <td className="py-2 text-xs text-muted">{d.missing_value_count} / {d.duplicate_row_count}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => handlePreview(d.id)} className="p-1.5 hover:text-accent transition mr-1">
                      <Eye size={14} />
                    </button>
                    <button onClick={() => handleDelete(d.id)} className="p-1.5 hover:text-danger transition">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {preview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setPreview(null)}>
          <div className="bg-card border border-border rounded-lg p-5 max-w-2xl w-full max-h-[70vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-mono text-xs text-muted uppercase tracking-widest mb-3">Preview</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {preview.columns.map((c) => (
                    <th key={c} className="text-left p-1.5 font-mono">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {preview.columns.map((c) => (
                      <td key={c} className="p-1.5">{String(row[c])}</td>
                    ))}
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
