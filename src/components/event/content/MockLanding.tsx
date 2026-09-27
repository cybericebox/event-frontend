"use client";

import {useSyncExternalStore} from "react";
import type {EventContent} from "@/types/eventContent";
import {mockLandingSnapshot, readMockLanding} from "@/api/mockLanding";
import {ContentBlocks} from "./ContentBlocks";

const subscribe = () => () => {};

export function MockLanding({initial, eventName, coverImage}: {initial: EventContent; eventName: string; coverImage: string}) {
    const saved = useSyncExternalStore(subscribe, mockLandingSnapshot, () => null);
    const document = saved === null ? initial.Landing : readMockLanding(initial.Landing);
    return <div className="event-landing ib-blocks">
        {document.blocks.length > 0 && !document.blocks.some(block => block.type === "hero") && <h1 className="ib-visually-hidden">{eventName}</h1>}
        <ContentBlocks document={document} variables={initial.Variables} coverImage={coverImage} preview />
    </div>;
}
