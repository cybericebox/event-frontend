import {redirect} from "next/navigation";

// «Моя команда» moved into «Моя участь»; old links and bookmarks land there.
export default function TeamPage() {
    redirect("/participation");
}
