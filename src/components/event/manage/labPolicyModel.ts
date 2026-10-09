export function parsePolicyNumber(raw: string, min: number, max: number, nullable: boolean): number | null | undefined {
    if (raw.trim() === "") return nullable ? null : undefined;
    const value = Number(raw);
    return Number.isInteger(value) && value >= min && value <= max ? value : undefined;
}
