import {
  PUBLIC_SOCKET_PROTOCOL,
  type SdkPublicNowPlaying,
  type SdkPublicOnAir,
  type SdkPublicSchedule,
  type SdkPublicSocketEvent,
  type SdkPublishedRecord,
  sdkSchemas,
} from "./schemas";

export type PublicSocketHandlers = {
  onSchedule?: (data: SdkPublicSchedule) => void;
  onAir?: (data: SdkPublicOnAir | null) => void;
  onNowPlaying?: (data: SdkPublicNowPlaying) => void;
  onContent?: (recordId: string, data: SdkPublishedRecord | null) => void;
  onError?: (error: unknown) => void;
};

export type SubscribePublicSocketOptions = {
  /** Absolute or relative socket URL from `station.resources.socket`. */
  socketUrl: string;
  radioToolsOrigin: string;
  fromDate?: string;
  throughDate?: string;
  handlers: PublicSocketHandlers;
  apiToken: string;
  /** Server adapter that sets Authorization on the WebSocket upgrade. */
  createSocket?: (url: string, headers: Record<string, string>) => WebSocket;
};

export type PublicSocketSubscription = {
  close: () => void;
};

function defaultScheduleWindow(): { fromDate: string; throughDate: string } {
  const from = new Date();
  const fromDate = from.toISOString().slice(0, 10);
  const through = new Date(from);
  through.setUTCDate(through.getUTCDate() + 7);
  return { fromDate, throughDate: through.toISOString().slice(0, 10) };
}

function parsePublicSocketMessage(raw: string): SdkPublicSocketEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = sdkSchemas.PublicSocketEvent.safeParse(json);
  if (!parsed.success || parsed.data.protocol !== PUBLIC_SOCKET_PROTOCOL) return null;
  return parsed.data;
}

function dispatchSocketMessage(message: SdkPublicSocketEvent, handlers: PublicSocketHandlers) {
  switch (message.type) {
    case "schedule":
      handlers.onSchedule?.(message.data);
      return;
    case "on-air":
      handlers.onAir?.(message.data);
      return;
    case "now-playing":
      handlers.onNowPlaying?.(message.data);
      return;
    case "content":
      handlers.onContent?.(message.recordId, message.data);
      return;
    case "preview":
      return;
    default: {
      const unreachable: never = message;
      return unreachable;
    }
  }
}

/**
 * Subscribe to the public station socket.
 * Requires a server WebSocket adapter. Browser pages use a server-side bridge.
 * The listener token is sent as an Authorization header, never in the URL.
 */
export function subscribePublicSocket(
  options: SubscribePublicSocketOptions,
): PublicSocketSubscription {
  if (!options.apiToken?.trim()) throw new Error("Listener API token is required");
  if (!options.createSocket) {
    throw new Error("An authenticated server WebSocket adapter is required");
  }

  const url = new URL(options.socketUrl, options.radioToolsOrigin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const window =
    options.fromDate && options.throughDate
      ? { fromDate: options.fromDate, throughDate: options.throughDate }
      : defaultScheduleWindow();
  url.searchParams.set("fromDate", window.fromDate);
  url.searchParams.set("throughDate", window.throughDate);

  const socket = options.createSocket(url.href, {
    authorization: `Bearer ${options.apiToken}`,
  });

  socket.addEventListener("message", (event) => {
    const data = typeof event.data === "string" ? event.data : String(event.data);
    const message = parsePublicSocketMessage(data);
    if (!message) return;
    dispatchSocketMessage(message, options.handlers);
  });

  socket.addEventListener("error", (error) => {
    options.handlers.onError?.(error);
  });

  return {
    close: () => {
      socket.close();
    },
  };
}
