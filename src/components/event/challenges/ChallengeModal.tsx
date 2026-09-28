"use client";

import {Download, File} from "lucide-react";
import {challengeAttachmentUrl, type OwnChallenge} from "@/api/participantChallenges";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Badge} from "@/components/ui/badge";
import {FlagSubmit} from "./FlagSubmit";
import {ChallengeDescription} from "./ChallengeDescription";

export function ChallengeModal({challenge, eventID, teamMode, eventFinished, open, onOpenChange, onSubmitted}: {
    challenge: OwnChallenge | null;
    eventID: string;
    teamMode: boolean;
    eventFinished: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmitted: () => void;
}) {
    if (!challenge) return null;
    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] max-w-[min(640px,calc(100vw-24px))] overflow-y-auto">
        <DialogHeader>
            <DialogTitle>{challenge.Snapshot.name}</DialogTitle>
            <div className="flex flex-wrap items-center gap-3 pt-1">
                {challenge.GroupName && <span className="text-sm text-muted-foreground">{challenge.GroupName}</span>}
                <Badge variant="outline" className="font-mono">{challenge.Points}</Badge>
                {challenge.SolvedAt && <Badge variant="outline" className="border-success/40 bg-success/10 text-success">Вирішено</Badge>}
            </div>
        </DialogHeader>
        <ChallengeDescription document={challenge.Snapshot.description} />
        {challenge.Snapshot.attachments.length > 0 && <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Прикріплені файли</h3>
            <div className="flex flex-col gap-2">{challenge.Snapshot.attachments.map(file =>
                <a key={file.file_id} href={challengeAttachmentUrl(eventID, challenge.EventChallengeID, file.file_id)} className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 no-underline hover:border-primary/50">
                    <File className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{file.name}</span>
                    <Download className="size-4 shrink-0 text-primary" aria-hidden="true" />
                </a>)}</div>
        </section>}
        <section><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Здати прапор</h3>
            <FlagSubmit eventID={eventID} challengeID={challenge.EventChallengeID} solved={!!challenge.SolvedAt} eventFinished={eventFinished} teamMode={teamMode} onSubmitted={onSubmitted} />
        </section>
    </DialogContent></Dialog>;
}
