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

  async #getCommentAuthor(owner, repo, commentId) {
    try {
      const response = await this.octokit.rest.pulls.getReviewComment({
        owner,
        repo,
        comment_id: commentId,
      });
      return response.data.user.login;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  /**
   * Responds to a GitHub comment event by sending a Slack message.
   * @param {object} payload - The payload of the GitHub comment event.
   */
  async handleComment(payload) {
    const commentData = {
      commentUrl: payload.comment?.html_url,
      mentionedGitName: payload.issue?.user.login ?? payload.pull_request?.user.login,
      prUrl: payload.issue?.html_url ?? payload.pull_request?.html_url,
      commentAuthorGitName: payload.comment?.user.login,
      commentBody: payload.comment?.body,
      prTitle: payload.issue?.title ?? payload.pull_request?.title,
      commentDiff: payload.comment?.diff_hunk,
    };

    if (payload.comment.in_reply_to_id) {
      const previousCommentAuthor = await this.#getCommentAuthor('aitrics', payload.repository.name, payload.comment.in_reply_to_id);

      if (previousCommentAuthor !== commentData.commentAuthorGitName) {
        // commentData.reviewerGitName = commentData.prOwnerGitName;
        commentData.mentionedGitName = previousCommentAuthor;
      }
    }

    const channelId = await this.#selectSlackChannel(commentData.mentionedGitName);
    commentData.ownerSlackId = await this.#getSlackUserProperty(commentData.mentionedGitName, 'id');
    commentData.reviewerSlackRealName = await this.#getSlackUserProperty(commentData.commentAuthorGitName, 'realName');

    await this.slackMessages.sendSlackMessageToComment(commentData, channelId);
  }

  async handleApprove(payload) {
    const commentData = {
      commentUrl: payload.review?.html_url,
      prOwnerGitName: payload.pull_request?.user.login,
      prUrl: payload.review?.pull_request_url,
      reviewerGitName: payload.review?.user.login,
      commentBody: payload.review?.body,
      prTitle: payload.pull_request?.title,
    };

    const channelId = await this.#selectSlackChannel(commentData.prOwnerGitName);
    commentData.ownerSlackId = await this.#getSlackUserProperty(commentData.prOwnerGitName, 'id');
    commentData.reviewerSlackRealName = await this.#getSlackUserProperty(commentData.reviewerGitName, 'realName');

    await this.slackMessages.sendSlackMessageToApprove(commentData, channelId);
  }

  async handleReviewRequested(payload) {
    const commentData = {
      prOwnerGitName: payload.pull_request?.user.login,
      prUrl: payload.pull_request?.html_url,
      reviewerGitName: payload.requested_reviewer?.login,
      prTitle: payload.pull_request?.title,
    };

    const channelId = await this.#selectSlackChannel(commentData.prOwnerGitName);
    commentData.ownerSlackRealName = await this.#getSlackUserProperty(commentData.prOwnerGitName, 'realName');
    commentData.reviewerSlackId = await this.#getSlackUserProperty(commentData.reviewerGitName, 'id');

    await this.slackMessages.sendSlackMessageToReviewRequested(commentData, channelId);
  }
}

module.exports = EventHandler;
