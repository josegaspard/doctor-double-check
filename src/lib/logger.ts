/**
 * Conditional logger — silent in production builds.
 * Use instead of `console.*` for diagnostic output that should not leak to end users.
 *
 * Always-on: `logger.error` still emits in production for critical error reporting,
 * but routes through this wrapper so it can be swapped for a remote sink later.
 */

const isDev = import.meta.env.DEV;

type LogArgs = unknown[];

export const logger = {
  log: (...args: LogArgs) => {
    if (isDev) console.log(...args);
  },
  info: (...args: LogArgs) => {
    if (isDev) console.info(...args);
  },
  warn: (...args: LogArgs) => {
    if (isDev) console.warn(...args);
  },
  /** Always logs — production errors should still surface in browser devtools. */
  error: (...args: LogArgs) => {
    console.error(...args);
  },
  /** Dev-only debug helper. */
  debug: (...args: LogArgs) => {
    if (isDev) console.debug(...args);
  },
};

export default logger;
