import type {ReactNode} from "react";
import "@/styles/error-screen.css";

// The full-page frame of every standalone error screen: a small brand line on top (the platform
// crest and wordmark, or the event logo and name where the event is known) and one compact card
// with the mark, the title, one line and the actions. It is the page's <main>.
export function ErrorPageCard({head, mark, title, body, children, role}: {
    head: ReactNode;
    mark: ReactNode;
    title: string;
    body: ReactNode;
    children?: ReactNode;
    role?: "alert";
}) {
    return <main id="main" className="event-error event-error--page" role={role}>
        <div className="event-error__head">{head}</div>
        <div className="event-error__card">
            {mark}
            <h1>{title}</h1>
            {typeof body === "string" ? <p>{body}</p> : body}
            {children && <div className="event-error__actions">{children}</div>}
        </div>
    </main>;
}
