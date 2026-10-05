export function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className="space-y-1">
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${clamped}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{clamped}%</p>
    </div>
  )
}
