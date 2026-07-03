"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Search, Sun, Moon, LogOut } from "lucide-react";
import { globalSearch } from "@/lib/api";

const LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/datasets": "Datasets",
  "/models": "Models",
  "/predict": "Playground",
  "/activity": "Activity",
  "/analytics": "Analytics",
};

export default function Topbar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; type: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const data = await globalSearch(query);
        setResults(data.results);
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 150);
    return () => clearTimeout(timeout);
  }, [query]);

  function handleSelect(r: { id: string; type: string }) {
    setOpen(false);
    setQuery("");
    router.push(r.type === "model" ? `/models?highlight=${r.id}` : `/datasets?highlight=${r.id}`);
  }

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-bg sticky top-0 z-10">
      <div className="text-sm text-muted font-mono">
        atlas / <span className="text-text">{LABELS[pathname] || ""}</span>
      </div>

      <div className="flex items-center gap-3">
        <div ref={boxRef} className="relative">
          <div className="flex items-center gap-2 bg-card border border-border rounded-md px-3 py-1.5 w-64">
            <Search size={14} className="text-muted shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query && setOpen(true)}
              placeholder="Search models, datasets…"
              className="bg-transparent text-sm outline-none w-full placeholder:text-muted"
            />
          </div>

          {open && results.length > 0 && (
            <div className="absolute mt-1 w-full bg-card border border-border rounded-md shadow-lg overflow-hidden">
              {results.map((r) => (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => handleSelect(r)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 flex justify-between"
                >
                  <span>{r.name}</span>
                  <span className="text-xs text-muted font-mono">{r.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-md hover:bg-card transition text-muted hover:text-text"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        )}

        <button
          onClick={onLogout}
          className="p-2 rounded-md hover:bg-card transition text-muted hover:text-text"
          aria-label="Log out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
