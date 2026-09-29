"use client";

import {TriangleAlert} from "lucide-react";
import {t} from "@/i18n/t";

// Error code carried by an API error (numeric Status.Code first, then the HTTP status).
function errorCode(error: unknown): number | undefined {
    if (!error || typeof error !== "object") return undefined;
    const {code, status} = error as {code?: unknown; status?: unknown};
    if (typeof code === "number") return code;
    return typeof status === "number" && status > 0 ? status : undefined;
}

// The only load-error state inside a page or block: the EventErrorScreen warning mark
// at block scale, a title (the context message), one line of help and «Спробувати ще
// раз». Centered in the EventLoading / EmptyState block, so loading → error never jumps.
// A dead route without the shell uses EventErrorScreen instead.
export function EventLoadError({message = t("error.load.title"), onRetry, error, compact = false, className = ""}: {
    message?: string;
    onRetry?: () => void;
    error?: unknown;
    compact?: boolean;
    className?: string;
}) {
    const code = errorCode(error);
    return <div data-load-error role="alert" className={`event-block-state${compact ? " event-block-state--compact" : ""} ib-empty ib-empty--error${className ? ` ${className}` : ""}`}>
        <span className="ib-empty__icon"><TriangleAlert aria-hidden="true" /></span>
        <p className="ib-empty__text">{message}</p>
        {!compact && <p className="ib-empty__hint">{t("error.load.body")}</p>}
        {code !== undefined && <p className="ib-empty__code">{t("error.load.code", {code})}</p>}
        {onRetry && <div className="ib-empty__action"><button type="button" className={compact ? "ib-btn ib-btn--sm" : "ib-btn"} onClick={onRetry}>{t("error.load.retry")}</button></div>}
    </div>;
}
