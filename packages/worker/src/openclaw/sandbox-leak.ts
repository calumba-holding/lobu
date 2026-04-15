/**
 * Detects and redacts "sandbox leaks" — cases where the agent presents a
 * local workspace path (or a Claude `sandbox://` URL) as if it were a
 * user-downloadable artifact, without having actually called
 * `UploadUserFile`.
 *
 * Key design decision: we only flag **structural** delivery claims, not
 * free-text mentions. An agent that *describes* workspace paths in a probe
 * or ls-style answer is legitimate; an agent that hands the path to the
 * user as a clickable link or file URL is not. This eliminates the false
 * positives that the previous broad substring check produced.
 */

/**
 * Matches Claude's `sandbox://` file-reference scheme. Any occurrence of
 * this is unambiguously a delivery claim — the scheme exists for exactly
 * that purpose.
 */
const SANDBOX_URL_RE = /\bsandbox:\/{1,2}[^\s)\]}'"<>]+/gi;

/**
 * Matches a markdown link target pointing at a local workspace path, e.g.
 * `[report](/app/workspaces/foo/bar.pdf)` or `[x](file:///workspace/y)`.
 * The capture group is the URL/path portion so we can rewrite it.
 */
const LOCAL_MD_LINK_RE =
  /\]\(\s*((?:file:\/\/)?(?:\/app\/workspaces\/|\/workspace\/)[^\s)]+)\s*\)/gi;

/**
 * Matches HTML `href`/`src` pointing at a local workspace path. Capture
 * group 1 is the attribute name (`href` or `src`) so we can preserve it on
 * redact; capture group 2 is the URL target.
 */
const LOCAL_HREF_RE =
  /\b(href|src)\s*=\s*["']((?:file:\/\/)?(?:\/app\/workspaces\/|\/workspace\/)[^"']+)["']/gi;

export interface LeakCheckResult {
  /** True if the final message makes an unfulfilled file-delivery claim. */
  leaked: boolean;
  /** `finalText` with offending link/URL targets neutralised. Equal to
   * `finalText` when `leaked` is false. */
  redactedText: string;
}

/**
 * Inspect the agent's final user-facing message for unfulfilled file-delivery
 * claims. If `sawUploadedFileEvent` is true (the agent actually called
 * UploadUserFile during this turn), no check is performed — the agent did
 * deliver something, and any remaining path references are assumed
 * descriptive.
 */
export function checkSandboxLeak(
  finalText: string,
  sawUploadedFileEvent: boolean
): LeakCheckResult {
  if (sawUploadedFileEvent || !finalText) {
    return { leaked: false, redactedText: finalText };
  }

  const hasSandboxUrl = SANDBOX_URL_RE.test(finalText);
  const hasMdLink = LOCAL_MD_LINK_RE.test(finalText);
  const hasHref = LOCAL_HREF_RE.test(finalText);

  // Reset lastIndex — `test()` on /g regexes advances state.
  SANDBOX_URL_RE.lastIndex = 0;
  LOCAL_MD_LINK_RE.lastIndex = 0;
  LOCAL_HREF_RE.lastIndex = 0;

  if (!hasSandboxUrl && !hasMdLink && !hasHref) {
    return { leaked: false, redactedText: finalText };
  }

  // Redact: neutralise the link targets so the user doesn't see a broken
  // "clickable" path, but keep the surrounding prose intact.
  let redacted = finalText;
  redacted = redacted.replace(SANDBOX_URL_RE, "[local file, not uploaded]");
  redacted = redacted.replace(LOCAL_MD_LINK_RE, "](about:blank)");
  redacted = redacted.replace(
    LOCAL_HREF_RE,
    (_match, attr: string) => `${attr}="about:blank"`
  );

  const note =
    "\n\n_Note: I referenced a local file but did not actually upload it. " +
    "Ask me to retry and I will use `UploadUserFile` to deliver it._";

  return { leaked: true, redactedText: `${redacted}${note}` };
}
