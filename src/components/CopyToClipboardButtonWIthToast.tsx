'use client'

import React from "react";
import {Button} from "@/components/ui/button";
import toast from "react-hot-toast";
import {cn} from "@/utils/cn";

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
            () => toast.success(toastMessage, {duration: 2000}),
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