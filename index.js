const { WebClient } = require('@slack/web-api');
const { Octokit } = require('@octokit/rest');
const Core = require('@actions/core');
const Github = require('@actions/github');
const EventHandler = require('./handler/eventHandler');

const SLACK_TOKEN = Core.getInput('SLACK_TOKEN');
const GITHUB_TOKEN = Core.getInput('GITHUB_TOKEN');
const ACTION_TYPE = Core.getInput('ACTION_TYPE');

/**
 * The main function to run the GitHub Action.
 * It initializes the Slack and GitHub clients, and handles different types of GitHub events.
 *
 * @throws Will throw an error and exit the process if there is an issue with the payload or the action type.
 */
async function run() {
  const web = new WebClient(SLACK_TOKEN);
  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  const handler = new EventHandler(octokit, web);

  // Github.context provides the payload of the GitHub event that triggered the action.
  // The structure of the payload object depends on the type of event that triggered the workflow.
  // For instance, for a pull request event, it will contain details about the pull request.
  const { payload } = Github.context;

  if (!payload) {
    console.error('Invalid payload');
    process.exit(1);
  }

  try {
    switch (ACTION_TYPE) {
      case 'approve':
        await handler.handleApprove(payload);
        break;
      case 'comment':
        await handler.handleComment(payload);
        break;
      case 'review_requested':
      case 'changes_requested':
        // await handler.handleReviewRequested(payload);
        break;
      default:
        console.error('Unknown action type:', ACTION_TYPE);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error executing action:', error);
    process.exit(1);
  }

  console.log(payload);
  console.log('Message sent to Slack!');
}

run();
