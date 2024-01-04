const { WebClient } = require('@slack/web-api');
const { Octokit } = require("@octokit/core");
const Core = require("@actions/core");
const Github = require('@actions/github');

const SLACK_TOKEN = Core.getInput("SLACK_TOKEN");
const GITHUB_TOKEN = Core.getInput("GITHUB_TOKEN");
const ACTION_TYPE = Core.getInput("ACTION_TYPE");
const OWNER_REPO = Core.getInput("OWNER_REPO");

const SLACK_FRONTEND_CHANNEL_ID = 'C06B5J3KD8F';
const SLACK_BACKEND_CHANNEL_ID =  'C06C8TLTURE';
const SLACK_SE_CHANNEL_ID = 'C06CS5Q4L8G';

async function run() {
    const web = new WebClient(SLACK_TOKEN);
    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    switch (ACTION_TYPE) {
        case 'approve':
            await handleApprove();
            break;
        case 'comment':
            await handleComment(octokit);
            break;
        default:
            console.log('error');
            break;
    }
    const payload = Github.context.payload;
    const commentId = payload.comment ? payload.comment.id : null;

    console.log("Comment ID:", commentId);
    console.log(payload);
    console.log('Done!!');
}

async function handleApprove() {

}

async function handleComment(octokit) {
    const [owner, repo] = OWNER_REPO.split('/');

    console.log(owner, repo);
    console.log(GITHUB_TOKEN)
    // await octokit.request('GET /repos/{owner}/{repo}/issues/comments', {
    //     type: 'private',
    //     owner: owner,
    //     repo: repo,
    //     headers: {
    //         'X-GitHub-Api-Version': '2022-11-28'
    //     }
    // })
    //     .then((res) => {
    //         const { data } = res;
    //         console.log(data);
    //     });
}


run();
// (async () => {
//     // See: https://api.slack.com/methods/chat.postMessage
//     const res = await web.chat.postMessage({ channel: conversationId, text: 'Hello there' });
//
//     // `res` contains information about the posted message
//     console.log('Message sent: ', res.ts);
// })();
