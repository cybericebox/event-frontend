import type React from "react"
import Image from "next/image"
import Link from "next/link"
import logo from '@/app/favicon.ico'
import {t} from "@/i18n/t"


export interface LogoProps {
    width?: number | `${number}` | undefined;
    height?: number | `${number}` | undefined;
    onClick?: () => void;
}


export default function Logo(props: LogoProps) {
    return (
        <Link href="/" onClick={props.onClick}>
            <Image {...props} src={logo} alt={t("meta.brand")}/>
        </Link>
    )
}