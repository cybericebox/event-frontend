import type {ReactNode} from "react";
import {CircleAlert, Info, TriangleAlert} from "lucide-react";

// ds-v2 banner (components/banner): a full-width row, tone = small icon + tinted background.
export function EventBanner({tone = "info", title, message, meta, action}: {
    tone?: "info" | "warning" | "danger";
    title: ReactNode;
    message?: ReactNode;
    meta?: ReactNode;
    action?: ReactNode;
}) {
    const Icon = tone === "warning" ? TriangleAlert : tone === "danger" ? CircleAlert : Info;
    return <div className={`ib-banner ib-banner--${tone}`} role="status">
        <span className="ib-banner__icon"><Icon aria-hidden="true" /></span>
        <div className="ib-banner__text">
            <span className="ib-banner__title">{title}</span>
            {message && <span className="ib-banner__msg">{message}</span>}
            {meta && <span className="ib-banner__meta">{meta}</span>}
        </div>
        {action && <div className="ib-banner__action">{action}</div>}
    </div>;
}
