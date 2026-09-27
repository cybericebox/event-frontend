import type {OwnChallenge} from "@/api/participantChallenges";
import {ChallengeCard} from "./ChallengeCard";

export type ChallengeCategory = {ID: string; Name: string; Order: number; Challenges: OwnChallenge[]};

function pluralUk(n: number, one: string, few: string, many: string) {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
}

export function ChallengeCategorySection({category, onOpen}: {category: ChallengeCategory; onOpen: (item: OwnChallenge) => void}) {
    const count = category.Challenges.length;
    return <section className="mb-6">
        <div className="mb-3 flex items-center gap-2.5">
            <h2 className="m-0 text-[15px] font-bold text-foreground">{category.Name}</h2>
            <span className="text-[12.5px] text-muted-foreground">{count} {pluralUk(count, "завдання", "завдання", "завдань")}</span>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {category.Challenges.map(item => <ChallengeCard key={item.ID} challenge={item} onOpen={onOpen} />)}
        </div>
    </section>;
}
