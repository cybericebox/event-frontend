"use client";

import Link from "next/link";
import {unavailableReasonText, type UnavailableImage} from "@/api/manageRegistries";
import {t, tRich} from "@/i18n/t";

// The images of a set that cannot start, each with its reason. Renders nothing when all can.
export function ImageUnavailableNotice({items, canManage}: {items: UnavailableImage[]; canManage: boolean}) {
    if (items.length === 0) return null;
    return <div className="event-exercise-set__warning event-exercise-set__images" role="status">
        <span><strong>{t("manage.registries.unavailable")}</strong></span>
        <ul>{items.map(item => <li key={item.Image}>{tRich("manage.registries.unavailableItem", {image: <code>{item.Image}</code>, reason: unavailableReasonText(item.Reason)})}</li>)}</ul>
        {canManage && <Link className="ib-btn ib-btn--sm" href="/manage/private-registries">{t("manage.registries.addCredentials")}</Link>}
    </div>;
}
