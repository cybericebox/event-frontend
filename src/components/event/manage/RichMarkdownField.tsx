"use client";

import {useEffect, useId, useRef, useState} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import TurndownService from "turndown";
import * as Popover from "@radix-ui/react-popover";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Braces, ChevronDown, Circle, Code, Code2, Heading1, Heading2, Heading3, Italic, Link2, List, ListOrdered, Pilcrow, Quote, RemoveFormatting, Strikethrough} from "lucide-react";
import type {ContentValue} from "@/types/eventContent";
import {insertableContentVariable, type ContentVariableDefinition} from "@/components/event/content/variableCatalog";
import {FieldLabel} from "./FieldLabel";
import {EventTooltip} from "@/components/ui/EventTooltip";

const turndown = new TurndownService({headingStyle: "atx", bulletListMarker: "-"});
turndown.addRule("strikethrough", {filter: node => ["DEL", "S", "STRIKE"].includes(node.nodeName), replacement: content => `~~${content}~~`});
turndown.addRule("event-variable", {
    filter: node => node.nodeName === "SPAN" && (node as HTMLElement).classList.contains("event-rich-markdown__variable-token"),
    replacement: (_, node) => {
        const name = (node as HTMLElement).dataset.variable;
        return name ? `{{${name}}}` : "";
    },
});
const inlineTools = [
    {label: "Жирний", icon: Bold, command: "bold"},
    {label: "Курсив", icon: Italic, command: "italic"},
    {label: "Закреслений", icon: Strikethrough, command: "strikeThrough"},
];
const listTools = [
    {label: "Маркований список", icon: List, command: "insertUnorderedList"},
    {label: "Нумерований список", icon: ListOrdered, command: "insertOrderedList"},
];
const blockTools = [
    {label: "Цитата", icon: Quote, command: "formatBlock", argument: "blockquote"},
    {label: "Блок коду", icon: Code2, command: "formatBlock", argument: "pre"},
];

function markdownHTML(value: string) {
    return renderToStaticMarkup(<ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>);
}

function serializedMarkdown(html: string) {
    return turndown.turndown(html).trim().replaceAll("<", "&lt;");
}

function highlightVariables(root: HTMLElement) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
        if (node.parentElement?.closest(".event-rich-markdown__variable-token")) continue;
        const source = node.textContent ?? "";
        const matches = [...source.matchAll(/\{\{[a-z][a-zA-Z0-9.]*\}\}/g)];
        if (matches.length === 0) continue;
        const fragment = document.createDocumentFragment();
        let position = 0;
        for (const match of matches) {
            const start = match.index ?? 0;
            if (start > position) fragment.append(document.createTextNode(source.slice(position, start)));
            const token = document.createElement("span");
            token.className = "event-rich-markdown__variable-token";
            token.dataset.variable = match[0].slice(2, -2);
            token.textContent = token.dataset.variable;
            fragment.append(token);
            position = start + match[0].length;
        }
        if (position < source.length) fragment.append(document.createTextNode(source.slice(position)));
        node.replaceWith(fragment);
    }
}

export function RichMarkdownField({label, value, required = true, error, disabled, catalog, values, alignment, onAlignmentChange, onChange, onInsertVariable}: {
    label: string;
    value: string;
    required?: boolean;
    error?: string;
    disabled: boolean;
    catalog: ContentVariableDefinition[];
    values: Record<string, ContentValue>;
    alignment?: string;
    onAlignmentChange?: (alignment: string) => void;
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
    const textAlignment = alignment === "center" || alignment === "right" || alignment === "justify" ? alignment : "left";

    useEffect(() => {
        if (!editor.current || value === lastEmitted.current) return;
        lastEmitted.current = value;
        if (document.activeElement !== editor.current) {
            editor.current.innerHTML = markdownHTML(value);
            highlightVariables(editor.current);
        }
    }, [value]);
    useEffect(() => {
        if (editor.current) {
            editor.current.innerHTML = markdownHTML(value);
            highlightVariables(editor.current);
        }
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
    function clearFormatting() {
        restoreSelection();
        document.execCommand("removeFormat");
        document.execCommand("unlink");
        document.execCommand("formatBlock", false, "p");
        emit();
    }
    function toolButton(tool: {label: string; icon: typeof Bold; command: string; argument?: string}) {
        const Icon = tool.icon;
        return <EventTooltip key={tool.label} content={tool.label}>{tipID => <button type="button" aria-label={tool.label} aria-describedby={tipID} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => command(tool.command, tool.argument)}><Icon size={16} /></button>}</EventTooltip>;
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
        if (!editor.current) return;
        if (!/^[a-z][a-zA-Z0-9.]*$/.test(variable.name)) return;
        const current = window.getSelection();
        const range = current?.rangeCount ? current.getRangeAt(0) : null;
        if (!range || !editor.current.contains(range.commonAncestorContainer)) return;
        const token = document.createElement("span");
        token.className = "event-rich-markdown__variable-token";
        token.dataset.variable = variable.name;
        token.textContent = variable.name;
        range.deleteContents();
        range.insertNode(token);
        range.setStartAfter(token);
        range.collapse(true);
        current?.removeAllRanges();
        current?.addRange(range);
        const next = serializedMarkdown(editor.current.innerHTML);
        lastEmitted.current = next;
        onInsertVariable(variable, next);
        setVariablesOpen(false);
        setSearch("");
    }
    return <div className="event-manage-field event-rich-markdown">
        <FieldLabel label={label} required={required} help="Виділіть текст і скористайтеся кнопками форматування.\n• Доступні заголовки, списки, посилання, цитати й код.\n• Вирівнювання змінює весь текст цього блока.\n• Вставлений Markdown одразу стане форматованим текстом.\n• Усі зміни відразу видно в попередньому перегляді." />
        <div className={`event-rich-markdown__frame${error ? " is-invalid" : ""}`}>
            <div className="event-rich-markdown__toolbar" role="toolbar" aria-label="Форматування тексту">
                <span className="event-rich-markdown__tool-group"><EventTooltip content="Прибрати форматування з виділеного тексту">{tipID => <button type="button" aria-label="Очистити форматування" aria-describedby={tipID} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={clearFormatting}><RemoveFormatting size={16} /></button>}</EventTooltip></span>
                <span className="event-rich-markdown__tool-group">{inlineTools.map(toolButton)}</span>
                <span className="event-rich-markdown__tool-group">
                    <DropdownMenu.Root modal={false}><EventTooltip content="Заголовки першого, другого й третього рівня">{tipID => <DropdownMenu.Trigger asChild><button type="button" className="event-rich-markdown__heading-trigger" aria-label="Вибрати рівень заголовка" aria-describedby={tipID} disabled={disabled} onPointerDown={rememberSelection}><Heading1 size={16} /><ChevronDown size={12} /></button></DropdownMenu.Trigger>}</EventTooltip><DropdownMenu.Portal><DropdownMenu.Content className="ib-listbox event-rich-markdown__heading-menu" align="start" sideOffset={5} collisionPadding={12}>{[{label: "Заголовок 1", icon: Heading1, tag: "h1"}, {label: "Заголовок 2", icon: Heading2, tag: "h2"}, {label: "Заголовок 3", icon: Heading3, tag: "h3"}].map(item => <DropdownMenu.Item className="ib-listbox__opt" key={item.tag} onSelect={() => command("formatBlock", item.tag)}><item.icon size={16} />{item.label}</DropdownMenu.Item>)}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
                    <EventTooltip content="Звичайний абзац">{tipID => <button type="button" aria-label="Звичайний абзац" aria-describedby={tipID} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => command("formatBlock", "p")}><Pilcrow size={16} /></button>}</EventTooltip>
                </span>
                <span className="event-rich-markdown__tool-group">{listTools.map(toolButton)}</span>
                <span className="event-rich-markdown__tool-group">{blockTools.map(toolButton)}</span>
                <span className="event-rich-markdown__tool-group">
                    <EventTooltip content="Код у рядку">{tipID => <button type="button" aria-label="Код у рядку" aria-describedby={tipID} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={inlineCode}><Code size={16} /></button>}</EventTooltip>
                    <EventTooltip content="Додати посилання до виділеного тексту">{tipID => <button type="button" aria-label="Посилання" aria-describedby={tipID} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => {rememberSelection(); setLinkOpen(open => !open);}}><Link2 size={16} /></button>}</EventTooltip>
                </span>
                {onAlignmentChange && <span className="event-rich-markdown__tool-group">
                    <DropdownMenu.Root modal={false}><EventTooltip content="Вирівнювання всього тексту цього блока">{tipID => <DropdownMenu.Trigger asChild><button type="button" className="event-rich-markdown__heading-trigger" aria-label="Вирівнювання тексту" aria-describedby={tipID} disabled={disabled}>{textAlignment === "center" ? <AlignCenter size={16} /> : textAlignment === "right" ? <AlignRight size={16} /> : textAlignment === "justify" ? <AlignJustify size={16} /> : <AlignLeft size={16} />}<ChevronDown size={12} /></button></DropdownMenu.Trigger>}</EventTooltip><DropdownMenu.Portal><DropdownMenu.Content className="ib-listbox event-rich-markdown__heading-menu" align="start" sideOffset={5} collisionPadding={12}><DropdownMenu.RadioGroup value={textAlignment} onValueChange={onAlignmentChange}>{[{value: "left", label: "Ліворуч", icon: AlignLeft}, {value: "center", label: "По центру", icon: AlignCenter}, {value: "right", label: "Праворуч", icon: AlignRight}, {value: "justify", label: "По ширині", icon: AlignJustify}].map(item => <DropdownMenu.RadioItem className="ib-listbox__opt event-select__option" key={item.value} value={item.value}><DropdownMenu.ItemIndicator className="event-select__indicator"><Circle size={8} fill="currentColor" aria-hidden="true" /></DropdownMenu.ItemIndicator><item.icon size={16} />{item.label}</DropdownMenu.RadioItem>)}</DropdownMenu.RadioGroup></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
                </span>}
                <span className="event-rich-markdown__tool-group event-rich-markdown__tool-group--end">
                    <Popover.Root open={variablesOpen} onOpenChange={open => {setVariablesOpen(open); if (!open) setSearch("");}} modal={false}>
                    <EventTooltip content="Вставити змінну події">{tipID => <Popover.Trigger asChild><button type="button" aria-label="Вставити змінну у вміст" aria-describedby={tipID} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={rememberSelection}><Braces size={16} /></button></Popover.Trigger>}</EventTooltip>
                    <Popover.Portal><Popover.Content className="event-rich-markdown__variable-popover" side="bottom" align="end" sideOffset={6} collisionPadding={12} onCloseAutoFocus={event => event.preventDefault()}>
                        <div className="event-rich-markdown__variable-heading"><strong>Змінні події</strong><Popover.Close type="button" aria-label="Закрити вибір змінної">×</Popover.Close></div>
                        <input className="event-manage-input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Знайти змінну" aria-label="Знайти змінну" />
                        <div className="event-rich-markdown__variables">{catalog.filter(variable => insertableContentVariable(variable) && `${variable.label} ${variable.name}`.toLocaleLowerCase("uk").includes(search.toLocaleLowerCase("uk"))).map(variable => <button key={variable.name} type="button" onClick={() => insertVariable(variable)}><strong>{variable.label}</strong><code>{variable.name}</code><small>Зараз: {String(values[variable.name] ?? "Немає значення")}</small></button>)}</div>
                    </Popover.Content></Popover.Portal>
                    </Popover.Root>
                </span>
            </div>
            {linkOpen && <div className="event-rich-markdown__inline"><input className="event-manage-input" aria-label="Адреса посилання" placeholder="https://… або /rules" value={href} onChange={event => setHref(event.target.value)} onKeyDown={event => {if (event.key === "Enter") {event.preventDefault(); if (/^(https?:\/\/|\/)/.test(href)) {command("createLink", href); setLinkOpen(false); setHref("");}}}} /><button className="ib-btn ib-btn--sm" type="button" disabled={!/^(https?:\/\/|\/)/.test(href)} onClick={() => {command("createLink", href); setLinkOpen(false); setHref("");}}>Додати</button></div>}
            <div id={id} ref={editor} className="event-rich-markdown__editor ib-block-prose" style={{textAlign: textAlignment}} role="textbox" aria-label={label} aria-multiline="true" aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} contentEditable={!disabled} suppressContentEditableWarning data-placeholder="Напишіть текст…" onInput={emit} onKeyUp={rememberSelection} onMouseUp={rememberSelection} onBlur={rememberSelection} onPaste={event => {event.preventDefault(); const plain = event.clipboardData.getData("text/plain"); restoreSelection(); document.execCommand("insertHTML", false, markdownHTML(plain)); emit();}} />
        </div>
        {error && <p className="event-content-editor__field-error" id={`${id}-error`} role="alert">{error}</p>}
    </div>;
}
