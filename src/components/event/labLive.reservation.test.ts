import {describe, expect, it} from "vitest";
import {reservationLine} from "./labLive";
import {LabRuntimeSchema} from "@/api/manageLabs";

describe("the team's resource reservation (staff)", () => {
    it("staff line shows the ending time", () => {
        const endsAt = "2026-10-19T15:05:00Z";
        const time = new Date(endsAt).toLocaleTimeString("uk-UA", {hour: "2-digit", minute: "2-digit", hour12: false});
        expect(reservationLine({ReservationEndsAt: endsAt, ReservationEnded: false})).toBe(`Резерв ресурсів закінчується о ${time}: лабораторії буде видалено.`);
        expect(reservationLine({ReservationEndsAt: null, ReservationEnded: true})).toBe("Резерв ресурсів закінчився, лабораторії видалено.");
        expect(reservationLine({ReservationEndsAt: null, ReservationEnded: false})).toBeNull();
    });

    it("participants never see reservation lines", () => {
        // A participant's lab answer has no reservation field: even if one came, it is dropped.
        const lab = LabRuntimeSchema.parse({Lab: null, Phase: "ready", Ready: true, Queue: null, VPNCIDR: "", InternetCIDR: "", Access: [], ReservationEndsAt: "2026-10-19T15:05:00Z", ReservationEnded: true});
        expect(lab).not.toHaveProperty("ReservationEndsAt");
        expect(lab).not.toHaveProperty("ReservationEnded");
    });
});
