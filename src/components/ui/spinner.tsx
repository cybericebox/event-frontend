import { cn } from "@/utils/cn"
import "./spinner.css"

const SIZE_CLASS = {
  sm: "ice-loader-sm",
  md: "ice-loader-md",
  lg: "ice-loader-lg",
} as const

// Branded isometric ice-cube loader ("ICE Box"): the cube melts into a puddle
// then refreezes on a loop. Size scales off font-size (svg is 1em square);
// color is currentColor (ice-cyan by default, inherited inside buttons).
// `label` is announced to screen readers; without it a generic aria-label is used.
export function Spinner({
  size = "sm",
  label,
  className,
}: {
  size?: "sm" | "md" | "lg"
  label?: string
  className?: string
}) {
  return (
    <span
      role="status"
      aria-label={label ? undefined : "loading"}
      className={cn("ice-loader", SIZE_CLASS[size], className)}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <ellipse className="ice-pud" cx="12" cy="19" rx="7" ry="1.8" fill="currentColor" />
        <path className="ice-side" d="M4 8 L12 12 L12 20 L4 16 Z" fill="currentColor" opacity=".55" />
        <path className="ice-side ice-side-r" d="M20 8 L12 12 L12 20 L20 16 Z" fill="currentColor" opacity=".8" />
        <path className="ice-top" d="M12 4 L20 8 L12 12 L4 8 Z" fill="currentColor" opacity=".95" />
        <path className="ice-shine" d="M12 5.4 L16.5 7.6 L12 9.9 L7.5 7.6 Z" fill="#fff" opacity="0" />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}

// Full-screen centered loader for page-level loading states.
export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <Spinner size="lg" label={label} />
    </div>
  )
}
