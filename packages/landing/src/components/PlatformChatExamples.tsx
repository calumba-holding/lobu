/**
 * Renders a full chat-grid showcase for a platform docs page.
 * Picks the right theme for the platform and renders the canonical
 * Lobu chat scenarios (permission, skill install, settings link).
 */

import { PLATFORM_SCENARIOS } from "../chat-scenarios";
import {
  type ChatTheme,
  DISCORD_THEME,
  GCHAT_THEME,
  SampleChat,
  SLACK_THEME,
  TEAMS_THEME,
  TELEGRAM_THEME,
  WHATSAPP_THEME,
} from "./SampleChat";

const THEMES: Record<string, ChatTheme> = {
  telegram: TELEGRAM_THEME,
  slack: SLACK_THEME,
  discord: DISCORD_THEME,
  whatsapp: WHATSAPP_THEME,
  teams: TEAMS_THEME,
  gchat: GCHAT_THEME,
};

interface Props {
  platform: keyof typeof THEMES | string;
}

export function PlatformChatExamples({ platform }: Props) {
  const theme = THEMES[platform] ?? TELEGRAM_THEME;

  return (
    <div class="not-content chat-grid-fullwidth grid gap-6 my-6 md:grid-cols-3">
      {PLATFORM_SCENARIOS.map((scenario) => (
        <SampleChat key={scenario.id} useCase={scenario} theme={theme} />
      ))}
    </div>
  );
}
