export function PagePlaceholder({ title }: { title: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        <p className="text-lg font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm">Скоро тут з’явиться вміст</p>
      </div>
    </div>
  )
}
