"use client";

import {createContext, useContext, type JSX, type ReactNode} from "react";
import {useLexicalNodeSelection} from "@lexical/react/useLexicalNodeSelection";
import {DecoratorNode, $getSelection, $isRangeSelection, type DOMConversionMap, type DOMConversionOutput, type DOMExportOutput, type NodeKey, type SerializedLexicalNode, type Spread, type TextFormatType} from "lexical";
import {formatDateTime} from "../content/dateDisplay";
import {t} from "@/i18n/t";

type Display = {format: "date-time" | "date" | "time" | "short" | "custom"; pattern?: string};
type SerializedEventVariableNode = Spread<{varName: string; formats?: TextFormatType[]}, SerializedLexicalNode>;
type VariableContext = {values: Record<string, string | number | boolean | null>; labels: Record<string, string>; dateDisplays?: Record<string, Display>};

const Context = createContext<VariableContext>({values: {}, labels: {}});

export function EventVariableProvider({children, values, labels = {}, dateDisplays}: VariableContext & {children: ReactNode}) {
    return <Context.Provider value={{values, labels, dateDisplays}}>{children}</Context.Provider>;
}

function EventVariablePreview({name, formats, nodeKey}: {name: string; formats: TextFormatType[]; nodeKey: NodeKey}) {
    const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
    const {values, labels, dateDisplays} = useContext(Context);
    const value = values[name];
    const display = dateDisplays?.[name];
    const rendered = typeof value === "string" && display && !Number.isNaN(Date.parse(value))
        ? formatDateTime(value, display.format, display.pattern)
        : typeof value === "boolean" ? value ? t("common.yes") : t("common.no") : value == null ? labels[name] ?? name : String(value);
    return <span className={`event-lexical__variable${isSelected ? " is-selected" : ""}`} data-event-variable={name} contentEditable={false} title={labels[name] ?? name}
        onMouseDown={event => { event.preventDefault(); clearSelection(); setSelected(true); }}
        style={{fontWeight: formats.includes("bold") ? 700 : undefined, fontStyle: formats.includes("italic") ? "italic" : undefined,
            textDecoration: [formats.includes("underline") ? "underline" : "", formats.includes("strikethrough") ? "line-through" : ""].filter(Boolean).join(" ") || undefined,
            fontFamily: formats.includes("code") ? "monospace" : undefined}}>{rendered}</span>;
}

export class EventVariableNode extends DecoratorNode<JSX.Element> {
    __varName: string;
    __formats: TextFormatType[];

    static getType(): string { return "variable"; }
    static clone(node: EventVariableNode): EventVariableNode { return new EventVariableNode(node.__varName, node.__formats, node.__key); }
    constructor(varName: string, formats: TextFormatType[] = [], key?: NodeKey) {
        super(key);
        this.__varName = varName;
        this.__formats = formats;
    }
    getFormats(): TextFormatType[] { return this.getLatest().__formats; }
    setFormats(formats: TextFormatType[]): this { this.getWritable().__formats = [...new Set(formats)]; return this; }
    getTextContent(): string { return `{{${this.__varName}}}`; }
    createDOM(): HTMLElement { const element = document.createElement("span"); element.contentEditable = "false"; return element; }
    updateDOM(): boolean { return false; }
    isInline(): boolean { return true; }
    isKeyboardSelectable(): boolean { return true; }
    exportDOM(): DOMExportOutput {
        const element = document.createElement("span");
        element.textContent = `{{${this.__varName}}}`;
        element.dataset.variable = this.__varName;
        return {element};
    }
    static importDOM(): DOMConversionMap {
        return {span: (node: Node) => {
            const element = node as HTMLSpanElement;
            if (!element.dataset?.variable) return null;
            return {conversion: (domNode: Node): DOMConversionOutput => ({node: $createEventVariableNode((domNode as HTMLSpanElement).dataset.variable ?? "")}), priority: 1};
        }};
    }
    exportJSON(): SerializedEventVariableNode {
        return {type: "variable", version: 1, varName: this.__varName, ...(this.__formats.length ? {formats: this.__formats} : {})};
    }
    static importJSON(serialized: SerializedEventVariableNode): EventVariableNode {
        return $createEventVariableNode(serialized.varName, serialized.formats ?? []);
    }
    decorate(): JSX.Element { return <EventVariablePreview name={this.__varName} formats={this.__formats} nodeKey={this.__key} />; }
}

export function $createEventVariableNode(name: string, formats: TextFormatType[] = []): EventVariableNode {
    return new EventVariableNode(name, formats);
}

export function $isEventVariableNode(value: unknown): value is EventVariableNode { return value instanceof EventVariableNode; }

export function $toggleSelectedEventVariableFormat(format: TextFormatType): boolean {
    const selection = $getSelection();
    if (!selection || $isRangeSelection(selection) && selection.isCollapsed()) return false;
    const variables = selection.getNodes().filter($isEventVariableNode);
    if (!variables.length) return false;
    const enable = variables.some(node => !node.getFormats().includes(format));
    variables.forEach(node => node.setFormats(enable ? [...node.getFormats(), format] : node.getFormats().filter(item => item !== format)));
    return true;
}
