"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { t } from "@/i18n/t"
import { feedbackHref } from "@/utils/feedback"
import "./feedback-link.css"

// A plain <a href="mailto:…"> that sits in the site footer (or the /manage account menu): it is part of the
// server-rendered / static HTML, so it works without JavaScript. usePathname still renders on the static pass.
// `app` overrides the app name in the subject (event sites pass the event name); `className` and `children`
// let a menu restyle it (icon + label).
export function FeedbackLink({ app, className, children }: { app?: string; className?: string; children?: ReactNode }) {
  const pathname = usePathname() || "/"
  const subject = t("feedback.subject", { app: app ?? t("feedback.app"), page: pathname })
  return (
    <a className={className} href={feedbackHref(subject)} suppressHydrationWarning>
      {children ?? t("feedback.link")}
    </a>
  )
}
