// Every browser-storage key (localStorage, sessionStorage, cookies) of this app lives here and starts with `cib_`.
// Keys with a scope are built by a function; the scope goes in after an underscore.

export const STORAGE_INBOX_READ = "cib_inbox_read";
export const STORAGE_RETURN_ADMIN = "cib_return_admin";
export const STORAGE_TEAM_JOIN_CODE = "cib_team_join_code";
// When the client token (the anti-abuse cookie) expires; a per-origin convenience, the cookie itself is HttpOnly.
export const STORAGE_CLIENT_TOKEN_EXPIRES = "cib_client_token_expires";
const SITE_BANNER_DISMISSED = "cib_site_banner_dismissed";
const BOARD_VIEW = "cib_board_view";
const MANAGE_SETS_OPEN = "cib_manage_sets_open";
const INTEGRITY_THRESHOLDS = "cib_integrity_thresholds";

export const siteBannerDismissedKey = (id: string | number, version: string | number = ""): string => `${SITE_BANNER_DISMISSED}_${id}_${version}`;
export const boardViewKey = (userID: string | undefined): string => `${BOARD_VIEW}_${userID ?? "guest"}`;
export const manageSetsOpenKey = (eventID: string): string => `${MANAGE_SETS_OPEN}_${eventID}`;
export const integrityThresholdsKey = (eventID: string): string => `${INTEGRITY_THRESHOLDS}_${eventID}`;
