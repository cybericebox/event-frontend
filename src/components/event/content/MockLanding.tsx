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
        <ContentBlocks document={document} variables={initial.Variables} title={eventName} coverImage={coverImage} preview />
    </div>;
}
