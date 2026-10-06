import {redirect} from "next/navigation";

// «Профіль балів» is now «Оцінювання» on the challenges «Налаштування» page.
export default function ScoringPage() {
    redirect("/manage/challenge-settings");
}
