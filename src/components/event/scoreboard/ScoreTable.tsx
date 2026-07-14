import { ITeamScore } from "@/types/event"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import { cn } from "@/utils/cn"

// Ranking table for all teams. Assumes `teams` is already ordered by Rank.
export function ScoreTable({ teams, ownTeamID }: { teams: ITeamScore[]; ownTeamID?: string }) {
  return (
    <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Команда</TableHead>
            <TableHead className="text-right">Розв&apos;язано</TableHead>
            <TableHead className="text-right">Бали</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teams.map((t) => (
            <TableRow
              key={t.TeamID}
              className={cn(ownTeamID && t.TeamID === ownTeamID && "bg-primary/[0.06]")}
            >
              <TableCell className="font-mono text-muted-foreground">{t.Rank}</TableCell>
              <TableCell className="font-medium text-foreground">{t.TeamName}</TableCell>
              <TableCell className="text-right font-mono">{Object.keys(t.TeamSolutions).length}</TableCell>
              <TableCell className="text-right font-mono">{t.Score}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
