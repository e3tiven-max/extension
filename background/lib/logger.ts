// Ignore the no-console lint rule since this file is meant to funnel output to
// the console.
/* eslint-disable no-console */

enum LogLevel {
  debug = "debug",
  log = "log",
  info = "info",
  warn = "warn",
  error = "error",
}

interface LogStyle {
  icon: string
  css: string[]
  dateCss?: string[]
}

interface LogStyles {
  debug: LogStyle & { dateCss: string[] }
  log: LogStyle
  info: LogStyle
  warn: LogStyle
  error: LogStyle
}

const styles: LogStyles = {
  debug: {
    icon: "🐛",
    css: [],
    dateCss: ["float: right"],
  },
  log: {
    icon: "🪵",
    css: [],
  },
  info: {
    icon: "💡",
    css: ["color: blue"],
  },
  warn: {
    icon: "⚠️",
    css: [
      "color: #63450b",
      "background-color: #fffbe5",
      "border: 1px solid #fff5c2",
      "padding: 0.5em",
    ],
  },
  error: {
    icon: "❌",
    css: [
      "color: #ff1a1a",
      "background-color: #fff0f0",
      "border: 1px solid #ffd6d6",
      "padding: 0.5em",
    ],
  },
}

function purgeSensitiveFailSafe(log: string): string {
  // 1. Hexadecimal segments
  // 2. Private key length segments
  // 3. Lowercase groups of 12 words, which therefore covers 24

  return `${log} `.replaceAll(
    /(0x(\S+))|(\b[a-zA-Z0-9]{64}\b)|((?:[a-z]+\s){12})/g,
    "[REDACTED]"
  )
}

function saveLog(
  logLabel: string,
  input: unknown[],
  stackTrace: string[] | undefined
) {
  localStorage.setItem(
    "logs",
    `${(localStorage.getItem("logs") ?? "").slice(
      -50000
    )}${purgeSensitiveFailSafe(`${logLabel}\n${input}\n${stackTrace}`)}\n\n`
  )
}

const BLINK_PREFIX = "    at "
const WEBKIT_GECKO_DELIMITER = "@"
const WEBKIT_MARKER = "@"
const GECKO_MARKER = "/"

function logLabelFromStackEntry(
  stackEntry: string | undefined
): string | undefined {
  // Blink-ish.
  if (stackEntry?.startsWith(BLINK_PREFIX)) {
    // "    at [Class.][function] (... source file ...)
    return stackEntry.substring(BLINK_PREFIX.length).split(" ")[0]
  }

  // Fall back to Gecko-ish.
  if (
    stackEntry?.includes(GECKO_MARKER) &&
    stackEntry.includes(WEBKIT_GECKO_DELIMITER)
  ) {
    // "[path/to/Class/]method<?[/internal<?]@(... source file ...)"
    return stackEntry
      .split(WEBKIT_GECKO_DELIMITER)[0]
      .split(GECKO_MARKER)
      .filter((item) => item.replace(/(?:promise)?</, "").trim() !== "")
      .slice(-2)
      .join(".")
  }

  // WebKit-ish.
  if (stackEntry?.includes(WEBKIT_MARKER)) {
    // "[function]@(... source ...)
    return stackEntry.split(WEBKIT_MARKER)[0]
  }

  return undefined
}

function genericLogger(level: LogLevel, input: unknown[]) {
  const stackTrace = new Error().stack
    ?.split("\n")
    ?.filter((line) => {
      // Remove empty lines from the output
      // Chrome prepends the word "Error" to the first line of the trace, but Firefox doesn't
      // Let's ignore that for consistency between browsers!
      if (line.trim() === "" || line.trim() === "Error") {
        return false
      }

      return true
    })
    // The first two lines of the stack trace will always be generated by this
    // file, so let's ignore them.
    ?.slice(2)

  const logLabel =
    logLabelFromStackEntry(stackTrace?.[0]) ?? "(unknown function)"
  const [logDate, logTime] = new Date().toISOString().split(/T/)

  console.group(
    `%c ${styles[level].icon} [${logTime.replace(
      /Z$/,
      ""
    )}] ${logLabel} %c [${logDate}]`,
    styles[level].css.join(";"),
    styles[level].dateCss ?? styles.debug.dateCss.join(";")
  )

  console[level](...input)

  // Suppress displaying stack traces when we use console.error(), since the browser already does that
  if (typeof stackTrace !== "undefined" && level !== "error") {
    console[level](stackTrace.join("\n"))
  }

  console.groupEnd()

  saveLog(logLabel, input, stackTrace)
}

const logger = {
  debug(...input: unknown[]): void {
    genericLogger(LogLevel.debug, input)
  },

  log(...input: unknown[]): void {
    genericLogger(LogLevel.log, input)
  },

  info(...input: unknown[]): void {
    genericLogger(LogLevel.info, input)
  },

  warn(...input: unknown[]): void {
    genericLogger(LogLevel.warn, input)
  },

  error(...input: unknown[]): void {
    genericLogger(LogLevel.error, input)
  },
}

export default logger
