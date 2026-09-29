"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { t } from "@/i18n/t"
import { NotificationIcon } from "@/components/event/NotificationIcon"
import { ColorPicker } from "./ColorPicker"
import { ManageFieldLabel } from "../../ManageFieldLabel"
import { APPEARANCES, ICONS, toneColor } from "./inAppOptions"
import { HoverTooltip } from "./HoverTooltip"

type Props = {
  icon: string
  tone: string
  accentColor: string
  onChange: (next: { icon: string; tone: string; accentColor: string }) => void
  disabled?: boolean
}

export function NotificationAppearancePicker({ icon, tone, accentColor, onChange, disabled = false }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(Boolean(accentColor))

  return <section className="rounded-lg border border-(--ib-line) bg-(--ib-surface) p-4" aria-label={t("manage.tpl.inapp.appearance")}>
    <div className="mb-3">
      <ManageFieldLabel title={t("manage.tpl.inapp.appearance")} help={`${t("manage.tpl.inapp.appearanceHelp")}\n${t("manage.tpl.inapp.deliveryHint")}`} />
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" role="radiogroup" aria-label={t("manage.tpl.inapp.appearance")}>
      {APPEARANCES.map((option) => <button key={option.tone} type="button" role="radio" aria-checked={tone === option.tone} disabled={disabled}
        onClick={() => onChange({ icon: option.icon, tone: option.tone, accentColor: "" })}
        className={`flex min-w-0 flex-col items-center gap-1.5 rounded-md border px-2 py-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-(--ib-action) disabled:cursor-not-allowed disabled:opacity-60 ${tone === option.tone ? "border-(--ib-action) bg-(--ib-soft) text-(--ib-ink)" : "border-(--ib-line) text-(--ib-dim) hover:bg-(--ib-soft)"}`}>
        <NotificationIcon icon={option.icon} tone={option.tone} accentColor="" compact />
        <span>{t(option.labelKey)}</span>
      </button>)}
    </div>
    <button type="button" onClick={() => setDetailsOpen((value) => !value)} disabled={disabled} aria-expanded={detailsOpen}
      className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-(--ib-dim) hover:text-(--ib-ink) disabled:opacity-60">
      {t("manage.tpl.inapp.appearanceMore")} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
    </button>
    {detailsOpen && <div className="mt-3 space-y-4 border-t border-(--ib-line) pt-4">
      <div>
        <p className="mb-2 text-xs font-medium text-(--ib-ink)">{t("manage.tpl.inapp.icon")}</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("manage.tpl.inapp.icon")}>
          {ICONS.map((option) => <HoverTooltip key={option.value} text={t(option.labelKey)}><button type="button" role="radio" aria-checked={icon === option.value}
            onClick={() => onChange({ icon: option.value, tone, accentColor })} disabled={disabled} aria-label={t(option.labelKey)}
            className={`rounded-md border p-1.5 focus-visible:outline-2 focus-visible:outline-(--ib-action) disabled:opacity-60 ${icon === option.value ? "border-(--ib-action) bg-(--ib-soft)" : "border-(--ib-line) hover:bg-(--ib-soft)"}`}>
            <NotificationIcon icon={option.value} tone={tone} accentColor={accentColor} compact />
          </button></HoverTooltip>)}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-3">
          <ColorPicker label={t("manage.tpl.inapp.accentColor")} help={t("manage.tpl.inapp.accentHelp")} value={accentColor || toneColor(tone)} onChange={(value) => onChange({ icon, tone, accentColor: value })} />
          {accentColor && <button type="button" onClick={() => onChange({ icon, tone, accentColor: "" })} className="text-xs font-medium text-(--ib-action) hover:underline">{t("manage.tpl.inapp.accentClear")}</button>}
        </div>
      </div>
    </div>}
  </section>
}
