import type {ManageResultsSnapshot} from "@/api/manageResults";
import {Table, TableHeader, TableBody, TableRow, TableHead, TableCell} from "@/components/ui/table";
import {cn} from "@/utils/cn";

const time = new Intl.DateTimeFormat("uk-UA", {hour: "2-digit", minute: "2-digit"});

export function ScoreTable({snapshot, ownTeamID, teamMode}: {snapshot: ManageResultsSnapshot; ownTeamID?: string; teamMode: boolean}) {
    return <div className="overflow-auto rounded-lg border border-border">
        <Table>
            <TableHeader><TableRow><TableHead className="w-16">Місце</TableHead><TableHead>{teamMode ? "Команда" : "Учасник"}</TableHead><TableHead className="text-right">Бали</TableHead><TableHead className="text-right">Розв&apos;язано</TableHead><TableHead className="hidden text-right sm:table-cell">Останнє</TableHead></TableRow></TableHeader>
            <TableBody>{snapshot.Scoreboard.map(team => <TableRow key={team.TeamID} className={cn(ownTeamID === team.TeamID && "bg-primary/[0.06] font-semibold")}>
                <TableCell className="font-mono text-muted-foreground">{team.Rank}</TableCell>
                <TableCell className="font-medium text-foreground">{team.TeamName}</TableCell>
                <TableCell className="text-right font-mono">{team.Points}</TableCell>
                <TableCell className="text-right font-mono">{team.Solved}</TableCell>
                <TableCell className="hidden text-right font-mono text-muted-foreground sm:table-cell">{team.LastSolveAt ? time.format(new Date(team.LastSolveAt)) : "—"}</TableCell>
            </TableRow>)}</TableBody>
        </Table>
    </div>;
}
