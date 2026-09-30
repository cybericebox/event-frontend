import {NotFoundScreen} from "@/components/event/NotFoundScreen";

// A missing page inside the site (Next answers with a real 404). The shell keeps its
// navbar, so the screen centers in the content area. A missing EVENT is EventNotFoundScreen.
export default function NotFound() {
    return <NotFoundScreen block />;
}
