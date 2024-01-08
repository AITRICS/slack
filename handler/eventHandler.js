const findTeamSlugForGithubUser = require('../github/findTeamSlugForGithubUser');
const getGithubNickNameToGitHub = require('../github/getGithubNickNameToGitHub');
const findSlackUserPropertyByGitName = require('../slack/findSlackUserPropertyByGitName');
const SlackMessages = require('../slack/slackMessages');

const GITHUB_TEAM_SLUGS = ['SE', 'Platform-frontend', 'Platform-backend'];
const SLACK_CHANNEL = {
  SE: 'C06CS5Q4L8G',
  'Platform-frontend': 'C06B5J3KD8F',
  'Platform-backend': 'C06C8TLTURE',
  gitAny: 'C06CMAY8066',
};

class EventHandler {
  /**
   * Constructs the EventHandler class.
   * @param {Octokit} octokit - The Octokit instance.
   * @param {WebClient} web - The Slack WebClient instance.
   */
  constructor(octokit, web) {
    this.slackMessages = new SlackMessages(web);
    this.octokit = octokit;
    this.web = web;
  }

  /**
   * Selects the appropriate Slack channel ID based on a GitHub username.
   * @param {string} searchName - The GitHub username.
   * @returns {Promise<string>} The Slack channel ID.
   */
  async #selectSlackChannel(searchName) {
    const teamSlug = await findTeamSlugForGithubUser(this.octokit, searchName, GITHUB_TEAM_SLUGS);
    return teamSlug ? SLACK_CHANNEL[teamSlug] : SLACK_CHANNEL.gitAny;
  }

  /**
   * Retrieves a Slack user property based on a GitHub username.
   * @param {string} searchName - The GitHub username.
   * @param {string} property - The Slack user property to retrieve ('id' or 'realName').
   * @returns {Promise<string>} The Slack user property value.
   */
  async #getSlackUserProperty(searchName, property) {
    const githubNickName = await getGithubNickNameToGitHub(this.octokit, searchName);
    return findSlackUserPropertyByGitName(this.web, githubNickName, property);
  }

  /**
   * Responds to a GitHub comment event by sending a Slack message.
   * @param {object} payload - The payload of the GitHub comment event.
   */
  async handleComment(payload) {
    const commentData = {
      commentUrl: payload.comment?.html_url,
      prOwnerGitName: payload.issue?.user.login ?? payload.pull_request?.user.login,
      prUrl: payload.issue?.html_url ?? payload.pull_request?.html_url,
      commenterGitName: payload.comment?.user.login,
      commentBody: payload.comment?.body,
      prTitle: payload.issue?.title ?? payload.pull_request?.title,
    };

    const channelId = await this.#selectSlackChannel(commentData.prOwnerGitName);
    commentData.ownerSlackId = await this.#getSlackUserProperty(commentData.prOwnerGitName, 'id');
    commentData.commenterSlackRealName = await this.#getSlackUserProperty(commentData.commenterGitName, 'realName');

    if (commentData.commentBody && commentData.commenterGitName && commentData.commentUrl) {
      await this.slackMessages.sendSlackMessageToComment(commentData, channelId);
    }
  }

  async handleApprove(payload) {
    const commentData = {
      commentUrl: payload.review?.html_url,
      prOwnerGitName: payload.pull_request?.user.login,
      prUrl: payload.review?.pull_request_url,
      commenterGitName: payload.review?.user.login,
      commentBody: payload.review?.body,
      prTitle: payload.pull_request?.title,
    };

    const channelId = await this.#selectSlackChannel(commentData.prOwnerGitName);
    commentData.ownerSlackId = await this.#getSlackUserProperty(commentData.prOwnerGitName, 'id');
    commentData.commenterSlackRealName = await this.#getSlackUserProperty(commentData.commenterGitName, 'realName');

    if (commentData.commentBody && commentData.commenterGitName && commentData.commentUrl) {
      await this.slackMessages.sendSlackMessageToApprove(commentData, channelId);
    }
  }

  async handleReviewer(payload) {
    const commentData = {
      commentUrl: payload.review?.html_url,
      prOwnerGitName: payload.pull_request?.user.login,
      prUrl: payload.review?.pull_request_url,
      commenterGitName: payload.review?.user.login,
      commentBody: payload.review?.body,
      prTitle: payload.pull_request?.title,
    };

    const channelId = await this.#selectSlackChannel(commentData.prOwnerGitName);
    commentData.ownerSlackId = await this.#getSlackUserProperty(commentData.prOwnerGitName, 'id');
    commentData.commenterSlackRealName = await this.#getSlackUserProperty(commentData.commenterGitName, 'realName');

    if (commentData.commentBody && commentData.commenterGitName && commentData.commentUrl) {
      await this.slackMessages.sendSlackMessageToApprove(commentData, channelId);
    }
  }
}

module.exports = EventHandler;
