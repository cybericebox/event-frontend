export function parseInvitationCsv(source: string): string[] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < source.length; i++) {
        const char = source[i];
        if (char === '"') {
            if (quoted && source[i + 1] === '"') {cell += '"'; i++;}
            else quoted = !quoted;
        } else if ((char === "," || char === ";") && !quoted) {
            row.push(cell.trim()); cell = "";
        } else if ((char === "\n" || char === "\r") && !quoted) {
            if (char === "\r" && source[i + 1] === "\n") i++;
            row.push(cell.trim()); cell = "";
            if (row.some(Boolean)) rows.push(row);
            row = [];
        } else cell += char;
    }
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
    const header = rows[0]?.map(value => value.replace(/^\uFEFF/, "").toLowerCase()) ?? [];
    const emailColumn = header.findIndex(value => ["email", "e-mail", "пошта", "електронна пошта"].includes(value));
    return rows.slice(emailColumn >= 0 ? 1 : 0).map(values => values[emailColumn >= 0 ? emailColumn : 0]?.trim() ?? "").filter(Boolean);
}

export function invitationEmails(manual: string, csv: string[]): string[] {
    return [...new Set([...manual.split(/[\s,;]+/), ...csv].map(value => value.trim().toLowerCase()).filter(Boolean))];
}
