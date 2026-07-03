"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import AuthedLayout from "@/components/AuthedLayout";
import Card from "@/components/ui/Card";
import { listModels, listDatasets, getModelUsage, getPredictionsPerDay } from "@/lib/api";

export default function AnalyticsPage() {
  const [modelCount, setModelCount] = useState(0);
  const [datasetCount, setDatasetCount] = useState(0);
  const [usage, setUsage] = useState<{ model_name: string; prediction_count: number }[]>([]);
  const [perDay, setPerDay] = useState<{ date: string; count: number }[]>([]);

  useEffect(() => {
    Promise.all([listModels(1), listDatasets(1), getModelUsage(), getPredictionsPerDay(30)])
      .then(([m, d, u, p]) => {
        setModelCount(m.total);
        setDatasetCount(d.total);
        setUsage(u);
        setPerDay(p);
      })
      .catch(() => {});
  }, []);

  return (
    <AuthedLayout>
      <h1 className="font-display text-2xl font-semibold mb-6">Analytics</h1>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card>
          <div className="text-xs text-muted font-mono uppercase tracking-widest mb-2">Model uploads</div>
          <div className="text-2xl font-display font-semibold">{modelCount}</div>
        </Card>
        <Card>
          <div className="text-xs text-muted font-mono uppercase tracking-widest mb-2">Dataset uploads</div>
          <div className="text-2xl font-display font-semibold">{datasetCount}</div>
        </Card>
      </div>

      <Card title="Predictions (last 30 days)" className="mb-4">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={perDay}>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.4} />
            <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.4} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "rgb(var(--color-card))", border: "1px solid rgb(var(--color-border))", fontSize: 12 }} />
            <Bar dataKey="count" fill="rgb(var(--color-accent))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Model usage breakdown">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={usage} layout="vertical">
            <XAxis type="number" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.4} allowDecimals={false} />
            <YAxis type="category" dataKey="model_name" tick={{ fontSize: 11 }} width={100} stroke="currentColor" opacity={0.4} />
            <Tooltip contentStyle={{ background: "rgb(var(--color-card))", border: "1px solid rgb(var(--color-border))", fontSize: 12 }} />
            <Bar dataKey="prediction_count" fill="rgb(var(--color-accent2))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </AuthedLayout>
  );
}
