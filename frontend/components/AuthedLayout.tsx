"use client";

import { useEffect, useState } from "react";
import AuthGate from "./AuthGate";
import DashboardShell from "./layout/DashboardShell";

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setAuthed(!!localStorage.getItem("access_token"));
    setChecked(true);
  }, []);

  function handleLogout() {
    localStorage.removeItem("access_token");
    setAuthed(false);
  }

  if (!checked) return null;
  if (!authed) return <AuthGate onAuthed={() => setAuthed(true)} />;

  return <DashboardShell onLogout={handleLogout}>{children}</DashboardShell>;
}
