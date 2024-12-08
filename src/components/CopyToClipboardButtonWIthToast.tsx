'use client'

import React from "react";
import {Button} from "@/components/ui/button";
import {cn} from "@/utils/cn";
import {SuccessToast} from "@/components/customToast";

async function copyToClipboard(text: string) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (e) {
        console.error('Failed to copy: ', e)
    }
}

export interface CopyToClipboardButtonProps {
    textToCopy: string,
    children: React.ReactNode
    toastMessage: string
    className?: string
}

export default function CopyToClipboardButtonWithToast({
                                                           children,
                                                           textToCopy,
                                                              toastMessage,
    className
                                                       }: CopyToClipboardButtonProps) {

    const handleCopyClick = () => {
        copyToClipboard(textToCopy).then(
            () => SuccessToast(toastMessage, {duration: 3000}),
        )
    }

    return (
        <div>
            <Button
                type="button"
                className={cn("text-xs", className)}
                onClick={handleCopyClick}
            >
                {children}
            </Button>
        </div>
    )
}