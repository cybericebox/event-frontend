import type {ReactNode} from "react";
import Link from "next/link";
import {ArrowLeft} from "lucide-react";

// The top of a template page, as in admin: back link, name, status and actions.
export function TemplateHeader({backHref, backLabel, title, tag, actions}: {backHref: string; backLabel: string; title: string; tag: ReactNode; actions: ReactNode}) {
    return <div className="event-template-header">
        <Link className="event-template-header__back" href={backHref}><ArrowLeft size={15} aria-hidden="true" /> {backLabel}</Link>
        <div className="event-template-header__title"><h1>{title}</h1>{tag}</div>
        <div className="event-template-header__actions">{actions}</div>
    </div>;
}
