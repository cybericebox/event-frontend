"use client";

import {useEffect, useId, useRef, useState} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import TurndownService from "turndown";
import {Bold, Braces, Code, Code2, Heading1, Heading2, Heading3, Italic, Link2, List, ListOrdered, Pilcrow, Quote, RemoveFormatting, Strikethrough, X} from "lucide-react";
import type {ContentValue} from "@/types/eventContent";
import type {ContentVariableDefinition} from "@/components/event/content/variableCatalog";
import {FieldLabel} from "./FieldLabel";

const turndown = new TurndownService({headingStyle: "atx", bulletListMarker: "-"});
turndown.addRule("strikethrough", {filter: node => ["DEL", "S", "STRIKE"].includes(node.nodeName), replacement: content => `~~${content}~~`});
const formattingTools = [
    {label: "Жирний", icon: Bold, command: "bold"},
    {label: "Курсив", icon: Italic, command: "italic"},
    {label: "Закреслений", icon: Strikethrough, command: "strikeThrough"},
    {label: "Заголовок 1", icon: Heading1, command: "formatBlock", argument: "h1"},
    {label: "Заголовок 2", icon: Heading2, command: "formatBlock", argument: "h2"},
    {label: "Заголовок 3", icon: Heading3, command: "formatBlock", argument: "h3"},
    {label: "Звичайний абзац", icon: Pilcrow, command: "formatBlock", argument: "p"},
    {label: "Маркований список", icon: List, command: "insertUnorderedList"},
    {label: "Нумерований список", icon: ListOrdered, command: "insertOrderedList"},
    {label: "Цитата", icon: Quote, command: "formatBlock", argument: "blockquote"},
    {label: "Блок коду", icon: Code2, command: "formatBlock", argument: "pre"},
    {label: "Очистити форматування", icon: RemoveFormatting, command: "removeFormat"},
];

function markdownHTML(value: string) {
    return renderToStaticMarkup(<ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>);
}

function serializedMarkdown(html: string) {
    return turndown.turndown(html).trim().replaceAll("<", "&lt;");
}

export function RichMarkdownField({label, value, required = true, disabled, catalog, values, onChange, onInsertVariable}: {
    label: string;
    value: string;
    required?: boolean;
    disabled: boolean;
    catalog: ContentVariableDefinition[];
    values: Record<string, ContentValue>;
    onChange: (next: string) => void;
    onInsertVariable: (variable: ContentVariableDefinition, next: string) => void;
}) {
    const id = useId();
    const editor = useRef<HTMLDivElement>(null);
    const lastEmitted = useRef(value);
    const selection = useRef<Range | null>(null);
    const [variablesOpen, setVariablesOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [linkOpen, setLinkOpen] = useState(false);
    const [href, setHref] = useState("");

    useEffect(() => {
        if (!editor.current || value === lastEmitted.current) return;
        lastEmitted.current = value;
        if (document.activeElement !== editor.current) editor.current.innerHTML = markdownHTML(value);
    }, [value]);
    useEffect(() => {
        if (editor.current) editor.current.innerHTML = markdownHTML(value);
        // Initialize once; subsequent external changes use the value effect above.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        const capture = () => {
            const range = window.getSelection()?.getRangeAt(0);
            if (range && editor.current?.contains(range.commonAncestorContainer)) selection.current = range.cloneRange();
        };
        document.addEventListener("selectionchange", capture);
        return () => document.removeEventListener("selectionchange", capture);
    }, []);

    function rememberSelection() {
        const range = window.getSelection()?.getRangeAt(0);
        if (range && editor.current?.contains(range.commonAncestorContainer)) selection.current = range.cloneRange();
    }
    function restoreSelection() {
        editor.current?.focus();
        const range = selection.current;
        if (range && editor.current?.contains(range.commonAncestorContainer)) {
            const current = window.getSelection();
            current?.removeAllRanges();
            current?.addRange(range);
        }
    }
    function emit() {
        if (!editor.current) return;
        const next = serializedMarkdown(editor.current.innerHTML);
        lastEmitted.current = next;
        onChange(next);
        rememberSelection();
    }
    function command(name: string, argument?: string) {
        restoreSelection();
        document.execCommand(name, false, argument);
        emit();
    }
    function inlineCode() {
        restoreSelection();
        const selected = window.getSelection()?.toString();
        if (!selected) return;
        const safe = selected.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
        document.execCommand("insertHTML", false, `<code>${safe}</code>`);
        emit();
    }
    function insertVariable(variable: ContentVariableDefinition) {
        restoreSelection();
        document.execCommand("insertText", false, `{{${variable.name}}}`);
        if (editor.current) {
            const next = serializedMarkdown(editor.current.innerHTML);
            lastEmitted.current = next;
            onInsertVariable(variable, next);
        }
        setVariablesOpen(false);
        setSearch("");
    }
    return <div className="event-manage-field event-rich-markdown">
        <FieldLabel label={label} required={required} help="Виділіть текст і скористайтеся кнопками форматування.\n• Доступні заголовки, списки, посилання, цитати й код.\n• Вставлений Markdown одразу стане форматованим текстом.\n• Усі зміни відразу видно в попередньому перегляді." />
        <div className="event-rich-markdown__frame">
            <div className="event-rich-markdown__toolbar" role="toolbar" aria-label="Форматування тексту">
                {formattingTools.map(tool => <button key={tool.label} type="button" title={tool.label} aria-label={tool.label} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => command(tool.command, tool.argument)}><tool.icon size={16} /></button>)}
                <button type="button" title="Код у рядку" aria-label="Код у рядку" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={inlineCode}><Code size={16} /></button>
                <button type="button" title="Посилання" aria-label="Посилання" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => {rememberSelection(); setLinkOpen(open => !open);}}><Link2 size={16} /></button>
                <button type="button" title="Вставити змінну" aria-label="Вставити змінну у вміст" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => {rememberSelection(); setVariablesOpen(open => !open);}}><Braces size={16} /></button>
            </div>
            {linkOpen && <div className="event-rich-markdown__inline"><input className="event-manage-input" aria-label="Адреса посилання" placeholder="https://… або /p/…" value={href} onChange={event => setHref(event.target.value)} onKeyDown={event => {if (event.key === "Enter") {event.preventDefault(); if (/^(https?:\/\/|\/)/.test(href)) {command("createLink", href); setLinkOpen(false); setHref("");}}}} /><button className="ib-btn ib-btn--sm" type="button" disabled={!/^(https?:\/\/|\/)/.test(href)} onClick={() => {command("createLink", href); setLinkOpen(false); setHref("");}}>Додати</button></div>}
            {variablesOpen && <div className="event-rich-markdown__variables"><div className="event-content-editor__variable-head"><strong>Змінні події</strong><button type="button" aria-label="Закрити список змінних" onClick={() => setVariablesOpen(false)}><X size={15} /></button></div><input className="event-manage-input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Знайти змінну" aria-label="Знайти змінну" />{catalog.filter(variable => `${variable.label} ${variable.name}`.toLocaleLowerCase("uk").includes(search.toLocaleLowerCase("uk"))).map(variable => <button key={variable.name} type="button" onClick={() => insertVariable(variable)}><strong>{variable.label}</strong><code>{variable.name}</code><small>Зараз: {String(values[variable.name] ?? "Немає значення")}</small></button>)}</div>}
            <div id={id} ref={editor} className="event-rich-markdown__editor ib-block-prose" role="textbox" aria-label={label} aria-multiline="true" contentEditable={!disabled} suppressContentEditableWarning data-placeholder="Напишіть текст…" onInput={emit} onKeyUp={rememberSelection} onMouseUp={rememberSelection} onBlur={rememberSelection} onPaste={event => {event.preventDefault(); const plain = event.clipboardData.getData("text/plain"); restoreSelection(); document.execCommand("insertHTML", false, markdownHTML(plain)); emit();}} />
        </div>
    </div>;
}
