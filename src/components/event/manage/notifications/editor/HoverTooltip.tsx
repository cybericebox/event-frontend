"use client"

import { useEffect, useId, useState, type ReactElement } from "react"
import { createPortal } from "react-dom"
import { EventTooltip } from "@/components/ui/EventTooltip"

/** The admin editor's tooltip wrapper, on the event tooltip. */
export function HoverTooltip({ text, children, className, delegate, textForTarget }: { text: string; children: ReactElement; className?: string; describe?: boolean; truncated?: boolean; delegate?: string; textForTarget?: (target: HTMLElement) => string }) {
  if (delegate) return <DelegatedTooltip selector={delegate} textForTarget={textForTarget ?? (() => text)}>{children}</DelegatedTooltip>
  return <EventTooltip content={text} className={className} silent>{() => children}</EventTooltip>
}

// Pills are DOM owned by contentEditable. The shared tooltip stays outside the
// serialized editor; delegation also covers newly typed and pasted pills.
function DelegatedTooltip({selector, textForTarget, children}: {selector: string; textForTarget: (target: HTMLElement) => string; children: ReactElement}) {
  const id = useId()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [point, setPoint] = useState({left: 0, top: 0})
  const match = (node: EventTarget | null) => node instanceof Element ? node.closest<HTMLElement>(selector) : null
  function open(next: HTMLElement | null) {
    if (!next) { setTarget(null); return }
    const box = next.getBoundingClientRect()
    setPoint({left: Math.max(12, Math.min(box.left, window.innerWidth - Math.min(280, window.innerWidth - 24) - 12)), top: Math.min(window.innerHeight - 100, box.bottom + 6)})
    setTarget(next)
  }
  useEffect(() => {
    if (!target) return
    target.setAttribute("aria-describedby", id)
    const dismiss = () => setTarget(null)
    const outside = (event: PointerEvent) => {if (!target.contains(event.target as Node)) dismiss()}
    window.addEventListener("scroll", dismiss, true)
    window.addEventListener("resize", dismiss)
    document.addEventListener("pointerdown", outside)
    return () => {
      target.removeAttribute("aria-describedby")
      window.removeEventListener("scroll", dismiss, true)
      window.removeEventListener("resize", dismiss)
      document.removeEventListener("pointerdown", outside)
    }
  }, [target, id])
  return <span className="event-variable-tooltip" onPointerOver={event => open(match(event.target))}
    onPointerOut={event => {if (match(event.relatedTarget) !== target && document.activeElement !== target) open(null)}}
    onFocusCapture={event => open(match(event.target))} onBlurCapture={event => {if (!match(event.relatedTarget)) open(null)}}
    onClick={event => {const next = match(event.target); if (next) open(next)}}
    onKeyDown={event => {
      if (event.key === "Escape" && target) {event.preventDefault(); event.stopPropagation(); open(null)}
      else if ((event.key === "Enter" || event.key === " ") && match(event.target)) {event.preventDefault(); open(match(event.target))}
    }}>
    {children}
    {target && createPortal(<span className="ib-tip is-open event-variable-tooltip__portal"><span className="ib-tip__bubble" id={id} role="tooltip" style={{position: "fixed", left: point.left, top: point.top, bottom: "auto", transform: "none"}}>{textForTarget(target)}</span></span>, document.body)}
  </span>
}
