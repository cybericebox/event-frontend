import {Children, type ReactNode} from "react";
import ReactMarkdown, {type Components} from "react-markdown";
import remarkGfm from "remark-gfm";

export type TextAlignment = "left" | "center" | "right" | "justify";

const alignmentMarker = /^::align=(center|right|justify)::\s*/;

function alignedContent(children: ReactNode): {alignment: TextAlignment; content: ReactNode} {
    const parts = Children.toArray(children);
    const first = parts[0];
    if (typeof first !== "string") return {alignment: "left", content: children};
    const match = first.match(alignmentMarker);
    if (!match) return {alignment: "left", content: children};
    parts[0] = first.slice(match[0].length);
    return {alignment: match[1] as TextAlignment, content: parts};
}

const components: Components = {
    p: ({children}) => {
        const {alignment, content} = alignedContent(children);
        return <p data-align={alignment === "left" ? undefined : alignment} style={alignment === "left" ? undefined : {textAlign: alignment}}>{content}</p>;
    },
    h1: ({children}) => {
        const {alignment, content} = alignedContent(children);
        return <h1 data-align={alignment === "left" ? undefined : alignment} style={alignment === "left" ? undefined : {textAlign: alignment}}>{content}</h1>;
    },
    h2: ({children}) => {
        const {alignment, content} = alignedContent(children);
        return <h2 data-align={alignment === "left" ? undefined : alignment} style={alignment === "left" ? undefined : {textAlign: alignment}}>{content}</h2>;
    },
    h3: ({children}) => {
        const {alignment, content} = alignedContent(children);
        return <h3 data-align={alignment === "left" ? undefined : alignment} style={alignment === "left" ? undefined : {textAlign: alignment}}>{content}</h3>;
    },
};

export function AlignedMarkdown({children}: {children: string}) {
    return <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{children}</ReactMarkdown>;
}
