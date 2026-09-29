"use client";

import type {FormEvent, ReactNode} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {X} from "lucide-react";
import {t} from "@/i18n/t";
import "./invites.css";

// The DS modal (.ib-modal) on Radix: raised fill, hairline, header with the
// close button, body, and actions without a divider. With onSubmit the body
// and the actions form one <form>.
export function ManageDialog({open, onOpenChange, title, description, footer, children, onSubmit, size = "sm"}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: ReactNode;
    footer: ReactNode;
    children: ReactNode;
    onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
    size?: "sm" | "md";
}) {
    const body = <><div className="ib-modal__body">{children}</div><footer className="ib-modal__foot">{footer}</footer></>;
    return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="ib-modal-backdrop event-modal-backdrop">
                <DialogPrimitive.Content className={`ib-modal event-modal${size === "sm" ? " ib-modal--sm" : ""}`} {...(description ? {} : {"aria-describedby": undefined})}>
                    <header className="ib-modal__head">
                        <div><DialogPrimitive.Title className="ib-modal__title">{title}</DialogPrimitive.Title>{description ? <DialogPrimitive.Description className="ib-modal__desc">{description}</DialogPrimitive.Description> : null}</div>
                        <DialogPrimitive.Close className="ib-icon-btn ib-icon-btn--sm ib-modal__close" aria-label={t("common.close")}><X size={16} /></DialogPrimitive.Close>
                    </header>
                    {onSubmit ? <form className="event-modal__form" onSubmit={onSubmit} noValidate>{body}</form> : body}
                </DialogPrimitive.Content>
            </DialogPrimitive.Overlay>
        </DialogPrimitive.Portal>
    </DialogPrimitive.Root>;
}
