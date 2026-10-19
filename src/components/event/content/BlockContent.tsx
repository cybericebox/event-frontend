import type {ReactNode} from "react";

// A width-constrained block needs its own query container: the page width says
// nothing about the room available to its grid, columns, or timer.
export function BlockContent({constrained, children}: {constrained?: boolean; children: ReactNode}) {
    const content = <div className="ib-block__in">{children}</div>;
    return constrained ? <div className="ib-block-width">{content}</div> : content;
}
