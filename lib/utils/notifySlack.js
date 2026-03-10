"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const web_api_1 = require("@slack/web-api");
/**
 * Best-effort Slack notifier.
 *
 * Supports two mechanisms:
 * - Web API `chat.postMessage` using:
 *   - `SLACK_NOTIFICATIONS_BOT_TOKEN` (preferred) or `SLACK_BOT_TOKEN`
 *   - `CHANNEL_ID` or `SLACK_CHANNEL`
 * - Incoming webhook:
 *   - `SLACK_WEBHOOK` env var, or
 *   - `slack_webhook` GitHub Action input (`INPUT_SLACK_WEBHOOK`)
 *
 * If nothing is configured or the HTTP call fails, it logs and returns
 * without failing the action.
 */
async function notifySlack(message) {
    const botToken = process.env.SLACK_NOTIFICATIONS_BOT_TOKEN || process.env.SLACK_BOT_TOKEN;
    const channel = process.env.CHANNEL_ID || process.env.SLACK_CHANNEL;
    // Prefer Web API when token + channel are available
    if (botToken && channel) {
        try {
            const client = new web_api_1.WebClient(botToken);
            await client.chat.postMessage({
                channel,
                text: message,
            });
        }
        catch (err) {
            const status = err?.response?.status;
            const statusText = err?.response?.statusText;
            const errorMessage = err?.message || "unknown error";
            console.log(`Failed to send Slack notification via Web API: ${status ? `${status} ${statusText || ""}`.trim() : errorMessage}`);
        }
        return;
    }
}
exports.default = notifySlack;
