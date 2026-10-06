"use client"

import { useEffect, useRef, useState } from "react"
import DOMPurify from "isomorphic-dompurify"
import { Bold, Braces, ChevronDown, Italic } from "lucide-react"
import { t } from "@/i18n/t"
import { INVALID_PILL_CLASS, VARIABLE_TOKEN, unknownVariableHint, type VariableDef } from "./variableUtils"
import { VariablePickerMenu } from "./VariablePickerMenu"
import { historyDirection, placeCaretAtEnd, TemplateFieldHistory } from "./templateFieldHistory"
import { HoverTooltip } from "./HoverTooltip"

// Preserve formatting in templates authored before the per-message font control was removed.
const LEGACY_FONTS = ["Arial", "Georgia", "Verdana"] as const

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/** Keep the small in-app format identical in storage, preview and delivery. */
export function normalizeInAppBody(html: string): string {
  const safe = DOMPurify.sanitize(html, { ALLOWED_TAGS: ["strong", "b", "em", "i", "span", "font", "br", "div", "p"], ALLOWED_ATTR: ["style", "face", "data-var"] })
  const root = document.createElement("div")
  root.innerHTML = safe
  function visit(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return escapeText((node.textContent ?? "").replace(/\u200b/g, ""))
    if (node.nodeType !== Node.ELEMENT_NODE) return ""
    const element = node as HTMLElement
    const inner = Array.from(element.childNodes).map(visit).join("")
    const tag = element.tagName.toLowerCase()
    if (tag === "span" && /^[A-Za-z_]\w*$/.test(element.dataset.var ?? "")) return `{{.${element.dataset.var}}}`
    if (tag === "strong" || tag === "b") return `<strong>${inner}</strong>`
    if (tag === "em" || tag === "i") return `<em>${inner}</em>`
    if (tag === "br") return "<br>"
    if (tag === "span" || tag === "font") {
      const rawFont = (tag === "font" ? element.getAttribute("face") : element.style.fontFamily) ?? ""
      const font = LEGACY_FONTS.find((item) => item.toLowerCase() === rawFont.replace(/["']/g, "").toLowerCase())
      return font ? `<span style="font-family:${font}">${inner}</span>` : inner
    }
    if (tag === "div" || tag === "p") return inner + "<br>"
    return inner
  }
  return Array.from(root.childNodes).map(visit).join("").replace(/(?:<br>)+$/, "")
}

const VALID_PILL_CLASS = "mx-0.5 rounded border border-[var(--ib-warn)] bg-[var(--ib-warn-bg)] px-1 text-[var(--ib-ink)]"
const INVALID_PILL_STYLE = `${INVALID_PILL_CLASS} mx-0.5 rounded border border-(--ib-danger) bg-(--ib-danger-bg) px-1 text-(--ib-danger) underline decoration-wavy`

function variablePill(name: string, invalid = false): HTMLSpanElement {
  const pill = document.createElement("span")
  pill.dataset.var = name
  pill.contentEditable = "false"
  pill.className = invalid ? INVALID_PILL_STYLE : VALID_PILL_CLASS
  if (invalid) {
    pill.dataset.invalid = "true"
    pill.title = unknownVariableHint(name)
  }
  pill.textContent = name
  return pill
}

// Every {{token}} in the text becomes a pill: valid for a declared variable,
// flagged red for an unknown one. Skipped while the list is empty (not loaded).
function decorateVariables(editor: HTMLElement, variables: VariableDef[]) {
  if (variables.length === 0) return
  const known = new Set(variables.map((item) => item.name))
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  for (const node of nodes) {
    if (node.parentElement?.dataset.var) continue
    const text = node.textContent ?? ""
    const pattern = new RegExp(VARIABLE_TOKEN.source, "g")
    let match: RegExpExecArray | null
    let last = 0
    const fragment = document.createDocumentFragment()
    let replaced = false
    while ((match = pattern.exec(text))) {
      fragment.appendChild(document.createTextNode(text.slice(last, match.index)))
      fragment.appendChild(variablePill(match[1], !known.has(match[1])))
      last = pattern.lastIndex
      replaced = true
    }
    if (replaced) {
      fragment.appendChild(document.createTextNode(text.slice(last)))
      node.replaceWith(fragment)
    }
  }
}

type Props = { value: string; onChange: (value: string) => void; variables: VariableDef[]; disabled?: boolean }

export function InAppBodyEditor({ value, onChange, variables, disabled = false }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const savedRange = useRef<Range | null>(null)
  const lastValue = useRef("")
  const historyRef = useRef(new TemplateFieldHistory(value))
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!editorRef.current) return
    if (value === lastValue.current) {
      decorateVariables(editorRef.current, variables)
      return
    }
    editorRef.current.innerHTML = normalizeInAppBody(value)
    decorateVariables(editorRef.current, variables)
    lastValue.current = value
    historyRef.current.reset(value)
  }, [value, variables])

  function emit() {
    if (!editorRef.current) return
    const next = normalizeInAppBody(editorRef.current.innerHTML)
    historyRef.current.record(next)
    lastValue.current = next
    onChange(next)
  }

  function rememberSelection() {
    const selection = window.getSelection()
    if (selection?.rangeCount && editorRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      savedRange.current = selection.getRangeAt(0).cloneRange()
    }
  }

  function insertNode(node: Node) {
    const editor = editorRef.current
    if (!editor) return
    const selection = window.getSelection()
    const range = savedRange.current ?? (document.activeElement === editor && selection?.rangeCount ? selection.getRangeAt(0) : null)
    editor.focus()
    if (range && editor.contains(range.commonAncestorContainer)) {
      range.deleteContents()
      range.insertNode(node)
      range.setStartAfter(node)
      range.collapse(true)
      selection?.removeAllRanges()
      selection?.addRange(range)
      savedRange.current = range.cloneRange()
    } else editor.appendChild(node)
    emit()
  }

  function format(tag: "strong" | "em") {
    const editor = editorRef.current
    const range = savedRange.current
    if (!editor || !range || !editor.contains(range.commonAncestorContainer)) return
    const wrapper = document.createElement(tag)
    wrapper.appendChild(range.extractContents())
    if (!wrapper.textContent) wrapper.appendChild(document.createTextNode("\u200b"))
    range.insertNode(wrapper)
    const selection = window.getSelection()
    const nextRange = document.createRange()
    nextRange.selectNodeContents(wrapper)
    nextRange.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(nextRange)
    savedRange.current = nextRange.cloneRange()
    emit()
  }

  return <div className="rounded-md border border-(--ib-line) bg-(--ib-surface)">
    <div className="flex flex-wrap items-center gap-1 border-b border-(--ib-line) px-2 py-1.5">
      <HoverTooltip text={t("manage.tpl.editor.bold")}><button type="button" aria-label={t("manage.tpl.editor.bold")} disabled={disabled}
        onMouseDown={(event) => event.preventDefault()} onClick={() => format("strong")}
        className="rounded p-1.5 text-(--ib-ink) hover:bg-(--ib-soft) disabled:opacity-40"><Bold className="h-4 w-4" /></button></HoverTooltip>
      <HoverTooltip text={t("manage.tpl.editor.italic")}><button type="button" aria-label={t("manage.tpl.editor.italic")} disabled={disabled}
        onMouseDown={(event) => event.preventDefault()} onClick={() => format("em")}
        className="rounded p-1.5 text-(--ib-ink) hover:bg-(--ib-soft) disabled:opacity-40"><Italic className="h-4 w-4" /></button></HoverTooltip>
      {variables.length > 0 && <div className="relative ml-auto">
        <button type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => setMenuOpen((open) => !open)}
          aria-label={t("manage.tpl.editor.insertVariable")}
          className="inline-flex h-8 items-center gap-1 rounded border border-(--ib-line) px-2 text-xs font-medium text-(--ib-action) hover:bg-(--ib-soft)"><Braces className="h-3.5 w-3.5" />{t("manage.tpl.editor.insertVariable")}<ChevronDown className="h-3 w-3" /></button>
        {menuOpen && <VariablePickerMenu variables={variables}
          onSelect={(name) => { insertNode(variablePill(name)); setMenuOpen(false) }}
          onClose={() => { setMenuOpen(false); editorRef.current?.focus() }}
          className="absolute right-0 top-full mt-1" />}
      </div>}
    </div>
    <div className="editor-scroll min-h-28 has-focus-visible:ring-2 has-focus-visible:ring-inset has-focus-visible:ring-(--ib-action)">
    <div className="editor-scroll__body">
    <div ref={editorRef} contentEditable={!disabled} suppressContentEditableWarning role="textbox" aria-multiline="true"
      aria-label={t("manage.tpl.tpl.body")}
      onKeyDown={(event) => {
        const direction = historyDirection(event)
        if (!direction || event.nativeEvent.isComposing || disabled) return
        event.preventDefault()
        const previous = historyRef.current[direction]()
        if (previous === null || !editorRef.current) return
        editorRef.current.innerHTML = normalizeInAppBody(previous)
        decorateVariables(editorRef.current, variables)
        lastValue.current = previous
        savedRange.current = placeCaretAtEnd(editorRef.current)
        onChange(previous)
      }}
      onInput={emit} onKeyUp={rememberSelection} onMouseUp={rememberSelection} onFocus={rememberSelection}
      onBlur={() => { if (editorRef.current) decorateVariables(editorRef.current, variables) }}
      onPaste={(event) => { event.preventDefault(); insertNode(document.createTextNode(event.clipboardData.getData("text/plain"))) }}
      className="px-3 py-2 text-sm leading-relaxed text-(--ib-ink) outline-none" />
    </div>
    </div>
  </div>
}
