import type {ManageResultsSnapshot} from "@/api/manageResults";
import {Table, TableHeader, TableBody, TableRow, TableHead, TableCell} from "@/components/ui/table";
import {cn} from "@/utils/cn";

export function ScoreTable({snapshot, ownTeamID}: {snapshot: ManageResultsSnapshot; ownTeamID?: string}) {
    const solves = new Map<string, number>();
    for (const item of snapshot.Timeline) solves.set(item.EventTeamID, (solves.get(item.EventTeamID) ?? 0) + 1);
    return <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
        <Table>
            <TableHeader><TableRow><TableHead className="w-12">#</TableHead><TableHead>Команда</TableHead><TableHead className="text-right">Розв&apos;язано</TableHead><TableHead className="text-right">Бали</TableHead></TableRow></TableHeader>
            <TableBody>{snapshot.Scoreboard.map(team => <TableRow key={team.TeamID} className={cn(ownTeamID === team.TeamID && "bg-primary/[0.06]")}>
                <TableCell className="font-mono text-muted-foreground">{team.Rank}</TableCell>
                <TableCell className="font-medium text-foreground">{team.TeamName}</TableCell>
                <TableCell className="text-right font-mono">{solves.get(team.TeamID) ?? 0}</TableCell>
                <TableCell className="text-right font-mono">{team.Points}</TableCell>
            </TableRow>)}</TableBody>
        </Table>
    </div>;
}
