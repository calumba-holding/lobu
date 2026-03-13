export function TerminalLog({ fill }: { fill?: boolean }) {
  const lines: { text: string; color: string }[] = [
    { text: "$ lobu dev -d", color: "#4ade80" },
    { text: "[gateway] listening on :8080", color: "#8f96a3" },
    { text: "[gateway] connected to Redis", color: "#8f96a3" },
    { text: "[gateway] Telegram bot connected", color: "#4ade80" },
    { text: "", color: "" },
    {
      text: '[telegram] message from @alex: "What\'s on my calendar today?"',
      color: "#67e8f9",
    },
    { text: "[gateway] spawning worker for chat:482910", color: "#8f96a3" },
    { text: "[worker] session resumed from /workspace", color: "#8f96a3" },
    {
      text: "[worker] calling tool: google-workspace.listEvents",
      color: "#facc15",
    },
    { text: "[worker] sending response (142 tokens)", color: "#4ade80" },
    { text: "[gateway] worker scaled to zero (idle 30s)", color: "#8f96a3" },
  ];

  return (
    <div
      class={`rounded-[18px] overflow-hidden w-full ${fill ? "" : "max-w-[420px]"}`}
      style={{
        border: "1px solid #23262d",
        backgroundColor: "#0b0c0f",
      }}
    >
      {/* Window chrome */}
      <div
        class="flex items-center gap-2 px-3.5 py-2.5"
        style={{ backgroundColor: "#0b0c0f" }}
      >
        <div class="flex items-center gap-1.5 mr-3">
          <span
            class="w-3 h-3 rounded-full"
            style={{ backgroundColor: "#ff5f57" }}
          />
          <span
            class="w-3 h-3 rounded-full"
            style={{ backgroundColor: "#febc2e" }}
          />
          <span
            class="w-3 h-3 rounded-full"
            style={{ backgroundColor: "#28c840" }}
          />
        </div>
        <div class="flex items-center gap-1 text-[11px]">
          <span
            class="px-2.5 py-1 rounded-md"
            style={{ backgroundColor: "#1a1d24", color: "#8f96a3" }}
          >
            my-agent/
          </span>
          <span
            class="px-2.5 py-1 rounded-md"
            style={{ backgroundColor: "#23262d", color: "#c9cdd4" }}
          >
            lobu dev
          </span>
        </div>
      </div>

      {/* Log lines */}
      <div
        class="px-3.5 pb-3.5 pt-1 font-mono text-[12px] leading-[1.7]"
        style={{ backgroundColor: "#0b0c0f" }}
      >
        {lines.map((line) =>
          line.text === "" ? (
            <div key="blank" class="h-3" />
          ) : (
            <div key={line.text} style={{ color: line.color }}>
              {line.text}
            </div>
          )
        )}
      </div>
    </div>
  );
}
