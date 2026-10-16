"use client";

import type {ReactNode} from "react";
import Link from "next/link";
import {DialogModal} from "../DialogModal";
import {joinResultIcons} from "./JoinResultCard";
import type {JoinOutcome} from "./joinPreviewModel";
import {t} from "@/i18n/t";

// Registration stays over the event landing. A pending or rejected application
// can only close the dialog; team navigation requires an approved application.
export function JoinDialog({outcome, teamMode, onClose, tools, title, resultTitle, resultText, children}: {outcome?: JoinOutcome; teamMode: boolean; onClose: () => void; children?: ReactNode; tools?: ReactNode; title?:string; resultTitle?:string; resultText?:string}) {
    const Icon = outcome ? joinResultIcons[outcome] : null;
    return <DialogModal open onClose={onClose} title={outcome ? resultTitle ?? t(`joinPreview.result.${outcome}.title`) : title ?? t("join.title")} size={outcome ? "sm" : "md"} headerActions={tools}
        footer={outcome ? outcome === "approved"
            ? <Link className="ib-btn ib-btn--primary" href={teamMode ? "/participation?tab=team" : "/participation"}>{t(teamMode ? "join.openTeam" : "nav.participation")}</Link>
            : <button className="ib-btn ib-btn--primary" type="button" onClick={onClose}>{t("join.acknowledge")}</button> : undefined}>
        {outcome && Icon ? <div className={`event-join-dialog__status event-join-result--${outcome}`} role="status"><Icon size={24} aria-hidden="true" /><p>{resultText ?? t(outcome === "approved" ? teamMode ? "join.result.approved.team" : "join.result.approved.individual" : `joinPreview.result.${outcome}.text`)}</p></div> : children}
    </DialogModal>;
}
