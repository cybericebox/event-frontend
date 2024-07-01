import type React from "react"
import Image from "next/image"
import Link from "next/link"
import logo from '@/app/favicon.ico'


export interface LogoProps {
    width?: number | `${number}` | undefined;
    height?: number | `${number}` | undefined;
    onClick?: () => void;
}


export default function Logo(props: LogoProps) {
    return (
        <Link href="/" onClick={props.onClick}>
            <Image {...props} src={logo} alt="Cyber ICE Box"/>
        </Link>
    )
}