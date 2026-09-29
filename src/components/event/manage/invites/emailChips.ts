import {isValidEmail, normalizeEmail, type InviteEntry} from "./inviteCsv";

export type EmailChip = {email: string; firstName: string; lastName: string; valid: boolean};

// Typing or pasting splits addresses on comma, semicolon, spaces and newlines.
export const addressSeparator = /[\s,;]+/;

export function splitAddresses(text: string): string[] {
    return text.split(addressSeparator).map(normalizeEmail).filter(Boolean);
}

// Adds entries as chips: addresses are compared case-insensitively, a repeat
// only fills names the existing chip lacks, and invalid addresses stay as
// (red) chips so the user sees what to fix.
export function addChips(chips: EmailChip[], entries: Array<Pick<InviteEntry, "email"> & Partial<InviteEntry>>): EmailChip[] {
    const next = [...chips];
    const index = new Map(next.map((chip, position) => [chip.email, position]));
    for (const entry of entries) {
        const email = normalizeEmail(entry.email);
        if (!email) continue;
        const position = index.get(email);
        if (position !== undefined) {
            const chip = next[position];
            next[position] = {...chip, firstName: chip.firstName || entry.firstName?.trim() || "", lastName: chip.lastName || entry.lastName?.trim() || ""};
            continue;
        }
        index.set(email, next.length);
        next.push({email, firstName: entry.firstName?.trim() ?? "", lastName: entry.lastName?.trim() ?? "", valid: isValidEmail(email)});
    }
    return next;
}

export function chipName(chip: Pick<EmailChip, "firstName" | "lastName">): string {
    return `${chip.firstName} ${chip.lastName}`.trim();
}

export function validChips(chips: EmailChip[]): EmailChip[] {
    return chips.filter(chip => chip.valid);
}
