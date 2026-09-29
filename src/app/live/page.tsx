import {LiveBootstrap} from "@/components/event/live/LiveBootstrap";

// Staff under their own session, or a projector PC with a screen link
// (/live#screen=…); participants and guests have the results page.
export default function LivePage() {
    return <LiveBootstrap />;
}
