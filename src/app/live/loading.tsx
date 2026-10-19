import {EventLoading} from "@/components/event/EventLoading";
import {LiveState} from "@/components/event/live/LiveScreen";

// While the server reads the screen link, the hall sees the dark live surface
// with the crest, never the light site shell.
export default function Loading() {
    return <LiveState><EventLoading /></LiveState>;
}
