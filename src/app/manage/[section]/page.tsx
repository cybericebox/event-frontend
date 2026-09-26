import Link from "next/link";
import {notFound} from "next/navigation";
import {plannedManagerPage} from "@/components/event/manage/managerNavigation";

export default async function PlannedManagePage({params}: {params: Promise<{section: string}>}) {
    const {section} = await params;
    const page = plannedManagerPage(section);
    if (!page) notFound();
    return <div className="event-manage-planned">
        <header className="event-manage-heading"><div><h1>{page.title}</h1><p>{page.description}</p></div></header>
        <section className="event-manage-planned__notice" aria-labelledby="planned-title">
            <h2 id="planned-title">Розділ готується</h2>
            <p>Навігація вже доступна. Функції цього розділу з’являться на наступному етапі.</p>
            <Link className="ib-btn" href="/manage">До огляду події</Link>
        </section>
    </div>;
}
