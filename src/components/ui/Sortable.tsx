"use client";

import {useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode} from "react";
import {createPortal} from "react-dom";
import {closestCenter, defaultDropAnimationSideEffects, DndContext, DragOverlay, KeyboardSensor, MeasuringStrategy, PointerSensor, useDndContext, useSensor, useSensors, type Announcements, type CollisionDetection, type DropAnimation, type DragEndEvent, type DragStartEvent, type Modifier, type PointerSensorOptions, type PointerSensorProps, type UniqueIdentifier} from "@dnd-kit/core";
import {SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {dropMove} from "./sortableOrder";
import {t} from "@/i18n/t";
import "./sortable.css";

// Controls inside an item never start a drag; only the item or its handle does.
const controls = "button, a[href], input, textarea, select, label, [role='switch'], [contenteditable='true']";

// A fast drag can release the pointer before its last moves rendered, and the
// drop would then use a stale target. The drop waits until the drag is active
// and its target stayed the same for a frame (at most ten frames). Timers,
// not animation frames: those stop in a background tab.
function settleDrop(context: PointerSensorProps["context"], drop: () => void, frame = 0, lastOver: UniqueIdentifier | null | undefined = undefined) {
    setTimeout(() => {
        const {active, over} = context.current;
        const overID = over?.id ?? null;
        if (frame < 10 && (!active || overID !== lastOver)) settleDrop(context, drop, frame + 1, overID);
        else drop();
    }, 16);
}

class ItemPointerSensor extends PointerSensor {
    constructor(props: PointerSensorProps) {
        super({...props, onEnd: () => settleDrop(props.context, props.onEnd)});
    }

    static activators = [{
        eventName: "onPointerDown" as const,
        handler: (event: ReactPointerEvent, {onActivation}: PointerSensorOptions) => {
            const {nativeEvent} = event;
            if (!nativeEvent.isPrimary || nativeEvent.button !== 0) return false;
            const control = (nativeEvent.target as Element | null)?.closest(controls);
            if (control && control !== event.currentTarget && event.currentTarget.contains(control)) return false;
            onActivation?.({event: nativeEvent});
            return true;
        },
    }];
}

const verticalOnly: Modifier = ({transform}) => ({...transform, x: 0});
// A pointer drag targets the item under the pointer (or the nearest one above
// or below the list), whatever the dragged copy measures; the keyboard moves
// by the item centres.
const pointerRow: CollisionDetection = args => {
    const {pointerCoordinates, droppableRects, droppableContainers} = args;
    if (!pointerCoordinates) return closestCenter(args);
    const {y} = pointerCoordinates;
    return droppableContainers.flatMap(container => {
        const rect = droppableRects.get(container.id);
        if (!rect) return [];
        const value = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
        return [{id: container.id, data: {droppableContainer: container, value}}];
    }).sort((a, b) => a.data.value - b.data.value);
};
const noSubscribe = () => () => {};

// Motion: the other items slide aside and the copy settles into its slot;
// both are off under prefers-reduced-motion.
const motionMilliseconds = 180;
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
    const query = window.matchMedia?.(reducedMotionQuery);
    query?.addEventListener("change", onChange);
    return () => query?.removeEventListener("change", onChange);
}
function useReducedMotion() {
    return useSyncExternalStore(subscribeReducedMotion, () => !!window.matchMedia?.(reducedMotionQuery).matches, () => false);
}
const dropAnimation: DropAnimation = {
    duration: motionMilliseconds,
    easing: "ease",
    sideEffects: defaultDropAnimationSideEffects({styles: {active: {opacity: "0"}}}),
};

/**
 * One vertical sortable list: pointer (after a 4px move, so clicks still
 * work), keyboard (Space, arrows, Space/Escape) and auto-scroll. The dragged
 * item follows the pointer as an overlay; its own slot stays in the list as
 * the drop indicator. `onDragStateChange` fires on start and on drop or cancel,
 * so a list can collapse its items meanwhile: the collapse renders in the
 * same pass as the drag start and the list is measured after it.
 */
export function Sortable({ids, itemName, onMove, onDragStateChange, children}: {
    ids: string[];
    itemName: (id: string) => string;
    onMove: (from: number, to: number) => void;
    onDragStateChange?: (dragging: boolean) => void;
    children: ReactNode;
}) {
    const [activeID, setActiveID] = useState<string | null>(null);
    const reducedMotion = useReducedMotion();
    const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
    const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
    const sensors = useSensors(
        useSensor(ItemPointerSensor, {activationConstraint: {distance: 4}}),
        useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
    );
    const name = (id: UniqueIdentifier) => itemName(String(id));
    const position = (id: UniqueIdentifier | undefined) => id === undefined ? 0 : ids.indexOf(String(id)) + 1;
    const announcements: Announcements = {
        onDragStart: ({active}) => t("ui.sortable.pickedUp", {name: name(active.id), position: position(active.id), count: ids.length}),
        onDragOver: ({active, over}) => over ? t("ui.sortable.movedTo", {name: name(active.id), position: position(over.id), count: ids.length}) : t("ui.sortable.outside", {name: name(active.id)}),
        onDragEnd: ({active, over}) => over ? t("ui.sortable.dropped", {name: name(active.id), position: position(over.id), count: ids.length}) : t("ui.sortable.cancelled", {name: name(active.id)}),
        onDragCancel: ({active}) => t("ui.sortable.cancelled", {name: name(active.id)}),
    };

    function start({active}: DragStartEvent) {
        clearTimeout(settle.current);
        setActiveID(String(active.id));
        onDragStateChange?.(true);
    }
    // Collapsed items reopen once the copy has settled into its slot.
    function finish() {
        setActiveID(null);
        if (reducedMotion) onDragStateChange?.(false);
        else settle.current = setTimeout(() => onDragStateChange?.(false), motionMilliseconds);
    }
    function end({active, over}: DragEndEvent) {
        const move = dropMove(ids, String(active.id), over ? String(over.id) : null);
        if (move) onMove(move.from, move.to);
        finish();
    }

    return <DndContext sensors={sensors} collisionDetection={pointerRow} modifiers={[verticalOnly]}
        measuring={{droppable: {strategy: MeasuringStrategy.Always}}}
        accessibility={{announcements, screenReaderInstructions: {draggable: t("ui.sortable.instructions")}}}
        onDragStart={start} onDragEnd={end} onDragCancel={finish}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext>
        {/* In a portal: a transformed ancestor (a popover) would offset a fixed overlay. */}
        {mounted && createPortal(<DragOverlay className="ib-sortable-overlay" style={{height: "auto"}} dropAnimation={reducedMotion ? null : dropAnimation}>{activeID ? <ActiveClone /> : null}</DragOverlay>, document.body)}
    </DndContext>;
}

// A static copy of the dragged item, taken after the list collapsed. It sits
// in a shallow copy of the list element, so list-scoped styles still apply.
function ActiveClone() {
    const {activeNode} = useDndContext();
    const host = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const list = activeNode?.parentElement;
        if (!host.current || !activeNode || !list) return;
        const frame = list.cloneNode(false) as HTMLElement;
        frame.removeAttribute("id");
        frame.removeAttribute("aria-label");
        frame.classList.add("ib-sortable-overlay__frame");
        const copy = activeNode.cloneNode(true) as HTMLElement;
        // No ids or data attributes: the copy must not match the list's own queries.
        for (const node of [copy, ...copy.querySelectorAll<HTMLElement>("*")]) {
            for (const name of node.getAttributeNames()) if (name === "id" || name.startsWith("data-")) node.removeAttribute(name);
        }
        copy.style.transform = "";
        copy.style.transition = "";
        copy.style.width = `${activeNode.getBoundingClientRect().width}px`;
        frame.appendChild(copy);
        host.current.replaceChildren(frame);
    }, [activeNode]);
    return <div ref={host} aria-hidden="true" inert />;
}

/**
 * An item of the enclosing `Sortable`. Spread `itemProps` on the item and
 * `handleProps` on its grip button; for an item dragged by its whole body,
 * also spread `bodyProps` on the item (keyboard stays on the grip). A
 * disabled item neither moves nor takes a drop (a locked first column).
 */
export function useSortableItem(id: string, disabled = false) {
    const reducedMotion = useReducedMotion();
    const {attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging} = useSortable({
        id, disabled: {draggable: disabled, droppable: disabled}, attributes: {roleDescription: t("ui.sortable.roleDescription")},
        transition: reducedMotion ? null : {duration: motionMilliseconds, easing: "ease"},
    });
    const style: CSSProperties = {transform: CSS.Translate.toString(transform), transition};
    return {
        dragging: isDragging,
        itemProps: {ref: setNodeRef, style, "data-sortable-source": isDragging || undefined},
        handleProps: {ref: setActivatorNodeRef, ...attributes, ...listeners},
        bodyProps: {onPointerDown: listeners?.onPointerDown as ((event: ReactPointerEvent) => void) | undefined},
    };
}
