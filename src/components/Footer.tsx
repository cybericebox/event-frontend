import type React from 'react'

export default function Footer() {
    return (
        <div
            className={"w-full h-full mt-7 mb-2.5 text-[#211a52]"}
        >
            <center>© {new Date().getFullYear()} ХНУРЕ
                {process.env.NEXT_PUBLIC_SHOW_UNIVERSITY === 'true' && (
                    <><br/><a href="https://ice.nure.ua/ua/">За підтримки кафедри ІКІ ім. В. В.
                        Поповського</a><br/>Харківського національного університету радіоелектроніки</>
                )}
            </center>
        </div>
    )
}
