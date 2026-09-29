"use client";

import {useRef, type PointerEvent} from "react";

// Pointer drag of an editor card by its handle, as in the page constructor:
// a header-only ghost follows the pointer, hovering another card
// ([data-editor-block-id]) reorders at once, and onDragStateChange reports
// start and end (drop or cancel) so the list can collapse every card meanwhile.
export function useBlockDrag({blockID, onReorder, onDragStateChange}: {
    blockID: string;
    onReorder: (sourceID: string, targetID: string) => void;
    onDragStateChange?: (dragging: boolean) => void;
}) {
    const pointerID = useRef<number | null>(null);
    const ghost = useRef<HTMLElement | null>(null);
    const offset = useRef({x: 0, y: 0});
    const lastHoverID = useRef("");

    function end() {
        document.removeEventListener("pointerup", end);
        document.removeEventListener("pointercancel", end);
        document.querySelector<HTMLElement>(`[data-editor-block-id="${blockID}"]`)?.classList.remove("is-dragging");
        ghost.current?.remove();
        ghost.current = null;
        lastHoverID.current = "";
        if (pointerID.current !== null) onDragStateChange?.(false);
        pointerID.current = null;
    }

    function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
        if (event.button !== 0) return;
        event.preventDefault();
        const source = event.currentTarget.closest<HTMLElement>("[data-editor-block-id]");
        if (!source) return;
        const bounds = source.getBoundingClientRect();
        offset.current = {x: event.clientX - bounds.left, y: event.clientY - bounds.top};
        const clone = source.cloneNode(true) as HTMLElement;
        clone.removeAttribute("data-editor-block-id");
        clone.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
        clone.querySelectorAll(".event-content-editor__block-error,.event-content-editor__block-body").forEach(node => node.remove());
        clone.classList.remove("is-open");
        clone.classList.add("event-content-editor__drag-ghost");
        clone.setAttribute("aria-hidden", "true");
        clone.style.width = `${bounds.width}px`;
        clone.style.left = `${bounds.left}px`;
        clone.style.top = `${bounds.top}px`;
        document.body.appendChild(clone);
        ghost.current = clone;
        source.classList.add("is-dragging");
        pointerID.current = event.pointerId;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        document.addEventListener("pointerup", end);
        document.addEventListener("pointercancel", end);
        onDragStateChange?.(true);
    }

    function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
        if (pointerID.current !== event.pointerId) return;
        if (ghost.current) {
            ghost.current.style.left = `${event.clientX - offset.current.x}px`;
            ghost.current.style.top = `${event.clientY - offset.current.y}px`;
        }
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-editor-block-id]");
        const targetID = target?.dataset.editorBlockId ?? "";
        if (!targetID || targetID === blockID || targetID === lastHoverID.current) return;
        lastHoverID.current = targetID;
        onReorder(blockID, targetID);
    }

    return {onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end};
}
