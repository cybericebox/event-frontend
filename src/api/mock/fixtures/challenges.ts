import {z} from "zod";
import {IResponse} from "@/types/api";
import {
    ChallengeCategoryInfoSchema,
    TeamSolutionSchema,
    IChallengeInfoCategoryInfo,
    ITeamSolution,
} from "@/types/challenge";
// The real team schema/type live in `@/types/user` (there is no `@/types/team` file).
import {TeamSchema, ITeam} from "@/types/user";

// A stable UUID helper for fixtures (valid v4 shape; deterministic strings).
const uid = (n: string) => `00000000-0000-4000-8000-${n.padStart(12, "0")}`;

// Correct flags per challenge ID — the mock /solve route checks against these.
export const CORRECT_FLAGS: Record<string, string> = {
    [uid("101")]: "CTF{ice_wall_breached}",
    [uid("102")]: "CTF{frostbite_injection}",
    [uid("201")]: "CTF{glacier_cipher_cracked}",
};

// The `.parse()` call below is the dev assert: a malformed fixture throws loudly at import time.
const categories: IChallengeInfoCategoryInfo[] = z
    .array(ChallengeCategoryInfoSchema)
    .parse([
        {
            ID: uid("1"),
            Name: "Web",
            Challenges: [
                {
                    ID: uid("101"),
                    Name: "IceWall",
                    Points: 100,
                    Solved: false,
                    Description: "Пробий фаєрвол крижаної фортеці та дістань прапор із адмін-панелі.",
                    AttachedFiles: [{ID: uid("1011"), Name: "icewall.zip"}],
                },
                {
                    ID: uid("102"),
                    Name: "SQL Frostbite",
                    Points: 250,
                    Solved: true,
                    Description: "База даних замерзла, але не захищена. Дістань облікові дані адміністратора.",
                    AttachedFiles: [],
                },
            ],
        },
        {
            ID: uid("2"),
            Name: "Crypto",
            Challenges: [
                {
                    ID: uid("201"),
                    Name: "Glacier Cipher",
                    Points: 400,
                    Solved: false,
                    Description: "Стародавній шифр, вкарбований у лід. Розшифруй повідомлення.",
                    AttachedFiles: [{ID: uid("2011"), Name: "cipher.txt"}],
                },
            ],
        },
    ]);

export const challengesFixture: IResponse<IChallengeInfoCategoryInfo[]> = {
    Status: {Code: 200, Message: "OK"},
    Data: categories,
};

// Mock is stateful in dev: a correct /solve flips the challenge to solved
// so a subsequent challenges refetch reflects it (matches real backend).
export function markChallengeSolved(challengeID: string): void {
    for (const category of challengesFixture.Data) {
        const ch = category.Challenges.find((c) => c.ID === challengeID)
        if (ch) { ch.Solved = true; return }
    }
}

const solutions: ITeamSolution[] = z.array(TeamSolutionSchema).parse([
    {ID: uid("9001"), Name: "fr0sty", SolvedAt: new Date(Date.now() - 3600_000).toISOString()},
    {ID: uid("9002"), Name: "ice_wizard", SolvedAt: new Date(Date.now() - 1800_000).toISOString()},
]);

export const solvedByFixture: IResponse<ITeamSolution[]> = {
    Status: {Code: 200, Message: "OK"},
    Data: solutions,
};

// Fill every required field of the real team schema (`TeamSchema` from `@/types/user`):
// `Name` is required; `ID`, `JoinCode`, `CreatedAt` are optional but filled for a realistic fixture.
export const teamFixture: IResponse<ITeam> = {
    Status: {Code: 200, Message: "OK"},
    Data: TeamSchema.parse({
        ID: uid("5001"),
        Name: "Frostbyte",
        JoinCode: "FROST-5001",
        CreatedAt: new Date(Date.now() - 7200_000).toISOString(),
    }),
};
