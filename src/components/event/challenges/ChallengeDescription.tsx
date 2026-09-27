import {EventRichTextView} from "../content/EventRichTextView";
import {richTextHasContent} from "../content/richTextState";

export function ChallengeDescription({document}: {document: unknown}) {
    if (!richTextHasContent(document)) return <p className="text-sm text-muted-foreground">Опис завдання відсутній.</p>;
    return <div className="text-sm leading-relaxed text-foreground"><EventRichTextView value={document} /></div>;
}
