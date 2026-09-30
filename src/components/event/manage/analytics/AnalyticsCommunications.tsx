"use client";

import {keepPreviousData, useQuery} from "@tanstack/react-query";
import {getAnalyticsCommunications} from "@/api/manageAnalyticsPeople";
import {useManager} from "@/components/event/manage/ManagerShell";
import {ManageTable} from "@/components/event/manage/ManageTable";
import {t} from "@/i18n/t";
import type {ChartState} from "./analyticsModel";
import {AnalyticsBlock, AnalyticsTableExport} from "./AnalyticsBlock";
import {AnalyticsChart} from "./AnalyticsChart";
import {AnalyticsFunnels} from "./AnalyticsFunnels";
import {AnalyticsPage} from "./AnalyticsPage";
import {AnalyticsPeriodFilter} from "./AnalyticsPeriodFilter";
import {AnalyticsStat, AnalyticsStatGrid} from "./AnalyticsStat";
import {useAnalyticsPeriod} from "./useAnalyticsPeriod";
import {commsChartOption, commsHasData, formatRate, notificationTypeLabel} from "./peopleModel";

export const COMMUNICATIONS_POLL_SECONDS = 30;

const number = new Intl.NumberFormat("uk-UA");

// «Комунікації» (§6.7): mail and in-app notifications per type with errors and
// the in-app read rate, and the completion of every event form.
export function AnalyticsCommunications() {
    const {event} = useManager();
    const eventID = event.EventID;
    const filter = useAnalyticsPeriod();
    const query = useQuery({
        queryKey: ["event-analytics-communications", eventID, filter.period.from, filter.period.to],
        queryFn: () => getAnalyticsCommunications(eventID, filter.period),
        refetchInterval: COMMUNICATIONS_POLL_SECONDS * 1000,
        refetchOnWindowFocus: false,
        placeholderData: keepPreviousData,
    });
    const data = query.data;
    const retry = () => void query.refetch();
    const hasData = !!data && commsHasData(data.Totals);
    const chart: ChartState = query.isPending ? "loading" : !data ? "error" : hasData ? "ready" : "empty";
    const tableState = (rows: number) => query.isPending ? "loading" as const : !data ? "error" as const : rows === 0 ? "empty" as const : "ready" as const;
    const totals = data?.Totals;

    return <AnalyticsPage title={t("manage.analytics.section.communications.title")} description={t("manage.analytics.section.communications.description")}
        filter={<AnalyticsPeriodFilter period={filter} open />}>
        {totals && <AnalyticsStatGrid label={t("manage.analytics.stats.label")}>
            <AnalyticsStat label={t("manage.analytics.comms.stat.emails")} value={number.format(totals.EmailSent)} note={t("manage.analytics.comms.stat.errorsNote", {count: totals.EmailErrors})} hint={t("manage.analytics.comms.stat.emailsHint")} />
            <AnalyticsStat label={t("manage.analytics.comms.stat.inApp")} value={number.format(totals.InAppSent)} note={t("manage.analytics.comms.stat.errorsNote", {count: totals.InAppErrors})} hint={t("manage.analytics.comms.stat.inAppHint")} />
            <AnalyticsStat label={t("manage.analytics.comms.stat.readRate")} value={formatRate(totals.ReadRate)} note={t("manage.analytics.comms.stat.readNote", {read: totals.InAppRead, total: totals.InAppCreated})} hint={t("manage.analytics.comms.stat.readRateHint")} />
        </AnalyticsStatGrid>}

        {data?.Funnels && <AnalyticsFunnels funnels={data.Funnels} />}

        <AnalyticsBlock title={t("manage.analytics.comms.chart.title")} subtitle={t("manage.analytics.comms.chart.subtitle")} hint={t("manage.analytics.comms.chart.hint")}>
            <AnalyticsChart event={event} state={chart} option={hasData && data ? commsChartOption(data.Types) : undefined} height={340}
                ariaLabel={t("manage.analytics.comms.chart.title")} loadingLabel={t("manage.analytics.chart.loading")} errorMessage={t("manage.analytics.chart.loadFailed")}
                emptyMessage={t("manage.analytics.comms.chart.empty")} onRetry={retry} error={query.error} />
        </AnalyticsBlock>

        <AnalyticsBlock title={t("manage.analytics.comms.types.title")} subtitle={t("manage.analytics.comms.types.subtitle")} hint={t("manage.analytics.comms.types.hint")}
            actions={<AnalyticsTableExport eventID={eventID} section="communications" table="types" period={filter.period} disabled={!data || data.Types.length === 0} />}>
            <div className="event-analytics-people__table">
                <ManageTable event={event} state={tableState(data?.Types.length ?? 0)} loadingLabel={t("manage.analytics.comms.types.loading")} errorMessage={t("manage.analytics.comms.types.loadFailed")} onRetry={retry} error={query.error} emptyMessage={t("manage.analytics.comms.types.empty")}
                    head={<tr>
                        <th scope="col">{t("manage.analytics.comms.types.col.type")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.comms.types.col.emailSent")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.comms.types.col.emailErrors")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.comms.types.col.inAppSent")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.comms.types.col.inAppErrors")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.comms.types.col.read")}</th>
                    </tr>}>
                    <tbody>{(data?.Types ?? []).map(row => <tr key={row.Type}>
                        <td><div className="event-manage-table__person"><strong>{notificationTypeLabel(row.Type)}</strong>{row.Type && <small>{row.Type}</small>}</div></td>
                        <td className="ib-num">{number.format(row.EmailSent)}</td>
                        <td className="ib-num">{number.format(row.EmailErrors)}</td>
                        <td className="ib-num">{number.format(row.InAppSent)}</td>
                        <td className="ib-num">{number.format(row.InAppErrors)}</td>
                        <td className="ib-num">{row.InAppCreated > 0 ? `${number.format(row.InAppRead)} / ${number.format(row.InAppCreated)} (${formatRate(row.ReadRate)})` : "—"}</td>
                    </tr>)}</tbody>
                </ManageTable>
            </div>
        </AnalyticsBlock>

        <AnalyticsBlock title={t("manage.analytics.comms.forms.title")} subtitle={t("manage.analytics.comms.forms.subtitle")} hint={t("manage.analytics.comms.forms.hint")}
            actions={<AnalyticsTableExport eventID={eventID} section="communications" table="forms" period={filter.period} disabled={!data || data.Forms.length === 0} />}>
            <div className="event-analytics-people__table event-analytics-people__table--short">
                <ManageTable event={event} state={tableState(data?.Forms.length ?? 0)} loadingLabel={t("manage.analytics.comms.forms.loading")} errorMessage={t("manage.analytics.comms.forms.loadFailed")} onRetry={retry} error={query.error} emptyMessage={t("manage.analytics.comms.forms.empty")}
                    head={<tr>
                        <th scope="col">{t("manage.analytics.comms.forms.col.form")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.comms.forms.col.assigned")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.comms.forms.col.completed")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.comms.forms.col.rate")}</th>
                        <th scope="col" className="ib-num">{t("manage.analytics.comms.forms.col.answers")}</th>
                    </tr>}>
                    <tbody>{(data?.Forms ?? []).map(form => <tr key={form.ID}>
                        <td><div className="event-manage-table__person"><strong>{form.Title}</strong>{(form.Registration || !form.Enabled) && <small>{form.Registration ? t("manage.analytics.comms.forms.registration") : t("manage.analytics.comms.forms.disabled")}</small>}</div></td>
                        <td className="ib-num">{form.Registration && form.Assigned === 0 ? "—" : number.format(form.Assigned)}</td>
                        <td className="ib-num">{form.Registration && form.Assigned === 0 ? "—" : number.format(form.Completed)}</td>
                        <td className="ib-num">{formatRate(form.CompletionRate)}</td>
                        <td className="ib-num">{number.format(form.Answers)}</td>
                    </tr>)}</tbody>
                </ManageTable>
            </div>
        </AnalyticsBlock>
    </AnalyticsPage>;
}
