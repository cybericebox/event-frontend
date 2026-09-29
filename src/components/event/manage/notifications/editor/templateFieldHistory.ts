/** Undo history for contentEditable edits that also mutate the DOM programmatically. */
export class TemplateFieldHistory {
  private entries: string[]
  private index = 0

  constructor(initial: string) {
    this.entries = [initial]
  }

  reset(value: string) {
    this.entries = [value]
    this.index = 0
  }

  record(value: string) {
    if (value === this.entries[this.index]) return
    this.entries = this.entries.slice(0, this.index + 1)
    this.entries.push(value)
    if (this.entries.length > 100) this.entries.shift()
    this.index = this.entries.length - 1
  }

  undo(): string | null {
    if (this.index === 0) return null
    return this.entries[--this.index]
  }

  redo(): string | null {
    if (this.index >= this.entries.length - 1) return null
    return this.entries[++this.index]
  }
}

export function historyDirection(event: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }): "undo" | "redo" | null {
  if ((!event.ctrlKey && !event.metaKey) || event.altKey) return null
  const key = event.key.toLowerCase()
  if (key === "z") return event.shiftKey ? "redo" : "undo"
  if (key === "y" && !event.shiftKey) return "redo"
  return null
}

export function placeCaretAtEnd(editor: HTMLElement): Range {
  const range = document.createRange()
  range.selectNodeContents(editor)
  range.collapse(false)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  return range
}
