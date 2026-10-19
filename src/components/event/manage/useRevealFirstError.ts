import {useEffect, useState, type RefObject} from "react";

// After a submit on an incomplete form shows its errors, moves to the first invalid control inside `container`
// (or the first control of an invalid group). Call the returned function together with the state change that
// shows the errors: the move happens once that render is on screen.
export function useRevealFirstError(container: RefObject<HTMLElement | null>): () => void {
    const [request, setRequest] = useState(0);
    useEffect(() => {
        if (!request) return;
        const invalid = container.current?.querySelector<HTMLElement>("[aria-invalid='true']");
        const target = invalid?.matches("input,textarea,[contenteditable='true'],[tabindex]") ? invalid : invalid?.querySelector<HTMLElement>("input,textarea,button,[contenteditable='true'],[tabindex]");
        target?.scrollIntoView?.({block: "center"});
        target?.focus();
    }, [request, container]);
    return () => setRequest(current => current + 1);
}
