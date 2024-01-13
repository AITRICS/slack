const Github = require('@actions/github');
const {
  fetchGithubNickNameToGitHub,
  fetchCommentAuthor,
  fetchListMembersInOrg,
  fetchPullRequestReviews,
  fetchPullRequestDetails,
  fetchOpenPullRequests,
  fetchGitActionRunData,
} = require('../github/githubUtils');
const fetchSlackUserList = require('../slack/fetchSlackUserList');
const SlackMessages = require('../slack/slackMessages');

const GITHUB_TEAM_SLUGS = ['SE', 'Platform-frontend', 'Platform-backend'];
const SLACK_CHANNEL = {
  SE: 'C06CS5Q4L8G',
  'Platform-frontend': 'C06B5J3KD8F',
  'Platform-backend': 'C06C8TLTURE',
  gitAny: 'C06CMAY8066',
  deploy: 'C06CMU2S6JY',
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
   * Fetches the reviewers' Slack IDs and their review status for a given pull request.
   *
   * @param {Array} members - An array of member objects, used to map GitHub usernames to Slack IDs.
   * @param {string} repo - The name of the repository.
   * @param {Object} pr - The pull request object.
   * @returns {Promise<Object>} A promise that resolves to an object mapping Slack IDs to their review status.
   */
  async #getPRReviewersWithStatus(members, repo, pr) {
    const prNumber = pr.number;
    /**
    * Note: `fetchPullRequestReviews` is used to fetch submitted reviews. However, it does not include reviewers
    * who are requested but have not yet submitted a review. Therefore, `fetchPullRequestDetails` is also used
    * to fetch all requested reviewers. This ensures we capture the status of all reviewers, both who have
    * and have not yet reviewed.
    */
    const reviewsData = await fetchPullRequestReviews(this.octokit, repo, prNumber);
    const prDetailsData = await fetchPullRequestDetails(this.octokit, repo, prNumber);

    const mapReviewersToSlackIdAndState = async (reviewers, defaultState = null) => Promise.all(
      reviewers.map(async (reviewer) => {
        const slackId = await this.#getSlackUserProperty(members, reviewer.user?.login || reviewer.login, 'id');
        return { slackId, state: reviewer.state || defaultState };
      }),
    );

    const [submittedReviewers, requestedReviewers] = await Promise.all([
      mapReviewersToSlackIdAndState(reviewsData, 'COMMENTED'),
      mapReviewersToSlackIdAndState(prDetailsData.requested_reviewers, 'AWAITING'),
    ]);

    // Combines the status of all reviewers into a single object.
    const reviewersStatus = {};
    [...submittedReviewers, ...requestedReviewers].forEach(({ slackId, state }) => {
      reviewersStatus[slackId] = state;
    });

    return reviewersStatus;
  }

  /**
   * Finds the team slug for a given GitHub user from a list of GitHub team slugs.
   * @param {string} githubName - The GitHub username to search for.
   * @param {string[]} githubTeamSlugs - An array of GitHub team slugs.
   * @returns {Promise<string|null>} The team slug if the user is found, null otherwise.
   * @throws Will throw an error if the GitHub API request fails.
   */
  async #findTeamSlugForGithubUser(githubName, githubTeamSlugs) {
    const memberChecks = githubTeamSlugs.map(async (teamSlug) => {
      const members = await fetchListMembersInOrg(this.octokit, teamSlug);
      const member = members.find(({ login }) => login === githubName);
      return member ? teamSlug : null;
    });

    const results = await Promise.all(memberChecks);
    return results.find((slug) => slug !== null);
  }

  /**
   * Fetches and compiles details of all non-draft pull requests in a specific GitHub repository,
   * including reviewers' information and the team associated with each pull request.
   *
   * @param {Array} members - An array of member objects, used to map GitHub usernames to Slack IDs.
   * @param {string} repo - The name of the GitHub repository.
   * @returns {Promise<Object>} A promise that resolves to objects, each representing
   * a non-draft pull request with additional details such as reviewers' status and team slug.
   */
  async #getPendingReviewPRs(members, repo) {
    const openPRs = await fetchOpenPullRequests(this.octokit, repo);
    const filteredNonDraftPRs = openPRs.filter((pr) => !pr.draft);

    return Promise.all(filteredNonDraftPRs.map(async (pr) => {
      const reviewersAndStatus = await this.#getPRReviewersWithStatus(members, repo, pr);
      const teamSlug = await this.#findTeamSlugForGithubUser(pr.user.login, GITHUB_TEAM_SLUGS);

      // Format the reviewer's status and mansion as a string.
      const formattedReviewersStatus = Object.entries(reviewersAndStatus)
        .map(([reviewer, status]) => `<@${reviewer}> (${status})`)
        .join(', ');

      return { ...pr, reviewersString: formattedReviewersStatus, teamSlug };
    }));
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

    const teamSlug = await this.#findTeamSlugForGithubUser(searchName, GITHUB_TEAM_SLUGS);
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

    const user = members.find(({ real_name: realName, profile, deleted }) => {
      if (deleted) return false;
      const nameToCheck = [realName, profile.display_name].map((name) => name?.toLowerCase());
      return nameToCheck.some((name) => name?.includes(cleanedSearchName));
    });

    if (!user) return searchName;

    const slackUserProperties = {
      id: () => user.id,
      realName: () => user.profile.display_name,
    };

    return slackUserProperties[property] ? slackUserProperties[property]() : searchName;
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

    const githubNickName = await fetchGithubNickNameToGitHub(this.octokit, searchName);
    return EventHandler.#findSlackUserPropertyByGitName(members, githubNickName, property);
  }

  /**
   * Organizes pull requests by their respective teams.
   *
   * @param {Object} prsDetails - A pull request detail objects.
   * @returns {Object} An object with team slugs as keys and arrays of PRs as values.
   */
  static #organizePRsByTeam(prsDetails) {
    return GITHUB_TEAM_SLUGS.reduce((accumulator, teamSlug) => {
      // Filter PRs for each team based on the team slug
      const prsForTeam = prsDetails.filter((pr) => pr.teamSlug === teamSlug);

      return {
        ...accumulator,
        [teamSlug]: prsForTeam,
      };
    }, {});
  }

  static #getDurationInMinutes(start, end) {
    const startTime = new Date(start);
    const endTime = new Date(end);

    return (endTime - startTime) / 60000;
  }

  /**
   * EventHandler class processes different GitHub event types and sends corresponding notifications to Slack.
   * It handles three main types of events: comment, approve, schedule and review request.
   * @param {object} payload - The payload of the GitHub comment event.
   */
  async handleSchedule(payload) {
    const repo = payload.repository.name;
    const members = await fetchSlackUserList(this.web);
    const prsDetails = await this.#getPendingReviewPRs(members, repo);
    const teamPRs = EventHandler.#organizePRsByTeam(prsDetails);

    // This approach because we have multiple PR notices to send.
    const notificationPromises = Object.entries(teamPRs).flatMap(([teamSlug, prs]) => {
      if (prs.length === 0) return [];

      const channelId = SLACK_CHANNEL[teamSlug] || SLACK_CHANNEL.gitAny;
      return prs.map((pr) => this.#notifyPR(pr, channelId));
    });

    await Promise.all(notificationPromises);
  }

  async #notifyPR(pr, channelId) {
    const commentData = {
      mentionedGitName: pr.author,
      prUrl: pr.html_url,
      body: pr.reviewersString,
      prTitle: pr.title,
    };

    await this.slackMessages.sendSlackMessageToSchedule(commentData, channelId);
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
      const previousCommentAuthor = await fetchCommentAuthor(this.octokit, payload.repository.name, payload.comment.in_reply_to_id);

      // If the author of the previous comment is different from the author of the current comment,
      // update the mentionedGitName to the previous comment's author.
      if (previousCommentAuthor !== commentData.commentAuthorGitName) {
        commentData.mentionedGitName = previousCommentAuthor;
      }
    }

    const channelId = await this.#selectSlackChannel(commentData.mentionedGitName);
    const members = await fetchSlackUserList(this.web);
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
    const members = await fetchSlackUserList(this.web);
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
    const members = await fetchSlackUserList(this.web);
    commentData.mentionedSlackId = await this.#getSlackUserProperty(members, commentData.reviewerGitName, 'id');
    commentData.commentAuthorSlackRealName = await this.#getSlackUserProperty(members, commentData.mentionedGitName, 'realName');

    await this.slackMessages.sendSlackMessageToReviewRequested(commentData, channelId);
  }

  async handleDeploy(context, ec2Name, imageTag) {
    const {
      runId,
      sha,
      payload,
      ref,
    } = context;
    const repoName = payload.repository.name;
    const repoFullName = payload.repository.full_name;
    const repoUrl = payload.repository.html_url;
    const gitActionRunData = await fetchGitActionRunData(this.octokit, repoName, runId);
    const totalDurationMinutes = EventHandler.#getDurationInMinutes(gitActionRunData.run_started_at, new Date());
    const { conclusion } = gitActionRunData;
    const slackStatus = conclusion === 'success' ? 'good' : 'danger';
    const slackStatusEmoji = conclusion === 'success' ? ':white_check_mark:' : ':x:';
    const minutes = Math.floor(totalDurationMinutes);
    const seconds = Math.round((totalDurationMinutes - minutes) * 60);
    const members = await fetchSlackUserList(this.web);
    const mentionedSlackId = await this.#getSlackUserProperty(members, gitActionRunData.actor.login, 'id');

    console.log(gitActionRunData);
    const notificationData = {
      ec2Name,
      imageTag,
      repoName,
      repoFullName,
      repoUrl,
      ref,
      sha,
      slackStatus,
      slackStatusEmoji,
      commitUrl: `https://github.com/${repoFullName}/commit/${sha}`,
      workflowName: gitActionRunData.name,
      totalRunTime: `${minutes}분 ${seconds}초`,
      triggerUser: mentionedSlackId,
      actionUrl: gitActionRunData.html_url,
      status: gitActionRunData.conclusion,
    };

    await this.slackMessages.sendSlackMessageToDeploy(notificationData, 'C068EMH12TX');
  }
}

module.exports = EventHandler;
