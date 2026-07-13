"use client"

import type { ReactNode } from "react"
import { Download, File } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { FlagSubmit } from "@/components/event/challenges/FlagSubmit"
import { ChallengeSolvedBy } from "@/components/event/challenges/ChallengeSolvedBy"
import type { IChallengeInfo } from "@/types/challenge"

// Small uppercase section caption, matching the prototype's `mLabel` helper
// (e.g. "Прикріплені файли", "Здати прапор").
function SectionLabel({ children }: { children: ReactNode }) {
    return (
        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:mt-0">
            {children}
        </p>
    )
}

// Challenge detail modal: header (name, category, points, solved state) plus a
// "Завдання" tab (description, attached files, flag submission) and a
// "Розв'язали" tab (solver list). Dropped vs the prototype's challengeBody:
// tech-term highlighting, hints, and the flag-format instruction — Description
// renders as a plain paragraph and FlagSubmit owns its own input affordance.
export function ChallengeModal({
    challenge,
    categoryName,
    eventFinished,
    open,
    onOpenChange,
}: {
    challenge: IChallengeInfo | null
    categoryName?: string
    eventFinished: boolean
    open: boolean
    onOpenChange: (o: boolean) => void
}) {
    if (!challenge) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[640px]">
                <DialogHeader>
                    <DialogTitle>{challenge.Name}</DialogTitle>
                    <div className="flex items-center gap-3 pt-1">
                        {categoryName && <span className="text-sm text-muted-foreground">{categoryName}</span>}
                        <Badge variant="outline" className="font-mono">
                            {challenge.Points}
                        </Badge>
                        {challenge.Solved && (
                            <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                                Вирішено
                            </Badge>
                        )}
                    </div>
                </DialogHeader>

                <Tabs defaultValue="task">
                    <TabsList>
                        <TabsTrigger value="task">Завдання</TabsTrigger>
                        <TabsTrigger value="solved">Розв&apos;язали</TabsTrigger>
                    </TabsList>

                    <TabsContent value="task">
                        <p className="text-sm leading-relaxed">{challenge.Description}</p>

                        {challenge.AttachedFiles.length > 0 && (
                            <>
                                <SectionLabel>Прикріплені файли</SectionLabel>
                                <div className="flex flex-col gap-2">
                                    {challenge.AttachedFiles.map((file) => (
                                        // Placeholder anchor — no download endpoint exists yet.
                                        <a
                                            key={file.ID}
                                            href="#"
                                            className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 no-underline"
                                        >
                                            <File className="size-4 shrink-0 text-primary" />
                                            <span className="flex-1 text-sm font-medium text-foreground">{file.Name}</span>
                                            <Download className="size-4 shrink-0 text-primary" />
                                        </a>
                                    ))}
                                </div>
                            </>
                        )}

                        <SectionLabel>Здати прапор</SectionLabel>
                        <FlagSubmit challengeID={challenge.ID} solved={challenge.Solved} eventFinished={eventFinished} />
                    </TabsContent>

                    <TabsContent value="solved">
                        <ChallengeSolvedBy challengeID={challenge.ID} />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
