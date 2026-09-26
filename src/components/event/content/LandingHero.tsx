import Link from "next/link";
import type {PublicEventInfo} from "@/api/publicEventInfo";

const eventDate = new Intl.DateTimeFormat("uk-UA", {day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Kyiv"});

export function LandingHero({event, preview = false}: {event: PublicEventInfo; preview?: boolean}) {
    const start = new Date(event.StartTime);
    const hasStart = !Number.isNaN(start.getTime()) && start.getUTCFullYear() > 1900;
    return <section className="ib-block ib-block-hero ib-mass ib-mass-waves">
        <div className="ib-block__in">
            <p className="ib-block-hero__by">Подія CyberICEBox</p>
            <h1 className="ib-block-hero__title">{event.Name}</h1>
            <div className="ib-block-hero__row">
                <dl className="ib-block-hero__facts">
                    <div><dt>Початок</dt><dd>{hasStart ? eventDate.format(start) : "Час уточнюється"}</dd></div>
                    {event.FinishTime && <div><dt>Завершення</dt><dd>{eventDate.format(new Date(event.FinishTime))}</dd></div>}
                </dl>
                <div className="ib-block-hero__aside"><div className="ib-block-hero__cta">
                    {preview ? <span className="ib-btn ib-btn--mass">До завдань</span> : <Link href="/challenges" className="ib-btn ib-btn--mass">До завдань</Link>}
                </div></div>
            </div>
        </div>
    </section>;
}
