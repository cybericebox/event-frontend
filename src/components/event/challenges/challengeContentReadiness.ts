import type {OwnChallenge} from "@/api/participantChallenges";
import type {DescriptionValues} from "./descriptionValues";
import {richTextVariableNames} from "../content/richTextState";
import {hintDocument} from "./hintModel";

// Only content the caller can actually see contributes dependencies. A catalog
// placeholder may be unused, and locked hints must not hold a task closed.
export function challengeContentReadiness(challenge: OwnChallenge, values: DescriptionValues, showHints: boolean, moderatorHints: boolean): "ready" | "preparing" | "unavailable" {
    const names = richTextVariableNames(challenge.Snapshot.description);
    if (showHints && challenge.HintsEnabled) {
        for (const hint of challenge.Hints) {
            if (!hint.Content || !hint.Unlocked && !moderatorHints) continue;
            for (const name of richTextVariableNames(hintDocument(hint.Content))) names.add(name);
        }
    }
    let waiting = false;
    for (const name of names) {
        const placeholder = challenge.Snapshot.placeholders.find(item => item.key === name);
        if (!placeholder || !["vpn.subnet", "internet.subnet", "ip", "external.link"].includes(placeholder.kind)) return "unavailable";
        const staticIP = placeholder.kind === "ip" && placeholder.ip_reference === "static";
        if (placeholder.kind === "ip" && !["vpn", "internet", "static"].includes(placeholder.ip_reference ?? "")) return "unavailable";
        if (placeholder.kind === "external.link" && !placeholder.device_name) return "unavailable";
        const value = values.variables[name];
        if (!value || value === "—") {
            if (staticIP || !challenge.Infrastructure) return "unavailable";
            waiting = true;
        } else if (placeholder.kind === "external.link" || placeholder.as_link) {
            try {
                const url = new URL(value);
                if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return "unavailable";
            } catch {return "unavailable";}
        }
    }
    return waiting ? "preparing" : "ready";
}
