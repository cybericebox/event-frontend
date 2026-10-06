"use client";

import {useState} from "react";
import toast from "react-hot-toast";
import {Copy} from "lucide-react";
import type {OwnTeam, Participation} from "@/api/clientAuth";
import {joinLinkExpiries, type JoinLinkExpiry} from "@/api/eventTeams";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EventSelect} from "@/components/ui/EventSelect";
import {t} from "@/i18n/t";
import {Card} from "./participationBlocks";
import {joinLink, joinLinkValidity, rosterStatusLine} from "./participationModel";

// «Перевипустити»: the old link stops working; the captain picks how long the new one lives.
function RegenerateLinkDialog({open, onClose, onRegenerate}: {open: boolean; onClose: () => void; onRegenerate: (expiry: JoinLinkExpiry) => Promise<void>}) {
    const [expiry, setExpiry] = useState<JoinLinkExpiry>("none");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    return <ConfirmDialog open={open} onCancel={() => { if (!busy) { setError(""); onClose(); } }} busy={busy} error={error}
        title={t("participation.team.link.regenerateTitle")} description={t("participation.team.link.regenerateText")} confirmLabel={t("participation.team.link.regenerate")}
        onConfirm={async () => {
            setBusy(true);
            setError("");
            try { await onRegenerate(expiry); onClose(); } catch (failure) { setError(failure instanceof Error ? failure.message : ""); } finally { setBusy(false); }
        }}>
        <div className="ib-field"><span className="ib-field__label">{t("participation.team.link.expiry")}</span>
            <EventSelect ariaLabel={t("participation.team.link.expiry")} value={expiry} onValueChange={value => setExpiry(value as JoinLinkExpiry)} disabled={busy}
                options={joinLinkExpiries.map(value => ({value, label: t(`participation.team.link.expiry.${value}`)}))} />
        </div>
    </ConfirmDialog>;
}

// The invitation block. The captain shares the link (copy, expiry, reissue); a member is told how to ask the captain.
export function InviteCard({team, captain, captainName, participation, rosterOpen, canManage, preview, now, onRegenerate}: {
    team: OwnTeam; captain: boolean; captainName: string; participation: Participation | null; rosterOpen: boolean; canManage: boolean; preview: boolean; now: number;
    onRegenerate: (expiry: JoinLinkExpiry) => Promise<void>;
}) {
    const [regenerating, setRegenerating] = useState(false);
    const rosterLine = rosterStatusLine(participation, rosterOpen);
    if (!captain) return <Card title={t("participation.invite.title")}>
        <div className="event-pp-invite">
            <p className="event-pp-invite__note">{captainName ? t("participation.invite.memberNote", {name: captainName}) : t("participation.invite.memberNoteAnon")}</p>
            <p className="event-pp-invite__note">{rosterLine}</p>
        </div>
    </Card>;
    const link = joinLink(window.location.origin, team.JoinCode);
    const validity = joinLinkValidity(team.JoinCodeExpiresAt, now);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            toast.success(t("participation.team.link.copied"));
        } catch { toast.error(t("participation.team.link.copyFailed")); }
    };
    return <Card title={t("participation.invite.title")} note={t("participation.invite.note")}>
        <div className="event-pp-invite">
            <div className="event-pp-invite__row">
                <input className="ib-input ib-input--mono" readOnly value={link} aria-label={t("participation.team.link.label")} onFocus={event => event.currentTarget.select()} />
                <button type="button" className="ib-btn" onClick={() => void copy()}><Copy aria-hidden="true" />{t("participation.team.link.copy")}</button>
                {canManage && (preview
                    ? <EventTooltip content={t("participation.preview.unavailable")}>{id => <span style={{display: "inline-flex"}} tabIndex={0} aria-describedby={id}><button type="button" className="ib-btn ib-btn--ghost" disabled style={{pointerEvents: "none"}}>{t("participation.team.link.regenerate")}</button></span>}</EventTooltip>
                    : <button type="button" className="ib-btn ib-btn--ghost" onClick={() => setRegenerating(true)}>{t("participation.team.link.regenerate")}</button>)}
            </div>
            <div className="event-pp-invite__meta">
                <div className={validity.expired ? "is-warn" : undefined}>{validity.text}</div>
                <div>{rosterLine}</div>
            </div>
        </div>
        <RegenerateLinkDialog open={regenerating} onClose={() => setRegenerating(false)} onRegenerate={async expiry => {
            if (preview) { toast(t("participation.preview.noChanges")); return; }
            await onRegenerate(expiry);
        }} />
    </Card>;
}
