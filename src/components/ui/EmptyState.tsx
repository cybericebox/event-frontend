// The only empty state: one fixed tray icon (same as admin's EmptyState) and a
// message, centered in its block. Only the message changes with context. The
// block has the EventLoading size, so loading → empty never jumps.
export function EmptyState({message, compact = false, className = ""}: {message: string; compact?: boolean; className?: string}) {
    return <div data-empty-state className={`event-block-state${compact ? " event-block-state--compact" : ""} ib-empty${className ? ` ${className}` : ""}`}>
        <span className="ib-empty__icon">
            <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M4.5 5.5h15L21.5 18a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2l2-12.5Z" />
                <path d="M3.5 14h4.7l1.5 2h4.6l1.5-2h4.7" />
            </svg>
        </span>
        <p className="ib-empty__text">{message}</p>
    </div>;
}
