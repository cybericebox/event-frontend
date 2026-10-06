"use client";

/**
 * BlockEditor.tsx — email body block editor (the admin editor, for one Event).
 *
 * STABLE KEYS: each block gets a UUID stored alongside the controlled value.
 * All mutations (add / delete / reorder) update the keys together with
 * `onChange`, so keys are NEVER derived from content or array index and
 * reordering preserves the mounted RichTextEditor state (Lexical is
 * mount-initialised / uncontrolled after mount).
 *
 * Presets are shared by the platform: an Event only inserts them. Images are
 * uploaded to the Event's draft (`onUploadImage` resolves to the file id).
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronUp, ChevronDown, Trash2, Upload } from "lucide-react";

import { cn } from "@/utils/cn";
import { t, tPlural } from "@/i18n/t";
import { EventButton } from "@/components/ui/EventButton";
import { EventSelect } from "@/components/ui/EventSelect";
import { ManageFieldLabel } from "../../ManageFieldLabel";
import { RichTextEditor } from "./RichTextEditor";
import { defaultBlockForType } from "./emailBlocks";
import type { BlockPreset, ButtonBlock, EmailBodyBlock, ImageBlock, LogoBlock, PresetBlock } from "./emailBlocks";
import type { VariableDef } from "./variableUtils";

export type BlockEditorProps = {
  value: EmailBodyBlock[];
  onChange: (blocks: EmailBodyBlock[]) => void;
  variables?: VariableDef[];
  presets: BlockPreset[];
  /** Uploads an image to the Event's draft and resolves to the file id. */
  onUploadImage: (file: File) => Promise<string>;
  imageURL: (fileID: string) => string;
  disabled?: boolean;
  /** Block types the editor does not offer (a broadcast has no draft to upload images to). */
  hiddenBlocks?: Array<EmailBodyBlock["type"]>;
};

const BLOCK_LABEL_KEYS: Record<EmailBodyBlock["type"], string> = {
  rich_text: "manage.tpl.editor.block.richText",
  button: "manage.tpl.editor.block.button",
  image: "manage.tpl.editor.block.image",
  divider: "manage.tpl.editor.block.divider",
  preset: "manage.tpl.editor.block.preset",
  logo: "manage.tpl.editor.block.logo",
};

const ADD_BLOCK_ARIA_KEYS: Record<EmailBodyBlock["type"], string> = {
  rich_text: "manage.tpl.editor.addTextBlock",
  button: "manage.tpl.editor.addButtonBlock",
  image: "manage.tpl.editor.addImageBlock",
  divider: "manage.tpl.editor.addDividerBlock",
  preset: "manage.tpl.editor.block.preset",
  logo: "manage.tpl.editor.addLogoBlock",
};

const BLOCK_PILL_STYLES: Record<EmailBodyBlock["type"], string> = {
  rich_text: "bg-(--ib-soft) text-(--ib-action)",
  button: "bg-(--ib-soft) text-(--ib-ink)",
  image: "bg-(--ib-soft) text-(--ib-dim)",
  divider: "bg-(--ib-soft) text-(--ib-dim)",
  preset: "bg-(--ib-soft) text-(--ib-action)",
  logo: "bg-(--ib-soft) text-(--ib-dim)",
};

const ADD_BLOCK_TYPES: Array<EmailBodyBlock["type"]> = ["rich_text", "button", "image", "divider", "logo"];

const ALIGNS = ["left", "center", "right"] as const;

function newKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function BlockEditor({ value, onChange, variables, presets, onUploadImage, imageURL, disabled = false, hiddenBlocks = [] }: BlockEditorProps) {
  // Keys follow internal add/remove/reorder operations. For a parent-initiated
  // length change, adjust them before rendering children so mounted editors keep
  // their identity and no ref is read or mutated during render.
  const [keyState, setKeyState] = useState(() => ({ value, keys: value.map(newKey) }));
  if (keyState.value !== value) {
    setKeyState({ value, keys: value.map((_, index) => keyState.keys[index] ?? newKey()) });
  }

  // "Latest" refs for the async upload continuation: a completion that runs
  // after a reorder / delete reads the CURRENT value and keys, never a stale
  // snapshot from when the upload started.
  const latestValueRef = useRef(value);
  const latestKeysRef = useRef(keyState.keys);
  useEffect(() => {
    latestValueRef.current = value;
    latestKeysRef.current = keyState.keys;
  });

  const [uploadState, setUploadState] = useState<Record<string, { uploading: boolean; error: string | null }>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleImageUpload = async (key: string, file: File) => {
    setUploadState((prev) => ({ ...prev, [key]: { uploading: true, error: null } }));
    try {
      const fileID = await onUploadImage(file);
      const idx = latestKeysRef.current.indexOf(key);
      const current = idx === -1 ? undefined : latestValueRef.current[idx];
      // Block gone (removed while uploading) or no longer an image block: drop
      // the result rather than write it somewhere wrong.
      if (current && current.type === "image") {
        onChange(latestValueRef.current.map((b, i) => (i === idx ? { ...current, file_id: fileID, url: undefined } : b)));
      }
      setUploadState((prev) => ({ ...prev, [key]: { uploading: false, error: null } }));
    } catch {
      setUploadState((prev) => ({ ...prev, [key]: { uploading: false, error: t("manage.email.imageError") } }));
    }
  };

  const addBlock = (type: EmailBodyBlock["type"]) => {
    const next = [...value, defaultBlockForType(type)];
    setKeyState({ value: next, keys: [...keyState.keys, newKey()] });
    onChange(next);
  };

  const addPresetBlock = (preset: BlockPreset) => {
    const block: PresetBlock = { type: "preset", preset_id: preset.ID, name: preset.Name };
    const next = [...value, block];
    setKeyState({ value: next, keys: [...keyState.keys, newKey()] });
    onChange(next);
  };

  const updateBlock = (i: number, updated: EmailBodyBlock) => onChange(value.map((b, idx) => (idx === i ? updated : b)));

  const removeBlock = (i: number) => {
    const next = value.filter((_, idx) => idx !== i);
    setKeyState({ value: next, keys: keyState.keys.filter((_, idx) => idx !== i) });
    onChange(next);
  };

  const moveBlock = (i: number, dir: "up" | "down") => {
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= value.length) return;
    const nextBlocks = [...value];
    const nextKeys = [...keyState.keys];
    [nextBlocks[i], nextBlocks[j]] = [nextBlocks[j], nextBlocks[i]];
    [nextKeys[i], nextKeys[j]] = [nextKeys[j], nextKeys[i]];
    setKeyState({ value: nextBlocks, keys: nextKeys });
    onChange(nextBlocks);
  };

  const alignOptions = ALIGNS.map((align) => ({ value: align, label: t(`manage.tpl.editor.align${align[0].toUpperCase()}${align.slice(1)}`) }));

  return (
    <div className="space-y-3">
      {value.map((block, i) => {
        const stableKey = keyState.keys[i];
        return (
          <div key={stableKey} data-testid="block-item" className="group rounded-xl border border-(--ib-line) bg-(--ib-surface) p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex-1">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", BLOCK_PILL_STYLES[block.type] ?? "bg-(--ib-soft) text-(--ib-dim)")}>
                  {t(BLOCK_LABEL_KEYS[block.type] ?? block.type)}
                </span>
              </div>
              {!disabled && (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => moveBlock(i, "up")} disabled={i === 0} aria-label={t("manage.tpl.editor.moveBlockUp")}
                    className="rounded-lg p-1.5 transition-colors hover:bg-(--ib-soft) disabled:opacity-30">
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => moveBlock(i, "down")} disabled={i === value.length - 1} aria-label={t("manage.tpl.editor.moveBlockDown")}
                    className="rounded-lg p-1.5 transition-colors hover:bg-(--ib-soft) disabled:opacity-30">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => removeBlock(i)} aria-label={t("manage.tpl.editor.removeBlock")}
                    className="rounded-lg p-1.5 text-(--ib-dim) transition-colors hover:bg-(--ib-danger-bg) hover:text-(--ib-danger)">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {block.type === "rich_text" && (
              <RichTextEditor
                showVariableNames
                className="[&_[data-notif-variable]]:border-[var(--ib-warn)] [&_[data-notif-variable]]:bg-[var(--ib-warn-bg)] [&_[data-notif-variable]]:text-[var(--ib-ink)]"
                disabled={disabled}
                value={block.content}
                onChange={(state) => updateBlock(i, { ...block, content: state as typeof block.content })}
                variables={variables}
                placeholder={t("manage.tpl.editor.richTextPlaceholder")}
              />
            )}

            {block.type === "button" && (
              <div className="space-y-3">
                <div className="event-manage-field">
                  <ManageFieldLabel title={t("manage.email.blocks.buttonText")} help={t("manage.email.blocks.buttonTextHelp")} htmlFor={`event-block-${stableKey}-label`} required />
                  <input id={`event-block-${stableKey}-label`} className="event-manage-input" disabled={disabled} value={(block as ButtonBlock).label}
                    onChange={(e) => updateBlock(i, { ...(block as ButtonBlock), label: e.target.value })} placeholder={t("manage.tpl.editor.buttonLabelPlaceholder")} />
                </div>
                <div className="event-manage-field">
                  <ManageFieldLabel title={t("manage.email.blocks.link")} help={t("manage.email.blocks.linkHelp")} htmlFor={`event-block-${stableKey}-url`} required />
                  <input id={`event-block-${stableKey}-url`} className="event-manage-input" disabled={disabled} value={(block as ButtonBlock).url}
                    onChange={(e) => updateBlock(i, { ...(block as ButtonBlock), url: e.target.value })} placeholder="https://…" />
                </div>
                <div className="event-manage-field">
                  <ManageFieldLabel title={t("manage.tpl.editor.alignment")} help={t("manage.email.blocks.buttonAlignHelp")} />
                  <EventSelect ariaLabel={t("manage.tpl.editor.alignment")} disabled={disabled} value={(block as ButtonBlock).align ?? "center"} options={alignOptions}
                    onValueChange={(next) => updateBlock(i, { ...(block as ButtonBlock), align: next as ButtonBlock["align"] })} />
                </div>
              </div>
            )}

            {block.type === "divider" && <div className="my-1 border-t border-(--ib-line)" aria-hidden />}

            {block.type === "image" && (
              <div className="space-y-3">
                {/* A plain URL or an uploaded file: the two are mutually exclusive. */}
                <div className="event-manage-field">
                  <ManageFieldLabel title={t("manage.tpl.editor.imageUrl")} help={t("manage.tpl.editor.imageUrlHelp")} htmlFor={`event-block-${stableKey}-image`} />
                  <input id={`event-block-${stableKey}-image`} className="event-manage-input" disabled={disabled} value={(block as ImageBlock).url ?? ""}
                    onChange={(e) => updateBlock(i, { ...(block as ImageBlock), url: e.target.value, file_id: undefined })} placeholder="https://example.com/image.png" />
                </div>
                <div className="flex items-center gap-2">
                  <input ref={(el) => { fileInputRefs.current[stableKey] = el; }} type="file" accept="image/png,image/jpeg,image/gif" data-testid="image-file-input" className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void handleImageUpload(stableKey, file);
                    }} />
                  <EventButton className="ib-btn ib-btn--sm" busy={uploadState[stableKey]?.uploading} disabled={disabled} onClick={() => fileInputRefs.current[stableKey]?.click()}>
                    {!uploadState[stableKey]?.uploading && <Upload className="h-3.5 w-3.5" />}
                    {t("manage.tpl.editor.uploadImage")}
                  </EventButton>
                  {(block as ImageBlock).file_id && (
                    <Image unoptimized width={40} height={40} src={imageURL((block as ImageBlock).file_id!)} alt="" className="h-10 w-10 rounded-md border border-(--ib-line) object-cover" />
                  )}
                </div>
                {uploadState[stableKey]?.error && <p className="text-xs text-(--ib-danger)">{uploadState[stableKey]?.error}</p>}
                <div className="event-manage-field">
                  <ManageFieldLabel title={t("manage.email.blocks.imageAlt")} help={t("manage.email.blocks.imageAltHelp")} htmlFor={`event-block-${stableKey}-alt`} />
                  <input id={`event-block-${stableKey}-alt`} className="event-manage-input" disabled={disabled} value={(block as ImageBlock).alt ?? ""}
                    onChange={(e) => updateBlock(i, { ...(block as ImageBlock), alt: e.target.value })} placeholder={t("manage.tpl.editor.altPlaceholder")} />
                </div>
              </div>
            )}

            {block.type === "logo" && (
              <div className="space-y-3">
                <div className="event-manage-field">
                  <ManageFieldLabel title={t("manage.email.blocks.logoAlign")} help={t("manage.email.blocks.logoAlignHelp")} />
                  <EventSelect ariaLabel={t("manage.email.blocks.logoAlign")} disabled={disabled} value={(block as LogoBlock).align ?? "center"} options={alignOptions}
                    onValueChange={(next) => updateBlock(i, { ...(block as LogoBlock), align: next as LogoBlock["align"] })} />
                </div>
                <div className="event-manage-field">
                  <ManageFieldLabel title={t("manage.tpl.editor.logoWidth")} help={t("manage.email.blocks.logoWidthHelp")} htmlFor={`event-block-${stableKey}-logo`} />
                  <input id={`event-block-${stableKey}-logo`} className="event-manage-input" type="number" min={16} max={600} disabled={disabled}
                    value={(block as LogoBlock).width_px ?? 64}
                    onChange={(e) => updateBlock(i, { ...(block as LogoBlock), width_px: parseInt(e.target.value, 10) || 64 })} />
                </div>
              </div>
            )}

            {block.type === "preset" && (
              <div className="event-manage-field">
                <ManageFieldLabel title={t("manage.tpl.editor.block.preset")} help={t("manage.tpl.editor.presetHelp")} />
                <EventSelect ariaLabel={t("manage.tpl.editor.selectPreset")} disabled={disabled} value={(block as PresetBlock).preset_id} placeholder={t("manage.tpl.editor.selectPreset")}
                  options={presets.map((p) => ({ value: p.ID, label: t("manage.tpl.editor.presetOption", {name: p.Name, blocks: tPlural("manage.tpl.editor.blocksCountN", p.Blocks.length)}) }))}
                  onValueChange={(next) => {
                    const preset = presets.find((p) => p.ID === next);
                    if (preset) updateBlock(i, { type: "preset", preset_id: preset.ID, name: preset.Name });
                  }} />
              </div>
            )}
          </div>
        );
      })}

      {!disabled && (
        <div className="mt-4 rounded-xl border border-dashed border-(--ib-line) p-4">
          <div className="mb-3 text-[12px] font-bold uppercase tracking-[0.08em] text-(--ib-dim)">{t("manage.tpl.editor.addBlock")}</div>
          <div className="mb-4 flex flex-wrap gap-2">
            {ADD_BLOCK_TYPES.filter((type) => !hiddenBlocks.includes(type)).map((type) => (
              <button key={type} type="button" aria-label={t(ADD_BLOCK_ARIA_KEYS[type])} onClick={() => addBlock(type)}
                className="rounded border border-(--ib-line) bg-(--ib-surface) px-2.5 py-1 text-xs font-medium transition-colors hover:bg-(--ib-soft)">
                {t(BLOCK_LABEL_KEYS[type])}
              </button>
            ))}
          </div>

          {presets.length > 0 && (
            <div className="border-t border-(--ib-line) pt-3">
              <div className="mb-2"><ManageFieldLabel title={t("manage.tpl.editor.sharedPresets")} help={t("manage.tpl.editor.presetHelp")} /></div>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <button key={preset.ID} type="button" onClick={() => addPresetBlock(preset)}
                    className="rounded-md border border-(--ib-line) bg-(--ib-soft) px-2.5 py-1 text-xs font-medium text-(--ib-ink) transition-colors hover:bg-(--ib-hover)">
                    {t("manage.tpl.editor.presetOption", {name: preset.Name, blocks: tPlural("manage.tpl.editor.blocksCountN", preset.Blocks.length)})}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BlockEditor;
