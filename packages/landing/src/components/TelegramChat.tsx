import type { ChatMessage, UseCase } from "../types";

interface Props {
  useCase: UseCase;
}

function MessageBubble({
  msg,
  showTimestamp,
}: {
  msg: ChatMessage;
  showTimestamp: boolean;
}) {
  const isUser = msg.role === "user";

  return (
    <div class={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div class="max-w-[76%]">
        <div
          class="px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap rounded-[14px]"
          style={{
            backgroundColor: isUser
              ? "rgba(var(--color-tg-accent-rgb), 0.18)"
              : "#171a20",
            color: "var(--color-page-text-muted)",
            border: isUser
              ? "1px solid rgba(var(--color-tg-accent-rgb), 0.35)"
              : "1px solid #2a2f38",
          }}
        >
          {msg.text}
          {showTimestamp ? (
            <span class="text-[11px] float-right mt-1 ml-1.5 text-[#8f96a3]">
              12:01
            </span>
          ) : null}
        </div>

        {msg.buttons?.map((btn) => (
          <button
            type="button"
            key={btn.label}
            class="mt-1.5 h-8 px-3 inline-flex items-center justify-center rounded-full text-sm font-semibold cursor-default transition-colors"
            style={{
              backgroundColor: "transparent",
              color: "#ff8a3d",
              border: "1px solid #a74f20",
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TelegramChat({ useCase }: Props) {
  return (
    <div
      class="rounded-[18px] overflow-hidden w-full max-w-[420px]"
      style={{
        border: "1px solid #23262d",
        backgroundColor: "#0b0c0f",
      }}
    >
      {/* Header */}
      <div
        class="flex items-center gap-2.5 px-3.5 py-2.5"
        style={{ backgroundColor: "#0b0c0f" }}
      >
        <div class="flex items-center gap-2.5 flex-1 min-w-0">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            class="shrink-0 opacity-60"
            aria-hidden="true"
          >
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>

          <div
            class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
            style={{ background: "var(--color-tg-accent)" }}
          >
            L
          </div>

          <div class="min-w-0">
            <div class="font-semibold text-[13px] truncate">Lobu</div>
            <div class="text-xs font-medium flex items-center gap-1 text-[#8f96a3]">
              <span class="w-1.5 h-1.5 rounded-full bg-[#8f96a3]" />
              <span>online</span>
            </div>
          </div>
        </div>

        <div class="flex opacity-40">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="12" cy="6" r="1.5" fill="currentColor" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            <circle cx="12" cy="18" r="1.5" fill="currentColor" />
          </svg>
        </div>
      </div>

      {/* Messages */}
      <div
        class="flex flex-col px-2.5 py-2.5"
        style={{ backgroundColor: "#0b0c0f" }}
      >
        {useCase.messages.map((msg, i) => {
          const prevMsg = i > 0 ? useCase.messages[i - 1] : undefined;
          const nextMsg =
            i < useCase.messages.length - 1
              ? useCase.messages[i + 1]
              : undefined;
          const isSameSenderAsPrev = prevMsg?.role === msg.role;
          const showTimestamp = nextMsg?.role !== msg.role;

          return (
            <div
              key={`${useCase.id}-${i}`}
              class={i === 0 ? "" : isSameSenderAsPrev ? "mt-0.5" : "mt-2"}
            >
              <MessageBubble msg={msg} showTimestamp={showTimestamp} />
            </div>
          );
        })}
      </div>

      {/* Input bar */}
      <div
        class="flex items-center gap-1.5 px-2.5 py-2"
        style={{
          backgroundColor: "#0b0c0f",
          borderTop: "1px solid #23262d",
        }}
      >
        <div
          class="flex-1 h-[46px] px-3 rounded-full text-[15px] leading-[46px]"
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            color: "#8f96a3",
          }}
        >
          Message
        </div>

        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          class="opacity-40 shrink-0"
          aria-hidden="true"
        >
          <path
            d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>

        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          class="opacity-40 shrink-0"
          aria-hidden="true"
        >
          <rect
            x="9"
            y="2"
            width="6"
            height="12"
            rx="3"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path
            d="M5 10a7 7 0 0014 0M12 19v3m-3 0h6"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
