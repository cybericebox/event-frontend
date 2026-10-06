/**
 * emailBlocks.ts — Email body block type union, default blocks + brand tokens.
 *
 * Single source of truth for the block types. HTML rendering happens only on
 * the backend: the editor preview calls previewManageEmailTemplate
 * (manageEmailTemplates.ts), which renders the draft exactly as it is dispatched.
 */

// ── Lexical content ───────────────────────────────────────────────────────────

export type LexicalEditorState = {
  root: { children: unknown[]; type: 'root'; [k: string]: unknown }
}

// ── Block types ────────────────────────────────────────────────────────────────

export type RichTextBlock = { type: 'rich_text'; content: LexicalEditorState }

export type ButtonBlock = {
  type: 'button'
  label: string
  url: string
  align?: 'left' | 'center' | 'right'
}

export type DividerBlock = { type: 'divider' }

export type ImageBlock = {
  type: 'image'
  url?: string
  file_id?: string
  alt?: string
  align?: string
  width_pct?: number
}

export type PresetBlock = { type: 'preset'; preset_id: string; name: string; placement?: 'footer' }

/** Platform/Event brand logo block — rendered server-side from the brand logo asset. */
export type LogoBlock = { type: 'logo'; align?: 'left' | 'center' | 'right'; width_px?: number }

/** A shared block preset (managed by the platform, read-only for an Event). */
export type BlockPreset = { ID: string; Name: string; Description: string; Blocks: EmailBodyBlock[] }

export type EmailBodyBlock =
  | RichTextBlock
  | ButtonBlock
  | DividerBlock
  | ImageBlock
  | PresetBlock
  | LogoBlock

// ── Brand tokens ───────────────────────────────────────────────────────────────

/** `theme:*` styling tokens the backend accepts. An unknown `theme:*` value is a validation error. */
export const THEME_TOKENS = ['theme:brand', 'theme:accent', 'theme:on_accent'] as const

/** What the `theme:*` tokens mean for an Event: its brand colours (the editor swatches). */
export type BrandColors = Record<(typeof THEME_TOKENS)[number], string>

/** Fallback swatches while the Event's colours are unknown. */
export const DEFAULT_BRAND: BrandColors = {
  'theme:brand':     '#211A52',
  'theme:accent':    '#211A52',
  'theme:on_accent': '#FFFFFF',
}

// ── Default block templates ───────────────────────────────────────────────────

const EMPTY_LEXICAL_ROOT: LexicalEditorState = {
  root: {
    children: [],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
}

/** Returns an empty default block for the given type. */
export function defaultBlockForType(type: EmailBodyBlock['type']): EmailBodyBlock {
  switch (type) {
    case 'rich_text':
      return { type: 'rich_text', content: { ...EMPTY_LEXICAL_ROOT } }
    case 'button':
      return { type: 'button', label: '', url: '' }
    case 'divider':
      return { type: 'divider' }
    case 'image':
      return { type: 'image', alt: '' }
    case 'preset':
      return { type: 'preset', preset_id: '', name: '' }
    case 'logo':
      return { type: 'logo', align: 'center', width_px: 64 }
    default: {
      const _exhaustive: never = type
      void _exhaustive
      return { type: 'rich_text', content: { ...EMPTY_LEXICAL_ROOT } }
    }
  }
}
