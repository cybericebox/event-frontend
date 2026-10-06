"use client"

import { t } from "@/i18n/t"
import { EventSelect } from "@/components/ui/EventSelect"
import { ManageFieldLabel } from "../../ManageFieldLabel"
import type { BlockPreset } from "./emailBlocks"

type Props = {
  presetId: string
  presets: BlockPreset[]
  readOnly: boolean
  onSelect: (id: string) => void
}

/**
 * The closing block of the email: one of the shared footer presets, or none.
 * Presets are created by the platform; an Event only picks one. The fixed
 * platform footer (sender, support, privacy) is appended when the email is
 * sent and is part of the preview.
 */
export function EmailFooterEditor({ presetId, presets, readOnly, onSelect }: Props) {
  return <section className="rounded-lg border border-(--ib-line) bg-(--ib-surface) p-4">
    <ManageFieldLabel title={t("manage.tpl.editor.footer")} help={t("manage.tpl.editor.footerHelp")} />
    <div className="mt-2">
      <EventSelect value={presetId} onValueChange={onSelect} ariaLabel={t("manage.tpl.editor.footerSelect")} disabled={readOnly}
        options={[{ value: "", label: t("manage.tpl.editor.footerNone") }, ...presets.map((preset) => ({ value: preset.ID, label: preset.Name }))]} />
    </div>
  </section>
}
