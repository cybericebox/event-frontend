// @vitest-environment jsdom
import {describe, expect, it} from "vitest";
import {createEditor, $createNodeSelection, $createParagraphNode, $createTextNode, $getRoot, $setSelection} from "lexical";
import {$createEventVariableNode, $toggleSelectedEventVariableFormat, EventVariableNode} from "./EventVariableNode";

describe("EventVariableNode", () => {
    it("serializes as the admin Lexical variable shape", () => {
        const editor = createEditor({nodes: [EventVariableNode]});
        editor.update(() => {
            const paragraph = $createParagraphNode();
            paragraph.append($createEventVariableNode("event.name", ["bold"]));
            $getRoot().append(paragraph);
        }, {discrete: true});
        expect(JSON.stringify(editor.getEditorState().toJSON())).toContain('"type":"variable","version":1,"varName":"event.name","formats":["bold"]');
    });

    it("toggles formatting on an atomic variable without changing adjacent text", () => {
        const editor = createEditor({nodes: [EventVariableNode]});
        editor.update(() => {
            const paragraph = $createParagraphNode();
            const variable = $createEventVariableNode("event.name");
            paragraph.append($createTextNode("before"), variable, $createTextNode("after"));
            $getRoot().append(paragraph);
            const selection = $createNodeSelection();
            selection.add(variable.getKey());
            $setSelection(selection);
            $toggleSelectedEventVariableFormat("bold");
            $toggleSelectedEventVariableFormat("bold");
        }, {discrete: true});
        const serialized = JSON.stringify(editor.getEditorState().toJSON());
        expect(serialized).toContain('"varName":"event.name"');
        expect(serialized).not.toContain('"formats":["bold"]');
        expect(serialized).toContain('"text":"before"');
        expect(serialized).toContain('"text":"after"');
    });
});
