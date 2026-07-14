"use client"

import { useEffect, useState } from "react"
import { useEvent } from "@/hooks/useEvent"
import { useTeam } from "@/hooks/useTeam"
import { ScoreboardVisibilityTypeEnum } from "@/types/event"
import { CountdownTimer } from "@/components/Countdown"
import { Spinner } from "@/components/ui/spinner"
import { ScoreChart } from "./ScoreChart"
import { ScoreTable } from "./ScoreTable"

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[40vh] items-center justify-center">{children}</div>
}
function GateCard({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center">
      <p className="text-lg font-medium text-foreground">{title}</p>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
    </div>
  )
}

// Orchestrator: resolves event/scoreboard-visibility gates, then composes the
// top-5 chart with the full ranking table. Mounted at /scoreboard.
export function ScoreboardView() {
  const { GetEventInfoResponse, GetEventInfoRequest } = useEvent().useGetEventInfo()
  const event = GetEventInfoResponse?.Data
  const now = Date.now()
  const started = !!event && new Date(event.StartTime).getTime() <= now
  const hidden = event?.ScoreboardAvailability === ScoreboardVisibilityTypeEnum.Hidden

  // Re-render each second until the event starts so the gate auto-advances at StartTime.
  const [, forceTick] = useState(0)
  useEffect(() => {
    if (started) return
    const id = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [started])

  const canLoad = started && !hidden
  const { GetScoreResponse, GetScoreRequest } = useEvent().useGetScore({ enabled: canLoad })
  const teams = GetScoreResponse?.Data.TeamsScores ?? []
  const series = (GetScoreResponse?.Data.ActiveChartSeries ?? []).slice(0, 5)

  const { GetTeamResponse } = useTeam().useGetTeam()
  const ownTeamID = GetTeamResponse?.Data?.ID

  // 1. Event loading.
  if (GetEventInfoRequest.isLoading || !event)
    return (
      <Centered>
        <Spinner size="md" className="text-primary" />
      </Centered>
    )
  // 2. Hidden.
  if (hidden)
    return (
      <Centered>
        <GateCard title="Рейтинг приховано організатором" />
      </Centered>
    )
  // 3. Before start.
  if (!started)
    return (
      <Centered>
        <CountdownTimer text="Рейтинг з'явиться після старту" until={new Date(event.StartTime)} />
      </Centered>
    )
  // 4. Score states.
  if (GetScoreRequest.isLoading)
    return (
      <Centered>
        <Spinner size="md" className="text-primary" />
      </Centered>
    )
  if (GetScoreRequest.isError)
    return (
      <Centered>
        <p className="text-sm text-destructive">Не вдалося завантажити рейтинг.</p>
      </Centered>
    )
  if (!teams.length)
    return (
      <Centered>
        <GateCard title="Ще немає результатів" />
      </Centered>
    )

  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      <div className="mb-4 rounded-lg border border-border bg-card p-4">
        <p className="mb-2 text-sm font-semibold text-foreground">Динаміка балів · топ-5</p>
        <ScoreChart series={series} startTime={new Date(event.StartTime)} finishTime={new Date(event.FinishTime)} />
      </div>
      <ScoreTable teams={teams} ownTeamID={ownTeamID} />
    </div>
  )
}
