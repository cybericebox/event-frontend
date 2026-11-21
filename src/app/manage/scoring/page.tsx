import {redirect} from "next/navigation";

// “Scoring profile” is now “Scoring” on the challenges “Settings” page.
export default function ScoringPage() {
    redirect("/manage/challenge-settings");
}
