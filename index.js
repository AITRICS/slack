const { WebClient } = require('@slack/web-api');
const core = require("@actions/core");

// An access token (from your Slack app or custom integration - xoxp, xoxb)
const token = core.getInput("SLACK_TOKEN");

const web = new WebClient(token);

// This argument can be a channel ID, a DM ID, a MPDM ID, or a group ID
const conversationId = 'C068EMH12TX';

(async () => {
    // See: https://api.slack.com/methods/chat.postMessage
    const res = await web.chat.postMessage({ channel: conversationId, text: 'Hello there' });

    // `res` contains information about the posted message
    console.log('Message sent: ', res.ts);
})();
