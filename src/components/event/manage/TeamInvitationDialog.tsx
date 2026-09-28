"use client";

import {useState} from "react";
import {toast} from "react-hot-toast";
import {inviteManageParticipants, type ParticipantInvitationResult} from "@/api/manageParticipants";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {invitationEmails, parseInvitationCsv} from "./participantInvitations";

export function TeamInvitationDialog({eventID, team, onClose, onSent}: {
    eventID: string;
    team: {ID: string; Name: string; InitialEmails?: string[]} | null;
    onClose: () => void;
    onSent: () => Promise<void>;
}) {
    const [manual, setManual] = useState(team?.InitialEmails?.join("\n") ?? "");
    const [csvEmails, setCsvEmails] = useState<string[]>([]);
    const [results, setResults] = useState<ParticipantInvitationResult[]>([]);
    const [busy, setBusy] = useState(false);
    const emails = invitationEmails(manual, csvEmails);

    async function send() {
        if (!team || busy || emails.length === 0 || emails.length > 200) return;
        setBusy(true);
        try {
            const next = await inviteManageParticipants(eventID, emails, team.ID);
            setResults(next);
            const sent = next.filter(result => !result.Error).length;
            if (sent) {
                toast.success(`Надіслано запрошень: ${sent}`);
                try {await onSent();} catch {toast.error("Не вдалося оновити список учасників.");}
            }
            if (sent === next.length) {setManual(""); setCsvEmails([]);}
        } catch {toast.error("Не вдалося надіслати запрошення. Спробуйте ще раз.");}
        finally {setBusy(false);}
    }

    return <Dialog open={!!team} onOpenChange={open => {if (!open && !busy) onClose();}}><DialogContent className="max-h-[90dvh] max-w-[min(560px,calc(100vw-24px))] overflow-y-auto">
        <DialogHeader><DialogTitle>Запросити до команди «{team?.Name}»</DialogTitle><DialogDescription>Вкажіть адреси вручну або додайте CSV. Учасники потраплять до команди після власного підтвердження. Місце перевіряється під час прийняття запрошення.</DialogDescription></DialogHeader>
        <div className="grid gap-4">
            <label className="event-manage-field"><span>Адреси електронної пошти</span><textarea className="event-manage-input" rows={5} value={manual} onChange={event => setManual(event.target.value)} placeholder="Одна адреса на рядок" disabled={busy} /></label>
            <label className="event-manage-field"><span>CSV-файл</span><input className="event-manage-input" type="file" accept=".csv,text/csv" disabled={busy} onChange={async event => {const file = event.target.files?.[0]; if (file) {try {setCsvEmails(parseInvitationCsv(await file.text())); setResults([]);} catch {toast.error("Не вдалося прочитати CSV-файл.");}}}} /><small>Колонка email або перша колонка файлу. До 200 адрес за раз.</small></label>
            <p>Адрес для запрошення: {emails.length}</p>
            {emails.length > 200 && <p className="event-manage-validation" role="alert">За один раз можна запросити не більше 200 учасників.</p>}
            {results.length > 0 && <div role="status" className="grid gap-1">{results.map(result => <p key={result.Email}>{result.Email}: {result.Error || "запрошення надіслано"}</p>)}</div>}
            <div className="event-manage-section__actions"><button className="ib-btn" type="button" disabled={busy} onClick={onClose}>Закрити</button><button className="ib-btn ib-btn--primary" type="button" disabled={busy || emails.length === 0 || emails.length > 200} onClick={() => void send()}>{busy ? "Надсилаємо…" : "Надіслати запрошення"}</button></div>
        </div>
    </DialogContent></Dialog>;
}
