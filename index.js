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
  // FYI: https://docs.github.com/ko/actions/learn-github-actions/contexts
  const { context } = Github;

  if (!context.payload) {
    console.error('Invalid payload');
    process.exit(1);
  }

  try {
    console.log(context.payload);
    switch (ACTION_TYPE) {
      case 'schedule':
        await handler.handleSchedule(context.payload);
        break;
      case 'approve':
        await handler.handleApprove(context.payload);
        break;
      case 'comment':
        await handler.handleComment(context.payload);
        break;
      case 'review_requested':
      case 'changes_requested':
        await handler.handleReviewRequested(context.payload);
        break;
      case 'deploy': {
        const ec2Name = Core.getInput('EC2_NAME');
        const imageTag = Core.getInput('IMAGE_TAG');
        const jobStatus = Core.getInput('JOB_STATUS');
        await handler.handleDeploy(context, ec2Name, imageTag, jobStatus);
        break;
      }
      case 'ci': {
        const branchName = Core.getInput('BRANCH_NAME');
        const imageTag = Core.getInput('IMAGE_TAG');
        const jobName = Core.getInput('JOB_NAME');
        const jobStatus = Core.getInput('JOB_STATUS');
        await handler.handleBuild(context, branchName, imageTag, jobName, jobStatus);
        break;
      }
      default:
        console.error('Unknown action type:', ACTION_TYPE);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error executing action:', error);
    process.exit(1);
  }

  console.log('Message sent to Slack!');
}

run();
