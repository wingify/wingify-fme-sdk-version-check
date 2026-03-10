/**
 * Copyright 2026 Wingify Software Pvt. Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { WebClient } from "@slack/web-api";
import { ENV } from "../constants";

/**
 * Best-effort Slack notifier using the Web API (`chat.postMessage`).
 *
 * Requires both:
 * - `SLACK_NOTIFICATIONS_BOT_TOKEN` (preferred) or `SLACK_BOT_TOKEN`
 * - `CHANNEL_ID` or `SLACK_CHANNEL`
 *
 * If credentials are missing, this is a no-op. If the HTTP call fails,
 * the error is logged and the action continues (notifications must not
 * fail the version check).
 */
async function notifySlack(message: string): Promise<void> {
  const botToken =
    process.env[ENV.SLACK_NOTIFICATIONS_BOT_TOKEN] ||
    process.env[ENV.SLACK_BOT_TOKEN];
  const channel = process.env[ENV.CHANNEL_ID] || process.env[ENV.SLACK_CHANNEL];

  if (!botToken || !channel) {
    return;
  }

  try {
    const client = new WebClient(botToken);
    await client.chat.postMessage({
      channel,
      text: message,
    });
  } catch (err: unknown) {
    const axiosLike = err as {
      response?: { status?: number; statusText?: string };
      message?: string;
    };
    const status = axiosLike?.response?.status;
    const statusText = axiosLike?.response?.statusText;
    const errorMessage = axiosLike?.message || "unknown error";
    console.log(
      `Failed to send Slack notification via Web API: ${
        status ? `${status} ${statusText || ""}`.trim() : errorMessage
      }`,
    );
  }
}

export default notifySlack;
