const { Octokit } = require('@octokit/rest');
const { getGithubNickNameToGitHub, getCommentAuthor, findTeamSlugForGithubUser } = require('../github/githubUtils');
const getSlackUserList = require('../slack/getSlackUserList');
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

  async getPRReviewersWithStatus(octokit, members, owner, repo, pr) {
    const prNumber = pr.number;
    const reviewsResponse = await octokit.rest.pulls.listReviews({
      owner,
      repo,
      pull_number: prNumber,
    });

    const prDetails = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    // 리뷰를 제출한 리뷰어들의 상태와 Slack ID를 저장합니다.
    const reviewersPromises = reviewsResponse.data.map(async (review) => {
      const slackId = await this.#getSlackUserProperty(members, review.user.login, 'id');
      return { slackId: `@${slackId}`, state: review.state };
    });

    const reviewersResults = await Promise.all(reviewersPromises);
    const submittedReviewers = reviewersResults.reduce((acc, { slackId, state }) => {
      acc[slackId] = state;
      return acc;
    }, {});

    // 리뷰를 요청받은 리뷰어들의 Slack ID를 가져옵니다.
    const requestedReviewersPromises = prDetails.data.requested_reviewers.map(async (reviewer) => {
      const slackId = await this.#getSlackUserProperty(members, reviewer.login, 'id');
      return slackId;
    });

    const requestedReviewers = await Promise.all(requestedReviewersPromises);

    requestedReviewers.forEach((slackId) => {
      if (!(slackId in submittedReviewers)) {
        submittedReviewers[slackId] = 'AWAITING';
      }
    });

    return submittedReviewers;
  }

  async getPendingReviewPRs(octokit, members, owner, repo) {
    try {
      const response = await octokit.rest.pulls.list({
        owner,
        repo,
        state: 'open',
      });

      const nonDraftPRs = response.data.filter((pr) => !pr.draft);

      const prsDetails = await Promise.all(nonDraftPRs.map(async (pr) => {
        const reviewersStatus = await this.getPRReviewersWithStatus(octokit, members, owner, repo, pr);
        const teamSlug = await findTeamSlugForGithubUser(octokit, pr.user.login, GITHUB_TEAM_SLUGS);

        return { ...pr, reviewersStatus, teamSlug };
      }));

      return prsDetails;
    } catch (error) {
      console.error('Error fetching PRs:', error);
      throw error;
    }
  }

  /**
   * Selects the appropriate Slack channel ID based on a GitHub username.
   * @param {string} searchName - The GitHub username.
   * @returns {Promise<string>} The Slack channel ID.
   */
  async #selectSlackChannel(searchName) {
    if (!searchName) {
      console.error('(#selectSlackChannel) Invalid searchName: must be a non-empty string.');
      return null;
    }

    const teamSlug = await findTeamSlugForGithubUser(this.octokit, searchName, GITHUB_TEAM_SLUGS);
    return teamSlug ? SLACK_CHANNEL[teamSlug] : SLACK_CHANNEL.gitAny;
  }

  /**
   * Finds a specific property of a Slack user by matching their real name or display name with the given GitHub username.
   * @param {Array} members - The list of Slack users.
   * @param {string} searchName - The GitHub username to search for in Slack user profiles.
   * @param {string} property - The property to retrieve from the Slack user ('id' or 'realName').
   * @returns {string} The requested property of the found Slack user or the searchName if no user is found.
   * @throws Will throw an error if the Slack API request fails.
   */
  static #findSlackUserPropertyByGitName(members, searchName, property) {
    const cleanedSearchName = searchName.replace(/[^a-zA-Z]/g, '').toLowerCase();

    const user = members.find(({ real_name: realName, profile }) => {
      const nameToCheck = [realName, profile.display_name].map((name) => name?.toLowerCase());
      return nameToCheck.some((name) => name?.includes(cleanedSearchName));
    });

    if (user) {
      if (property === 'id') {
        return user.id;
      }
      if (property === 'realName') {
        return user.profile.display_name;
      }
    }

    return searchName;
  }

  /**
   * Retrieves a Slack user property based on a GitHub username.
   * @param {Array} members - The list of Slack users.
   * @param {string} searchName - The GitHub username.
   * @param {string} property - The Slack user property to retrieve ('id' or 'realName').
   * @returns {Promise<string>} The Slack user property value.
   */
  async #getSlackUserProperty(members, searchName, property) {
    if (!searchName) {
      console.error('(#getSlackUserProperty) Invalid searchName: must be a non-empty string.');
      return null;
    }

    if (!['id', 'realName'].includes(property)) {
      console.error('Invalid property: must be either "id" or "realName".');
      return null;
    }

    const githubNickName = await getGithubNickNameToGitHub(this.octokit, searchName);
    return EventHandler.#findSlackUserPropertyByGitName(members, githubNickName, property);
  }

  /**
   * EventHandler class processes different GitHub event types and sends corresponding notifications to Slack.
   * It handles three main types of events: comment, approve, schedule and review request.
   * @param {object} payload - The payload of the GitHub comment event.
   */
  async handleSchedule(payload) {
    const repo = payload.repository.name;
    const members = await getSlackUserList(this.web);

    try {
      const prsDetails = await this.getPendingReviewPRs(this.octokit, members, 'aitrics', 'vc-monorepo');
      const teamPRs = GITHUB_TEAM_SLUGS.reduce((acc, teamSlug) => {
        acc[teamSlug] = prsDetails.filter((pr) => pr.teamSlug === teamSlug);
        return acc;
      }, {});

      await Promise.all(Object.entries(teamPRs).map(async ([teamSlug, prs]) => {
        if (prs.length === 0) return;
        const channelId = SLACK_CHANNEL[teamSlug];
        if (!channelId) {
          console.error(`No Slack channel found for ${teamSlug}`);
          return;
        }

        await Promise.all(prs.map(async (pr) => {
          const commentData = {
            mentionedGitName: pr.author,
            prUrl: pr.url,
            body: pr.reviewers,
            prTitle: pr.title,
          };

          await this.slackMessages.sendSlackMessageToSchedule(commentData, channelId);
        }));
      }));
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async handleComment(payload) {
    const commentData = {
      commentUrl: payload.comment?.html_url,
      mentionedGitName: payload.issue?.user.login ?? payload.pull_request?.user.login,
      prUrl: payload.pull_request?.html_url,
      commentAuthorGitName: payload.comment?.user.login,
      commentBody: payload.comment?.body,
      prTitle: payload.issue?.title ?? payload.pull_request?.title,
      commentContent: payload.comment?.diff_hunk,
    };

    // Check if the comment is a reply to another comment.
    if (payload.comment.in_reply_to_id) {
      // Get the author of the original comment this one is replying to.
      const previousCommentAuthor = await getCommentAuthor(
        this.octokit,
        payload.repository.name,
        payload.comment.in_reply_to_id,
      );

      // If the author of the previous comment is different from the author of the current comment,
      // update the mentionedGitName to the previous comment's author.
      if (previousCommentAuthor !== commentData.commentAuthorGitName) {
        commentData.mentionedGitName = previousCommentAuthor;
      }
    }

    const channelId = await this.#selectSlackChannel(commentData.mentionedGitName);
    const members = await getSlackUserList(this.web);
    commentData.mentionedSlackId = await this.#getSlackUserProperty(members, commentData.mentionedGitName, 'id');
    commentData.commentAuthorSlackRealName = await this.#getSlackUserProperty(members, commentData.commentAuthorGitName, 'realName');

    await this.slackMessages.sendSlackMessageToComment(commentData, channelId);
  }

  async handleApprove(payload) {
    const commentData = {
      commentUrl: payload.review?.html_url,
      mentionedGitName: payload.pull_request?.user.login,
      prUrl: payload.pull_request?.html_url,
      commentAuthorGitName: payload.review?.user.login,
      commentBody: payload.review?.body,
      prTitle: payload.pull_request?.title,
    };

    const channelId = await this.#selectSlackChannel(commentData.mentionedGitName);
    const members = await getSlackUserList(this.web);
    commentData.mentionedSlackId = await this.#getSlackUserProperty(members, commentData.mentionedGitName, 'id');
    commentData.commentAuthorSlackRealName = await this.#getSlackUserProperty(members, commentData.commentAuthorGitName, 'realName');

    await this.slackMessages.sendSlackMessageToApprove(commentData, channelId);
  }

  async handleReviewRequested(payload) {
    const commentData = {
      mentionedGitName: payload.pull_request?.user.login,
      prUrl: payload.pull_request?.html_url,
      reviewerGitName: payload.requested_reviewer?.login ?? payload.review?.user.login,
      prTitle: payload.pull_request?.title,
    };

    const channelId = await this.#selectSlackChannel(commentData.mentionedGitName);
    const members = await getSlackUserList(this.web);
    commentData.mentionedSlackId = await this.#getSlackUserProperty(members, commentData.reviewerGitName, 'id');
    commentData.commentAuthorSlackRealName = await this.#getSlackUserProperty(members, commentData.mentionedGitName, 'realName');

    await this.slackMessages.sendSlackMessageToReviewRequested(commentData, channelId);
  }
}

module.exports = EventHandler;
