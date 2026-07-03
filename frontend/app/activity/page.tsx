"use client";

import { useEffect, useState } from "react";
import AuthedLayout from "@/components/AuthedLayout";
import Card from "@/components/ui/Card";
import { ActivityItem, listActivity } from "@/lib/api";

const ACTION_LABELS: Record<string, string> = {
  upload_dataset: "Dataset",
  upload_model: "Model",
  train_model: "Training",
  predict: "Prediction",
  delete_dataset: "Delete",
  delete_model: "Delete",
  update_profile: "Profile",
};

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    listActivity(1).then((res) => setItems(res.items)).catch(() => {});
  }, []);

  return (
    <AuthedLayout>
      <h1 className="font-display text-2xl font-semibold mb-6">Activity</h1>

      <Card>
        {items.length === 0 ? (
          <p className="text-sm text-muted">No activity yet.</p>
        ) : (
          <div className="relative pl-4 border-l border-border space-y-4">
            {items.map((a) => (
              <div key={a.id} className="relative">
                <span className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-accent" />
                <div className="flex justify-between text-sm">
                  <span>
                    <span className="text-xs font-mono text-muted mr-2">{ACTION_LABELS[a.action] || a.action}</span>
                    {a.description}
                  </span>
                  <span className="text-xs text-muted">{new Date(a.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AuthedLayout>
  );
}
