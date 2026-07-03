import clsx from "clsx";

export default function Card({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div className={clsx("bg-card border border-border rounded-lg p-5", className)}>
      {title && <h2 className="font-mono text-xs text-muted uppercase tracking-widest mb-4">{title}</h2>}
      {children}
    </div>
  );
}
