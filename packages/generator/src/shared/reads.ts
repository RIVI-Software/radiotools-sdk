/** Client reads with no required parameters — safe for simple hooks/composables/stores. */
export const ZERO_ARG_READ_METHODS = [
  "getStation",
  "getCurrentBroadcast",
  "getNowPlaying",
  "getWeather",
  "getTraffic",
] as const;

export type ZeroArgReadMethod = (typeof ZERO_ARG_READ_METHODS)[number];

export function isZeroArgReadMethod(name: string): name is ZeroArgReadMethod {
  return (ZERO_ARG_READ_METHODS as readonly string[]).includes(name);
}

export function hookNameFromMethod(method: ZeroArgReadMethod): string {
  return `use${method.charAt(0).toUpperCase()}${method.slice(1)}`;
}
