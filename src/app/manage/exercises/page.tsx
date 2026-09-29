import {redirect} from "next/navigation";
import {ExercisesSection} from "@/components/event/manage/exercises/ExercisesSection";

export default async function ExercisesPage({searchParams}: {searchParams: Promise<{tab?: string}>}) {
    const {tab} = await searchParams;
    // The hint-unlock log moved to «Журнал спроб».
    if (tab === "unlocks") redirect("/manage/submissions?tab=hints");
    return <ExercisesSection />;
}
