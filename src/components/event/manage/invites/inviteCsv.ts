// CSV import for invitations and team rosters. Columns are matched by their
// English header name (any case, any order); unknown columns are ignored.
// Every issue carries the 1-based file row, so the dialog can say where to fix.

export type CsvIssueCode = "empty" | "missingColumn" | "missingEmail" | "invalidEmail" | "duplicateEmail" | "missingTeam" | "captainMark" | "noCaptain" | "manyCaptains";
export type CsvIssue = {row: number; code: CsvIssueCode; column?: string; value?: string};

export type InviteEntry = {email: string; firstName: string; lastName: string; row?: number};
export type TeamDraft = {name: string; row: number; captainEmail: string; members: InviteEntry[]};

export const inviteColumns = ["email", "first_name", "last_name"] as const;
export const teamColumns = ["team", "email", "first_name", "last_name", "captain"] as const;

// «так» is a data token of the uploaded file, not UI text.
// eslint-disable-next-line no-restricted-syntax -- CSV captain marks matched against uploaded files, not UI text
const captainMarks = new Set(["так", "yes", "true", "1", "+", "x", "х"]);
// eslint-disable-next-line no-restricted-syntax -- CSV captain marks matched against uploaded files, not UI text
const notCaptainMarks = new Set(["", "ні", "no", "false", "0", "-"]);

const emailPattern = /^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()"]+$/;

export function isValidEmail(value: string): boolean {
    return value.length <= 254 && emailPattern.test(value);
}

export function normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
}

type Line = {row: number; cells: string[]};

// Splits CSV text into rows, honouring quotes (with "" escapes and line breaks
// inside quotes). The delimiter is a comma, or a semicolon when the header
// uses semicolons (the Excel export of the uk locale).
export function readCsvLines(source: string): Line[] {
    const text = source.replace(/^\uFEFF/, "");
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const delimiter = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
    const lines: Line[] = [];
    let cells: string[] = [];
    let cell = "";
    let quoted = false;
    let row = 1;
    let rowStart = 1;
    const push = () => {
        cells.push(cell.trim());
        if (cells.some(Boolean)) lines.push({row: rowStart, cells});
        cells = []; cell = "";
    };
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            if (quoted && text[i + 1] === '"') {cell += '"'; i++;}
            else quoted = !quoted;
        } else if (char === delimiter && !quoted) {
            cells.push(cell.trim()); cell = "";
        } else if ((char === "\n" || char === "\r") && !quoted) {
            if (char === "\r" && text[i + 1] === "\n") i++;
            push();
            row++;
            rowStart = row;
        } else {
            if (char === "\n") row++;
            cell += char;
        }
    }
    push();
    return lines;
}

type Table = {rows: Array<{row: number; get: (column: string) => string}>; issues: CsvIssue[]};

function readTable(source: string, required: readonly string[]): Table {
    const lines = readCsvLines(source);
    if (lines.length === 0) return {rows: [], issues: [{row: 1, code: "empty"}]};
    const [header, ...data] = lines;
    const index = new Map<string, number>();
    header.cells.forEach((name, position) => {
        const key = name.trim().toLowerCase();
        if (key && !index.has(key)) index.set(key, position);
    });
    const issues: CsvIssue[] = required.filter(column => !index.has(column)).map(column => ({row: header.row, code: "missingColumn", column}));
    if (issues.length) return {rows: [], issues};
    if (data.length === 0) return {rows: [], issues: [{row: header.row, code: "empty"}]};
    return {
        rows: data.map(line => ({row: line.row, get: (column: string) => {
            const position = index.get(column);
            return position === undefined ? "" : (line.cells[position] ?? "").trim();
        }})),
        issues,
    };
}

// Invitation list: email (required), first_name, last_name.
export function parseInviteCsv(source: string): {entries: InviteEntry[]; issues: CsvIssue[]} {
    const table = readTable(source, ["email"]);
    const issues = [...table.issues];
    const entries: InviteEntry[] = [];
    const seen = new Set<string>();
    for (const line of table.rows) {
        const email = normalizeEmail(line.get("email"));
        if (!email) {issues.push({row: line.row, code: "missingEmail"}); continue;}
        if (!isValidEmail(email)) {issues.push({row: line.row, code: "invalidEmail", value: email}); continue;}
        if (seen.has(email)) continue;
        seen.add(email);
        entries.push({email, firstName: line.get("first_name"), lastName: line.get("last_name"), row: line.row});
    }
    return {entries, issues};
}

// Team roster: team, email (required), first_name, last_name, captain. Rows of
// one team (name compared case-insensitively) form it; exactly one row per
// team carries the captain mark.
export function parseTeamCsv(source: string): {teams: TeamDraft[]; issues: CsvIssue[]} {
    const table = readTable(source, ["team", "email", "captain"]);
    const issues = [...table.issues];
    const teams = new Map<string, TeamDraft & {captainRows: number[]}>();
    const seen = new Map<string, number>();
    for (const line of table.rows) {
        const name = line.get("team");
        const email = normalizeEmail(line.get("email"));
        const mark = line.get("captain").toLowerCase();
        if (!name) {issues.push({row: line.row, code: "missingTeam"}); continue;}
        if (!email) {issues.push({row: line.row, code: "missingEmail"}); continue;}
        if (!isValidEmail(email)) {issues.push({row: line.row, code: "invalidEmail", value: email}); continue;}
        if (seen.has(email)) {issues.push({row: line.row, code: "duplicateEmail", value: email}); continue;}
        seen.set(email, line.row);
        const captain = captainMarks.has(mark);
        if (!captain && !notCaptainMarks.has(mark)) {issues.push({row: line.row, code: "captainMark", value: line.get("captain")}); continue;}
        const key = name.toLowerCase();
        const team = teams.get(key) ?? {name, row: line.row, captainEmail: "", members: [], captainRows: []};
        team.members.push({email, firstName: line.get("first_name"), lastName: line.get("last_name"), row: line.row});
        if (captain) {team.captainRows.push(line.row); team.captainEmail ||= email;}
        teams.set(key, team);
    }
    for (const team of teams.values()) {
        if (team.captainRows.length === 0) issues.push({row: team.row, code: "noCaptain", value: team.name});
        else if (team.captainRows.length > 1) issues.push({row: team.captainRows[1], code: "manyCaptains", value: team.name});
    }
    issues.sort((a, b) => a.row - b.row);
    return {teams: [...teams.values()].map(team => ({name: team.name, row: team.row, captainEmail: team.captainEmail, members: team.members})), issues};
}

export function csvTemplate(columns: readonly string[], example: readonly string[]): string {
    const quote = (value: string) => /[",;\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
    return `\uFEFF${columns.join(",")}\r\n${example.map(quote).join(",")}\r\n`;
}
