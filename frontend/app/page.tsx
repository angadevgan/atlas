"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import AuthedLayout from "@/components/AuthedLayout";
import Card from "@/components/ui/Card";
import { getDashboardSummary, getPredictionsPerDay, getModelUsage } from "@/lib/api";

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const [perDay, setPerDay] = useState<{ date: string; count: number }[]>([]);
  const [usage, setUsage] = useState<{ model_name: string; prediction_count: number }[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [s, p, u] = await Promise.all([
        getDashboardSummary(),
        getPredictionsPerDay(),
        getModelUsage(),
      ]);
      setSummary(s);
      setPerDay(p);
      setUsage(u);
    } catch {
      // not authed yet or empty state — fine
    }
  }

  const stats = summary
    ? [
        { label: "Total models", value: summary.total_models },
        { label: "Total datasets", value: summary.total_datasets },
        { label: "Total predictions", value: summary.total_predictions },
        { label: "Storage used", value: formatBytes(summary.storage_used_bytes) },
      ]
    : [];

  return (
    <AuthedLayout>
      <h1 className="font-display text-2xl font-semibold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <div className="text-xs text-muted font-mono uppercase tracking-widest mb-2">{s.label}</div>
            <div className="text-2xl font-display font-semibold">{s.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card title="Predictions per day">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={perDay}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.4} />
              <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.4} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "rgb(var(--color-card))", border: "1px solid rgb(var(--color-border))", fontSize: 12 }} />
              <Line type="monotone" dataKey="count" stroke="rgb(var(--color-accent))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Model usage">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={usage}>
              <XAxis dataKey="model_name" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.4} />
              <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.4} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "rgb(var(--color-card))", border: "1px solid rgb(var(--color-border))", fontSize: 12 }} />
              <Bar dataKey="prediction_count" fill="rgb(var(--color-accent2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Recent activity">
        {summary?.recent_activity?.length ? (
          <div className="space-y-2">
            {summary.recent_activity.map((a: any, i: number) => (
              <div key={i} className="flex justify-between text-sm border-b border-border last:border-0 pb-2 last:pb-0">
                <span>{a.description}</span>
                <span className="text-muted text-xs">{new Date(a.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No activity yet. Upload a dataset to get started.</p>
        )}
      </Card>
    </AuthedLayout>
  );
}
