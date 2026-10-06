import type {Metadata} from "next";

// Management screens are never indexed; the title stays the event name (root layout).
export const metadata: Metadata = {robots: {index: false, follow: false}};

export default function ManageLayout({children}: {children: React.ReactNode}) {
    return children;
}
