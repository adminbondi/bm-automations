const SLACK_POST_MESSAGE = "https://slack.com/api/chat.postMessage";

interface SlackResponse {
  ok?: boolean;
  error?: string;
}

/** Post one plain-text message to #bm-alerts. Throws when Slack rejects it. */
export async function postSlackMessage(env: Env, text: string): Promise<void> {
  const token = env.SLACK_BOT_TOKEN.trim();
  const channel = env.SLACK_CHANNEL_ID.trim();
  if (!token) throw new Error("SLACK_BOT_TOKEN is not set");
  if (!channel) throw new Error("SLACK_CHANNEL_ID is not set");

  const response = await fetch(SLACK_POST_MESSAGE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel,
      text,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });

  let data: SlackResponse;
  try {
    data = (await response.json()) as SlackResponse;
  } catch {
    throw new Error(`Slack HTTP ${response.status}`);
  }
  if (!data.ok) {
    throw new Error(`Slack chat.postMessage failed (${data.error ?? "unknown"})`);
  }
}
