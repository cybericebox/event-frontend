// Live stream timing shared by the stream hook and the status indicator.
// The server sends a named heartbeat event this often (sse.Heartbeat); a
// stream silent for twice that long is treated as broken.
export const heartbeatEvent = "heartbeat";
export const heartbeatMs = 15_000;
export const staleStreamMs = 2 * heartbeatMs;
