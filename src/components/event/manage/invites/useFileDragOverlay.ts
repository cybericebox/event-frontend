"use client";

import {useRef, useState, type DragEvent} from "react";

// Only real file drags (not selected text or links) raise the overlay.
export function isFileDrag(event: DragEvent): boolean {
    return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

// Whole-area file drop: a counter of dragenter/dragleave pairs keeps the
// overlay steady while the pointer crosses child elements; drop, dragend or
// hide() (Esc) end it.
export function useFileDragOverlay(onDrop: (files: File[]) => void, enabled = true) {
    const depth = useRef(0);
    const [active, setActive] = useState(false);

    function hide() { depth.current = 0; setActive(false); }

    const handlers = {
        onDragEnter(event: DragEvent) {
            if (!enabled || !isFileDrag(event)) return;
            event.preventDefault();
            depth.current += 1;
            setActive(true);
        },
        onDragOver(event: DragEvent) {
            if (!enabled || !isFileDrag(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
        },
        onDragLeave(event: DragEvent) {
            if (!enabled || !isFileDrag(event)) return;
            depth.current = Math.max(0, depth.current - 1);
            if (depth.current === 0) setActive(false);
        },
        onDrop(event: DragEvent) {
            if (!enabled || !isFileDrag(event)) return;
            // The picker's own zone handles a drop on it; the dialog takes the rest.
            const handled = event.defaultPrevented && !!(event.target as Element).closest?.(".event-file-drop");
            event.preventDefault();
            hide();
            if (!handled) onDrop(Array.from(event.dataTransfer.files));
        },
        onDragEnd: hide,
    };
    return {active, hide, handlers};
}
