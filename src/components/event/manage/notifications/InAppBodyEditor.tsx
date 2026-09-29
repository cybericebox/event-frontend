"use client";

import {useEffect, useRef} from "react";
import DOMPurify from "isomorphic-dompurify";
import {Bold, Italic} from "lucide-react";
import type {ManageNotificationVariable} from "@/api/manageNotifications";
import {t} from "@/i18n/t";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {VariableInsert} from "./VariableInsert";

function escapeText(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// The small in-app format is the same in storage, preview and delivery: bold,
// italic, line breaks and {{.variables}}; everything else is dropped.
export function normalizeInAppBody(html: string): string {
    const safe = DOMPurify.sanitize(html, {ALLOWED_TAGS: ["strong", "b", "em", "i", "span", "br", "div", "p"], ALLOWED_ATTR: ["data-var"]});
    const root = document.createElement("div");
    root.innerHTML = safe;
    function visit(node: Node): string {
        if (node.nodeType === Node.TEXT_NODE) return escapeText((node.textContent ?? "").replace(/​/g, ""));
        if (node.nodeType !== Node.ELEMENT_NODE) return "";
        const element = node as HTMLElement;
        const inner = Array.from(element.childNodes).map(visit).join("");
        const tag = element.tagName.toLowerCase();
        if (tag === "span" && /^[A-Za-z_]\w*$/.test(element.dataset.var ?? "")) return `{{.${element.dataset.var}}}`;
        if (tag === "strong" || tag === "b") return `<strong>${inner}</strong>`;
        if (tag === "em" || tag === "i") return `<em>${inner}</em>`;
        if (tag === "br") return "<br>";
        if (tag === "div" || tag === "p") return inner + "<br>";
        return inner;
    }
    return Array.from(root.childNodes).map(visit).join("").replace(/(?:<br>)+$/, "");
}

function variablePill(name: string): HTMLSpanElement {
    const pill = document.createElement("span");
    pill.dataset.var = name;
    pill.contentEditable = "false";
    pill.className = "event-inapp-editor__pill";
    pill.textContent = name;
    return pill;
}

// Turns known {{.variable}} text into pills.
function decorateVariables(editor: HTMLElement, variables: ManageNotificationVariable[]) {
    const known = new Set(variables.map(item => item.Name));
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
        if (node.parentElement?.dataset.var) continue;
        const text = node.textContent ?? "";
        const pattern = /\{\{\.?([A-Za-z_]\w*)\}\}/g;
        let match: RegExpExecArray | null;
        let last = 0;
        const fragment = document.createDocumentFragment();
        let replaced = false;
        while ((match = pattern.exec(text))) {
            if (!known.has(match[1])) continue;
            fragment.appendChild(document.createTextNode(text.slice(last, match.index)));
            fragment.appendChild(variablePill(match[1]));
            last = pattern.lastIndex;
            replaced = true;
        }
        if (replaced) {
            fragment.appendChild(document.createTextNode(text.slice(last)));
            node.replaceWith(fragment);
        }
    }
}

export function InAppBodyEditor({value, onChange, variables, disabled = false, id, ariaLabel}: {
    value: string; onChange: (value: string) => void; variables: ManageNotificationVariable[]; disabled?: boolean; id: string; ariaLabel: string;
}) {
    const editorRef = useRef<HTMLDivElement>(null);
    const savedRange = useRef<Range | null>(null);
    const lastValue = useRef<string | null>(null);

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;
        if (value !== lastValue.current) {
            editor.innerHTML = normalizeInAppBody(value);
            lastValue.current = value;
        }
        decorateVariables(editor, variables);
    }, [value, variables]);

    function emit() {
        if (!editorRef.current) return;
        const next = normalizeInAppBody(editorRef.current.innerHTML);
        lastValue.current = next;
        onChange(next);
    }

    function rememberSelection() {
        const selection = window.getSelection();
        if (selection?.rangeCount && editorRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) savedRange.current = selection.getRangeAt(0).cloneRange();
    }

    function insertNode(node: Node) {
        const editor = editorRef.current;
        if (!editor) return;
        const range = savedRange.current;
        editor.focus();
        if (range && editor.contains(range.commonAncestorContainer)) {
            range.deleteContents();
            range.insertNode(node);
            range.setStartAfter(node);
            range.collapse(true);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
            savedRange.current = range.cloneRange();
        } else editor.appendChild(node);
        emit();
    }

    function format(tag: "strong" | "em") {
        const editor = editorRef.current;
        const range = savedRange.current;
        if (!editor || !range || !editor.contains(range.commonAncestorContainer)) return;
        const wrapper = document.createElement(tag);
        wrapper.appendChild(range.extractContents());
        if (!wrapper.textContent) wrapper.appendChild(document.createTextNode("​"));
        range.insertNode(wrapper);
        const next = document.createRange();
        next.selectNodeContents(wrapper);
        next.collapse(false);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(next);
        savedRange.current = next.cloneRange();
        emit();
    }

    const tool = (label: string, tag: "strong" | "em", icon: React.ReactNode) => <EventTooltip content={label}>{tooltipID => <button className="ib-icon-btn ib-icon-btn--sm" type="button" disabled={disabled} aria-label={label} aria-describedby={tooltipID}
        onMouseDown={event => event.preventDefault()} onClick={() => format(tag)}>{icon}</button>}</EventTooltip>;

    return <div className="event-inapp-editor">
        <div className="event-inapp-editor__bar">
            {tool(t("manage.notifications.bold"), "strong", <Bold size={15} />)}
            {tool(t("manage.notifications.italic"), "em", <Italic size={15} />)}
            <VariableInsert variables={variables} disabled={disabled} onInsert={name => { const pill = variablePill(name); insertNode(pill); }} />
        </div>
        <div ref={editorRef} id={id} className="event-inapp-editor__body event-manage-input" contentEditable={!disabled} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={ariaLabel} aria-disabled={disabled}
            onInput={emit} onKeyUp={rememberSelection} onMouseUp={rememberSelection} onFocus={rememberSelection}
            onBlur={() => { if (editorRef.current) decorateVariables(editorRef.current, variables); }}
            onPaste={event => { event.preventDefault(); insertNode(document.createTextNode(event.clipboardData.getData("text/plain"))); }} />
    </div>;
}
