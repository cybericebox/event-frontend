"use client";

import {ArrowDown, ArrowUp, Plus, Trash2} from "lucide-react";
import type {ManageEmailBlock} from "@/api/manageEmailTemplates";
import {ManageFieldLabel} from "./ManageFieldLabel";
import {emailBlockTitle, emailRichText, emailRichTextBlock, isSimpleEmailRichText} from "./emailBlocks";

export function EmailBlocksEditor({blocks, onChange, disabled}: {
    blocks: ManageEmailBlock[]; onChange: (blocks: ManageEmailBlock[]) => void; disabled: boolean;
}) {
    const update = (index: number, block: ManageEmailBlock) => onChange(blocks.map((item, position) => position === index ? block : item));
    const remove = (index: number) => onChange(blocks.filter((_, position) => position !== index));
    const move = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= blocks.length) return;
        const next = [...blocks]; [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };

    return <div className="event-email-blocks"><div className="event-manage-section__head"><h2>Вміст листа</h2><p>Розташуйте блоки в порядку, в якому їх побачить учасник.</p></div>
        {blocks.length === 0 && <p className="event-manage-notifications__empty">Лист поки порожній. Додайте текст або інший блок.</p>}
        <div className="event-email-blocks__list">{blocks.map((block, index) => <section className="event-email-blocks__item" key={`${block.type}-${index}`}><div className="event-email-blocks__head"><strong>{index + 1}. {emailBlockTitle(block)}</strong><div><button type="button" aria-label={`Перемістити блок ${index + 1} вище`} disabled={disabled || index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></button><button type="button" aria-label={`Перемістити блок ${index + 1} нижче`} disabled={disabled || index === blocks.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></button><button type="button" aria-label={`Видалити блок ${index + 1}`} disabled={disabled} onClick={() => remove(index)}><Trash2 size={16} /></button></div></div>
            {block.type === "rich_text" ? <div className="event-manage-field"><ManageFieldLabel title={`Текст блока ${index + 1}`} help="Між абзацами залиште порожній рядок. Змінні вставляйте у форматі {{event_name}}: під час надсилання вони заміняться даними події й учасника." htmlFor={`event-email-block-${index}`} /><textarea className="event-manage-input" id={`event-email-block-${index}`} rows={Math.max(4, emailRichText(block).split("\n").length + 1)} disabled={disabled || !isSimpleEmailRichText(block)} value={emailRichText(block)} onChange={e => update(index, emailRichTextBlock(e.target.value))} />{!isSimpleEmailRichText(block) && <><small>Цей текст має додаткове форматування.</small>{!disabled && <button className="ib-btn ib-btn--sm" type="button" onClick={() => update(index, emailRichTextBlock(emailRichText(block)))}>Замінити простим текстом</button>}</>}</div> : null}
            {block.type === "button" ? <div className="event-manage-fields-two"><label className="event-manage-field"><span>Текст кнопки</span><input className="event-manage-input" value={String(block.label ?? "")} disabled={disabled} onChange={e => update(index, {...block, label: e.target.value})} /></label><label className="event-manage-field"><span>Посилання</span><input className="event-manage-input" value={String(block.url ?? "")} disabled={disabled} onChange={e => update(index, {...block, url: e.target.value})} placeholder="https://…" /></label></div> : null}
            {block.type === "logo" ? <label className="event-manage-field"><span>Ширина логотипа, пікселі</span><input className="event-manage-input" type="number" min={24} max={400} value={Number(block.width_px ?? 64)} disabled={disabled} onChange={e => update(index, {...block, width_px: Number(e.target.value)})} /></label> : null}
            {block.type === "image" ? <div className="event-manage-fields-two"><label className="event-manage-field"><span>Опис зображення</span><input className="event-manage-input" value={String(block.alt ?? "")} disabled={disabled} onChange={e => update(index, {...block, alt: e.target.value})} /></label><label className="event-manage-field"><span>Ширина, %</span><input className="event-manage-input" type="number" min={10} max={100} value={Number(block.width_pct ?? 100)} disabled={disabled} onChange={e => update(index, {...block, width_pct: Number(e.target.value)})} /></label></div> : null}
            {block.type === "divider" && <p className="event-email-blocks__hint">Горизонтальна лінія між частинами листа.</p>}
            {block.type === "preset" && <p className="event-email-blocks__hint">{String(block.name ?? "Готовий блок із шаблону платформи")}</p>}
            {!(["rich_text", "button", "divider", "logo", "image", "preset"].includes(block.type)) && <p className="event-email-blocks__hint">Цей блок збережено у шаблоні. Його можна перемістити або прибрати.</p>}
        </section>)}</div>
        {!disabled && <div className="event-email-blocks__add"><button className="ib-btn ib-btn--sm" type="button" onClick={() => onChange([...blocks, emailRichTextBlock("")])}><Plus size={15} /> Текст</button><button className="ib-btn ib-btn--sm" type="button" onClick={() => onChange([...blocks, {type: "button", label: "", url: "", align: "left"}])}><Plus size={15} /> Кнопка</button><button className="ib-btn ib-btn--sm" type="button" onClick={() => onChange([...blocks, {type: "divider"}])}><Plus size={15} /> Роздільник</button><button className="ib-btn ib-btn--sm" type="button" onClick={() => onChange([...blocks, {type: "logo", align: "center", width_px: 64}])}><Plus size={15} /> Логотип</button></div>}
    </div>;
}
