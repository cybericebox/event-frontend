import {z} from "zod";
import {requireApiOrigin} from "@/utils/origins";

// The run lengths a test laboratory may take (minutes, shortest first) and the one taken when none is chosen.
const lengthsSchema = z.object({AllowedMinutes: z.array(z.number().int()), DefaultMinutes: z.number().int()});
export type TestRunLengths = z.infer<typeof lengthsSchema>;
export const testRunLengthsKey = ["test-run-lengths"] as const;

export async function getTestRunLengths(): Promise<TestRunLengths> {
    const response = await fetch(`${requireApiOrigin()}/api/exercises/test-runs/lengths`, {credentials: "include", cache: "no-store", headers: {Accept: "application/json"}});
    if (!response.ok) throw new Error(`test run lengths: ${response.status}`);
    return z.object({Data: lengthsSchema}).parse(await response.json()).Data;
}

// The length offered first: the server's default when it is one of the choices, else 1 h, else the shortest.
export function initialLength(lengths: TestRunLengths): number {
    if (lengths.AllowedMinutes.includes(lengths.DefaultMinutes)) return lengths.DefaultMinutes;
    if (lengths.AllowedMinutes.includes(60)) return 60;
    return lengths.AllowedMinutes[0] ?? lengths.DefaultMinutes;
}
