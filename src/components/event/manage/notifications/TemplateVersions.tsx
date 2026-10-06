"use client";

import {useState} from "react";
import {ChevronDown} from "lucide-react";
import Link from "next/link";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EmptyState} from "@/components/ui/EmptyState";
import {t} from "@/i18n/t";
import {TemplateStatusTag} from "./TemplateStatusTag";

export type VersionRow = {ID: string; Status: "draft" | "published" | "unpublished"; UpdatedAt: string; PublishedAt: string | null; Heading: string};

// «Версії шаблону»: the event's saved versions of one template. A non-draft
// version can be restored as a new draft (the published one stays live until
// the draft is published).
export function TemplateVersions({versions, currentId, hrefFor, canManage, dirty, busy, onRestore}: {
    versions: VersionRow[];
    currentId: string;
    hrefFor: (id: string) => string;
    canManage: boolean;
    dirty: boolean;
    busy: boolean;
    onRestore: (id: string) => Promise<boolean>;
}) {
    const [open, setOpen] = useState(false);
    const [source, setSource] = useState<VersionRow | null>(null);
    const [restoring, setRestoring] = useState(false);
    const [error, setError] = useState(false);

    async function restore() {
        if (!source || restoring || busy) return;
        setRestoring(true);
        setError(false);
        const done = await onRestore(source.ID);
        setRestoring(false);
        if (done) {setSource(null); setOpen(false);} else setError(true);
    }

    const hasDraft = versions.some(version => version.Status === "draft");
    return <>
        <section className="event-template-versions">
            <button className="event-template-versions__toggle" type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>{t("manage.notifications.versions")}<ChevronDown size={16} aria-hidden="true" /></button>
            {open && <div className="event-template-versions__list">
                {versions.length === 0 && <EmptyState compact message={t("manage.notifications.versionsEmpty")} />}
                {versions.map(version => <div className="event-template-versions__row" key={version.ID}>
                    <div><div className="event-template-versions__meta"><TemplateStatusTag status={version.Status} /><time dateTime={version.PublishedAt ?? version.UpdatedAt}>{new Date(version.PublishedAt ?? version.UpdatedAt).toLocaleString("uk-UA")}</time></div><p>{version.Heading}</p></div>
                    {version.ID === currentId ? <span className="event-template-versions__current">{t("manage.notifications.versionCurrent")}</span> : <Link href={hrefFor(version.ID)}>{t("manage.notifications.versionOpen")}</Link>}
                    {canManage && version.Status !== "draft" && <button className="ib-btn ib-btn--sm" type="button" disabled={busy || restoring} onClick={() => {setError(false); setSource(version);}}>{t("manage.notifications.restoreVersion")}</button>}
                </div>)}
            </div>}
        </section>
        <ConfirmDialog open={source !== null} onCancel={() => {if (!restoring) setSource(null);}} busy={restoring} disabled={busy} error={error ? t("manage.notifications.restoreVersionError") : null}
            title={t("manage.notifications.restoreVersionTitle")} description={t(hasDraft ? "manage.notifications.restoreVersionBody" : "manage.notifications.restoreVersionBodyNoDraft")}
            confirmLabel={t("manage.notifications.restoreVersion")} onConfirm={() => void restore()}>
            {dirty && <p className="event-manage-validation">{t("manage.notifications.restoreVersionUnsaved")}</p>}
        </ConfirmDialog>
    </>;
}
