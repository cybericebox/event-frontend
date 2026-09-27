import type {ContentBlock} from "../../../types/eventContent";
import type {ContentVariableDefinition} from "../content/variableCatalog";
import {richTextVariableNames, type ContentRichText} from "../content/richTextState";

export function updateBlockRichText(block: ContentBlock, field: string, value: ContentRichText, catalog: ContentVariableDefinition[]): ContentBlock {
    const names = richTextVariableNames(value);
    const existing = block.dateDisplays?.[field];
    const dateDisplays = existing
        ? {...block.dateDisplays, [field]: Object.fromEntries(Object.entries(existing).filter(([name]) => names.has(name)))}
        : block.dateDisplays;
    const added = catalog.filter(variable => names.has(variable.name) && !block.variables?.some(binding => binding.name === variable.name));
    const variables = [...(block.variables ?? []), ...added.map(variable => ({name: variable.name, format: variable.format}))];
    const base = {...block, dateDisplays, variables};
    if (!field.startsWith("item:")) return {...base, richText: value};
    const index = Number(field.split(":")[1]);
    return {...base, items: (base.items ?? []).map((item, position) => position === index ? {...item, richText: value} : item)};
}
