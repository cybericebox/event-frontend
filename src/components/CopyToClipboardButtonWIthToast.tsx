'use client'

import {Button, ButtonProps, useToast, UseToastOptions} from "@chakra-ui/react";
import React from "react";

async function copyToClipboard(text: string) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (e) {
    }
}

export interface CopyToClipboardButtonProps extends ButtonProps {
    textToCopy: string,
    toastOptions: UseToastOptions
}

export default function CopyToClipboardButtonWithToast({
                                                           children,
                                                           textToCopy,
                                                           toastOptions,
                                                           ...props
                                                       }: CopyToClipboardButtonProps) {
    const toast = useToast()

    const handleCopyClick = () => {
        copyToClipboard(textToCopy).then(
            () => toast({...toastOptions})
        )
    }

    return (
        <div>
            <Button
                onClick={handleCopyClick}
                {...props}
            >
                {children}
            </Button>
        </div>
    )
}