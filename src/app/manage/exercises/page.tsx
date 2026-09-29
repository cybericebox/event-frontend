import {ExercisesSection} from "@/components/event/manage/exercises/ExercisesSection";

export default async function ExercisesPage({searchParams}: {searchParams: Promise<{tab?: string}>}) {
    const {tab} = await searchParams;
    return <ExercisesSection key={tab ?? "sets"} initialTab={tab} />;
}
