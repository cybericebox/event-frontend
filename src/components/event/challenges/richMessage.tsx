import {Fragment, type ReactNode} from "react";

// Renders a translated message whose `{name}` placeholders are React nodes
// (styled numbers, links). Pass the result of t()/tPlural() without those vars:
// unknown placeholders survive interpolation and are filled here.
export function richMessage(message: string, nodes: Record<string, ReactNode>): ReactNode {
    return message.split(/(\{\w+\})/).map((part, index) => {
        const name = /^\{(\w+)\}$/.exec(part)?.[1];
        return <Fragment key={index}>{name !== undefined && name in nodes ? nodes[name] : part}</Fragment>;
    });
}
