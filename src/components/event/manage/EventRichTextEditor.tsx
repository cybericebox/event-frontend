"use client";

import {useCallback, useEffect, useRef, useState, type JSX} from "react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import {AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Braces, Code, Code2, Heading1, Heading2, Heading3, Italic, Link2, List, ListOrdered, Pilcrow, Quote, RemoveFormatting, Strikethrough, Underline} from "lucide-react";
import {$createParagraphNode, $createTextNode, $getRoot, $getSelection, $isRangeSelection, $isTextNode, $setSelection, COMMAND_PRIORITY_LOW, FORMAT_ELEMENT_COMMAND, FORMAT_TEXT_COMMAND, PASTE_COMMAND, SELECTION_CHANGE_COMMAND, TextNode, type BaseSelection, type EditorState, type LexicalEditor, type TextFormatType} from "lexical";
import {$createCodeNode, $isCodeNode, CodeNode} from "@lexical/code";
import {$createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode, HeadingNode, QuoteNode} from "@lexical/rich-text";
import {$setBlocksType} from "@lexical/selection";
import {$isListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, ListItemNode, ListNode, REMOVE_LIST_COMMAND} from "@lexical/list";
import {LinkNode, TOGGLE_LINK_COMMAND} from "@lexical/link";
import {$generateNodesFromMarkdownString, BOLD_ITALIC_STAR, BOLD_ITALIC_UNDERSCORE, BOLD_STAR, BOLD_UNDERSCORE, CODE, HEADING, INLINE_CODE, ITALIC_STAR, ITALIC_UNDERSCORE, LINK, ORDERED_LIST, QUOTE, STRIKETHROUGH, UNORDERED_LIST, type Transformer} from "@lexical/markdown";
import {LexicalComposer} from "@lexical/react/LexicalComposer";
import {useLexicalComposerContext} from "@lexical/react/LexicalComposerContext";
import {RichTextPlugin} from "@lexical/react/LexicalRichTextPlugin";
import {ContentEditable} from "@lexical/react/LexicalContentEditable";
import {LexicalErrorBoundary} from "@lexical/react/LexicalErrorBoundary";
import {OnChangePlugin} from "@lexical/react/LexicalOnChangePlugin";
import {HistoryPlugin} from "@lexical/react/LexicalHistoryPlugin";
import {ListPlugin} from "@lexical/react/LexicalListPlugin";
import {LinkPlugin} from "@lexical/react/LexicalLinkPlugin";
import type {ContentRichText} from "../content/richTextState";
import type {ContentVariableDefinition} from "../content/variableCatalog";
import {EventTooltip} from "../../ui/EventTooltip";
import {EventVariableNode, EventVariableProvider, $createEventVariableNode, $isEventVariableNode, $toggleSelectedEventVariableFormat} from "./EventVariableNode";

export type EventRichTextEditorProps = {
    value: ContentRichText | null;
    onChange: (value: ContentRichText) => void;
    variables: ContentVariableDefinition[];
    values: Record<string, string | number | boolean | null>;
    onInsertVariable?: (insert: (name: string) => void) => void;
    onEditLink?: (insert: (href: string) => void) => void;
    dateDisplays?: Record<string, {format: "date-time" | "date" | "time" | "short" | "custom"; pattern?: string}>;
    disabled?: boolean;
    placeholder?: string;
    ariaLabel?: string;
};

const theme = {
    paragraph: "event-lexical__paragraph",
    text: {bold: "event-lexical__bold", italic: "event-lexical__italic", underline: "event-lexical__underline", strikethrough: "event-lexical__strike", code: "event-lexical__inline-code"},
    heading: {h1: "event-lexical__h1", h2: "event-lexical__h2", h3: "event-lexical__h3"},
    quote: "event-lexical__quote", code: "event-lexical__code",
    list: {ul: "event-lexical__ul", ol: "event-lexical__ol", listitem: "event-lexical__li"},
    link: "event-lexical__link",
};
export const eventRichTextNodes = [HeadingNode, QuoteNode, CodeNode, ListNode, ListItemNode, LinkNode, EventVariableNode];
export const eventRichTextTheme = theme;
const MARKDOWN_TRANSFORMERS: Transformer[] = [HEADING, QUOTE, CODE, UNORDERED_LIST, ORDERED_LIST, INLINE_CODE, BOLD_ITALIC_STAR, BOLD_ITALIC_UNDERSCORE, BOLD_STAR, BOLD_UNDERSCORE, ITALIC_STAR, ITALIC_UNDERSCORE, STRIKETHROUGH, LINK];
const MARKDOWN_HINT = /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s?|```)|\*\*\S|__\S|~~\S|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)/;
function validHref(href: string) {
    if (!href || /[\\\r\n\t]/.test(href) || href.startsWith("//")) return false;
    if (href.startsWith("/") || href.startsWith("#")) return true;
    try {const url = new URL(href); return url.protocol === "https:" && !url.username && !url.password;} catch {return false;}
}
export function insertEventVariable(editor: LexicalEditor, selection: BaseSelection | null, name: string) {
    editor.update(() => {
        if (selection) $setSelection(selection.clone()); else $getRoot().selectEnd();
        const current = $getSelection();
        if ($isRangeSelection(current)) {
            const anchor = current.anchor.getNode();
            const formats = (["bold", "italic", "underline", "strikethrough", "code"] as TextFormatType[]).filter(format => current.hasFormat(format) || $isTextNode(anchor) && anchor.hasFormat(format));
            current.insertNodes([$createEventVariableNode(name, formats), $createTextNode(" ")]);
        } else {
            $getRoot().append($createParagraphNode().append($createEventVariableNode(name)));
        }
    });
}
function Sync({value, emittedRef}: {value: ContentRichText | null; emittedRef: React.RefObject<string | null>}) {
    const [editor] = useLexicalComposerContext();
    useEffect(() => {
        const serialized = value ? JSON.stringify(value) : null;
        if (serialized === emittedRef.current) return;
        emittedRef.current = serialized;
        queueMicrotask(() => {
            try {
                if (serialized) editor.setEditorState(editor.parseEditorState(serialized));
                else editor.update(() => $getRoot().clear().append($createParagraphNode()));
            } catch { /* Preserve editor if a malformed external value slips through. */ }
        });
    }, [editor, value, emittedRef]);
    return null;
}
function Editable({disabled}: {disabled: boolean}) {
    const [editor] = useLexicalComposerContext();
    useEffect(() => editor.setEditable(!disabled), [editor, disabled]);
    return null;
}
function MarkdownPaste() {
    const [editor] = useLexicalComposerContext();
    useEffect(() => editor.registerCommand(PASTE_COMMAND, event => {
        const text = (event as ClipboardEvent).clipboardData?.getData("text/plain") ?? "";
        if (!MARKDOWN_HINT.test(text)) return false;
        event.preventDefault();
        editor.update(() => $getSelection()?.insertNodes($generateNodesFromMarkdownString(text.replace(/\r\n?/g, "\n"), MARKDOWN_TRANSFORMERS)));
        return true;
    }, COMMAND_PRIORITY_LOW), [editor]);
    return null;
}
function Tool({label, active = false, onClick, icon}: {label: string; active?: boolean; onClick: () => void; icon: JSX.Element}) {
    return <EventTooltip content={label}>{id => <button type="button" aria-label={label} aria-describedby={id} aria-pressed={active} className={`event-lexical__tool${active ? " is-active" : ""}`} onMouseDown={event => event.preventDefault()} onClick={onClick}>{icon}</button>}</EventTooltip>;
}
function Menu({label, icon, options, onSelect}: {label: string; icon: JSX.Element; options: {value: string; label: string; icon: JSX.Element}[]; onSelect: (value: string) => void}) {
    return <Dropdown.Root modal={false}><Dropdown.Trigger asChild><button type="button" aria-label={label} className="event-lexical__tool" onMouseDown={event => event.preventDefault()}>{icon}</button></Dropdown.Trigger>
        <Dropdown.Portal><Dropdown.Content className="ib-listbox event-lexical__menu" sideOffset={5} align="start" collisionPadding={12} onCloseAutoFocus={event => event.preventDefault()}>{options.map(option => <Dropdown.Item key={option.value} className="ib-listbox__opt" onSelect={() => onSelect(option.value)}>{option.icon}{option.label}</Dropdown.Item>)}</Dropdown.Content></Dropdown.Portal>
    </Dropdown.Root>;
}
function Toolbar({variables, onInsertVariable, onEditLink}: Pick<EventRichTextEditorProps, "variables" | "onInsertVariable" | "onEditLink">) {
    const [editor] = useLexicalComposerContext();
    const [formats, setFormats] = useState<Set<string>>(new Set());
    const [block, setBlock] = useState("paragraph");
    const [alignment, setAlignment] = useState("left");
    const [linkOpen, setLinkOpen] = useState(false);
    const [link, setLink] = useState("");
    const [variableOpen, setVariableOpen] = useState(false);
    const [search, setSearch] = useState("");
    const saved = useRef<BaseSelection | null>(null);
    const remember = () => editor.getEditorState().read(() => {saved.current = $getSelection()?.clone() ?? null;});
    const restore = (action: () => void) => {const selection = saved.current; if (selection) editor.update(() => $setSelection(selection.clone()), {discrete: true}); action(); editor.focus();};
    useEffect(() => editor.registerCommand(SELECTION_CHANGE_COMMAND, () => {
        editor.getEditorState().read(() => {
            const selection = $getSelection();
            if (!selection) return;
            const variable = selection.getNodes().find($isEventVariableNode);
            if (variable && !$isRangeSelection(selection)) {setFormats(new Set(variable.getFormats())); return;}
            if (!$isRangeSelection(selection)) return;
            setFormats(new Set((["bold", "italic", "underline", "strikethrough", "code"] as TextFormatType[]).filter(format => selection.hasFormat(format))));
            const anchor = selection.anchor.getNode();
            const top = anchor.getKey() === "root" ? anchor : anchor.getTopLevelElementOrThrow();
            if ($isHeadingNode(top)) setBlock(top.getTag());
            else if ($isQuoteNode(top)) setBlock("quote");
            else if ($isCodeNode(top)) setBlock("code");
            else if ($isListNode(top)) setBlock(top.getListType() === "number" ? "ol" : "ul");
            else setBlock("paragraph");
            const format = "getFormat" in top ? (top as {getFormat: () => number}).getFormat() : 0;
            setAlignment(({1: "left", 2: "center", 3: "right", 4: "justify"} as Record<number, string>)[format] ?? "left");
        });
        return false;
    }, COMMAND_PRIORITY_LOW), [editor]);
    const formatText = (format: TextFormatType) => editor.update(() => {
        const changed = $toggleSelectedEventVariableFormat(format);
        if (!changed || $isRangeSelection($getSelection())) editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    });
    const formatBlock = (type: string) => editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        if (type === "paragraph") $setBlocksType(selection, () => $createParagraphNode());
        else if (type === "quote") $setBlocksType(selection, () => $createQuoteNode());
        else if (type === "code") $setBlocksType(selection, () => $createCodeNode());
        else if (type === "h1" || type === "h2" || type === "h3") $setBlocksType(selection, () => $createHeadingNode(type));
    });
    const list = (type: "ol" | "ul") => editor.dispatchCommand(block === type ? REMOVE_LIST_COMMAND : type === "ol" ? INSERT_ORDERED_LIST_COMMAND : INSERT_UNORDERED_LIST_COMMAND, undefined);
    const clear = () => editor.update(() => {const selection = $getSelection(); if ($isRangeSelection(selection)) selection.getNodes().forEach(node => {if (node instanceof TextNode) node.setFormat(0); else if ($isEventVariableNode(node)) node.setFormats([]);});});
    const insertVar = (name: string) => {insertEventVariable(editor, saved.current, name); setVariableOpen(false); setSearch(""); editor.focus();};
    const insertLink = (href: string) => {if (!validHref(href)) return; restore(() => editor.dispatchCommand(TOGGLE_LINK_COMMAND, href)); setLinkOpen(false); setLink("");};
    const headingOptions = [{value: "h1", label: "Заголовок 1", icon: <Heading1 size={16} />}, {value: "h2", label: "Заголовок 2", icon: <Heading2 size={16} />}, {value: "h3", label: "Заголовок 3", icon: <Heading3 size={16} />}];
    const alignmentOptions = [{value: "left", label: "Ліворуч", icon: <AlignLeft size={16} />}, {value: "center", label: "По центру", icon: <AlignCenter size={16} />}, {value: "right", label: "Праворуч", icon: <AlignRight size={16} />}, {value: "justify", label: "По ширині", icon: <AlignJustify size={16} />}];
    const AlignIcon = ({left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify} as const)[alignment as "left" | "center" | "right" | "justify"] ?? AlignLeft;
    return <div className="event-lexical__toolbar-wrap"><div className="event-lexical__toolbar" role="toolbar" aria-label="Форматування тексту">
        <span className="event-lexical__group"><Tool label="Жирний" active={formats.has("bold")} onClick={() => formatText("bold")} icon={<Bold size={16} />} /><Tool label="Курсив" active={formats.has("italic")} onClick={() => formatText("italic")} icon={<Italic size={16} />} /><Tool label="Підкреслений" active={formats.has("underline")} onClick={() => formatText("underline")} icon={<Underline size={16} />} /><Tool label="Закреслений" active={formats.has("strikethrough")} onClick={() => formatText("strikethrough")} icon={<Strikethrough size={16} />} /></span>
        <span className="event-lexical__group"><Menu label="Заголовок" icon={<Heading1 size={16} />} options={headingOptions} onSelect={value => restore(() => formatBlock(value))} /><Tool label="Звичайний абзац" active={block === "paragraph"} onClick={() => formatBlock("paragraph")} icon={<Pilcrow size={16} />} /></span>
        <span className="event-lexical__group"><Menu label="Вирівнювання" icon={<AlignIcon size={16} />} options={alignmentOptions} onSelect={value => restore(() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, value as "left" | "center" | "right" | "justify"))} /></span>
        <span className="event-lexical__group"><Tool label="Маркований список" active={block === "ul"} onClick={() => list("ul")} icon={<List size={16} />} /><Tool label="Нумерований список" active={block === "ol"} onClick={() => list("ol")} icon={<ListOrdered size={16} />} /></span>
        <span className="event-lexical__group"><Tool label="Цитата" active={block === "quote"} onClick={() => formatBlock(block === "quote" ? "paragraph" : "quote")} icon={<Quote size={16} />} /><Tool label="Блок коду" active={block === "code"} onClick={() => formatBlock(block === "code" ? "paragraph" : "code")} icon={<Code2 size={16} />} /><Tool label="Код у рядку" active={formats.has("code")} onClick={() => formatText("code")} icon={<Code size={16} />} /></span>
        <span className="event-lexical__group"><Tool label="Посилання" active={linkOpen} onClick={() => {remember(); if (onEditLink) onEditLink(insertLink); else setLinkOpen(!linkOpen);}} icon={<Link2 size={16} />} /></span>
        <span className="event-lexical__group"><Tool label="Очистити форматування" onClick={clear} icon={<RemoveFormatting size={16} />} /></span>
        {(variables.length > 0 || onInsertVariable) && <span className="event-lexical__group event-lexical__group--end"><Tool label="Вставити змінну" active={variableOpen} onClick={() => {remember(); if (onInsertVariable) onInsertVariable(insertVar); else setVariableOpen(!variableOpen);}} icon={<Braces size={16} />} /></span>}
    </div>
    {linkOpen && <div className="event-lexical__link-input"><input aria-label="Адреса посилання" value={link} placeholder="https://… або /rules" onChange={event => setLink(event.target.value)} onKeyDown={event => {if (event.key === "Enter") insertLink(link);}} /><button type="button" disabled={!validHref(link)} onClick={() => insertLink(link)}>Додати</button></div>}
    {variableOpen && !onInsertVariable && <div className="event-lexical__picker"><input aria-label="Знайти змінну" placeholder="Знайти змінну" value={search} onChange={event => setSearch(event.target.value)} />{variables.filter(variable => `${variable.label} ${variable.name}`.toLocaleLowerCase("uk").includes(search.toLocaleLowerCase("uk"))).map(variable => <button type="button" key={variable.name} onClick={() => insertVar(variable.name)}><strong>{variable.label}</strong><code>{variable.name}</code></button>)}</div>}
    </div>;
}
export function EventRichTextEditor({value, onChange, variables, values, onInsertVariable, onEditLink, dateDisplays, disabled = false, placeholder = "Напишіть текст…", ariaLabel}: EventRichTextEditorProps) {
    const emittedRef = useRef<string | null>(null);
    const handleChange = useCallback((state: EditorState) => {const next = state.toJSON() as unknown as ContentRichText; const serialized = JSON.stringify(next); if (serialized !== emittedRef.current) {emittedRef.current = serialized; onChange(next);}}, [onChange]);
    const labels = Object.fromEntries(variables.map(variable => [variable.name, variable.label]));
    return <EventVariableProvider values={values} labels={labels} dateDisplays={dateDisplays}><LexicalComposer initialConfig={{namespace: "EventRichTextEditor", theme, nodes: eventRichTextNodes, editable: !disabled, onError: error => {throw error;}}}>
        <div className="event-lexical">{!disabled && <Toolbar variables={variables} onInsertVariable={onInsertVariable} onEditLink={onEditLink} />}
            <div className="event-lexical__body"><RichTextPlugin contentEditable={<ContentEditable className="event-lexical__editor" role="textbox" aria-label={ariaLabel} aria-placeholder={placeholder} placeholder={<span className="event-lexical__placeholder">{placeholder}</span>} />} ErrorBoundary={LexicalErrorBoundary} /></div>
            <OnChangePlugin onChange={handleChange} ignoreSelectionChange /><HistoryPlugin /><ListPlugin /><LinkPlugin /><MarkdownPaste /><Editable disabled={disabled} /><Sync value={value} emittedRef={emittedRef} />
        </div>
    </LexicalComposer></EventVariableProvider>;
}
