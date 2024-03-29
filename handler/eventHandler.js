const GitHubApiHelper = require('../github/gitHubApiHelper');
const SlackMessages = require('../slack/slackMessages');
const fetchSlackUserList = require('../slack/fetchSlackUserList');

const GITHUB_TEAM_SLUGS = ['SE', 'Platform-frontend', 'Platform-backend'];
const SLACK_CHANNEL = {
  SE: 'C06CS5Q4L8G',
  'Platform-frontend': 'C06B5J3KD8F',
  'Platform-backend': 'C06C8TLTURE',
  gitAny: 'C06CMAY8066',
  deploy: 'C06CMU2S6JY',
};

const SKIP_SLACK_USER = [
  'john (이주호)',
];

class EventHandler {
  /**
   * Constructs the EventHandler class.
   * @param {Octokit} octokit - The Octokit instance.
   * @param {WebClient} web - The Slack WebClient instance.
   */
  constructor(octokit, web) {
    this.gitHubApiHelper = new GitHubApiHelper(octokit);
    this.slackMessages = new SlackMessages(web);
    this.web = web;
  }

  /**
   * Fetches the reviewers' Slack IDs and their review status for a given pull request.
   *
   * @param {Array} slackMembers - An array of member objects, used to map GitHub usernames to Slack IDs.
   * @param {string} repoName - The name of the repository.
   * @param {string|int} prNumber - The pull request object.
   * @returns {Promise<Object>} A promise that resolves to an object mapping Slack IDs to their review status.
   */
  async #getPRReviewersWithStatus(slackMembers, repoName, prNumber) {
    /**
     * Note: `fetchPullRequestReviews` is used to fetch submitted reviews. However, it does not include reviewers
     * who are requested but have not yet submitted a review. Therefore, `fetchPullRequestDetails` is also used
     * to fetch all requested reviewers. This ensures we capture the status of all reviewers, both who have
     * and have not yet reviewed.
     */
    const [reviewsData, prDetailsData] = await Promise.all([
      this.gitHubApiHelper.fetchPullRequestReviews(repoName, prNumber),
      this.gitHubApiHelper.fetchPullRequestDetails(repoName, prNumber),
    ]);

    const mapReviewersToSlackIdAndState = (reviewers, defaultState = null) => Promise.all(reviewers.map(
      (reviewer) => this.#getSlackUserProperty(slackMembers, reviewer.user?.login || reviewer.login, 'id')
        .then((slackId) => ({ slackId, state: reviewer.state || defaultState })),
    ));

    const [submittedReviewers, requestedReviewers] = await Promise.all([
      mapReviewersToSlackIdAndState(reviewsData, 'COMMENTED'),
      mapReviewersToSlackIdAndState(prDetailsData.requested_reviewers, 'AWAITING'),
    ]);

    return [...submittedReviewers, ...requestedReviewers].reduce((reviewersStatus, { slackId, state }) => ({
      ...reviewersStatus,
      [slackId]: state,
    }), {});
  }

  /**
   * Finds the team slug for a given GitHub user from a list of GitHub team slugs.
   * @param {string} githubName - The GitHub username to search for.
   * @param {string[]} githubTeamSlugs - An array of GitHub team slugs.
   * @returns {Promise<string|null>} The team slug if the user is found, null otherwise.
   */
  async #findTeamSlugForGithubUser(githubName, githubTeamSlugs) {
    const githubMemberChecks = githubTeamSlugs.map(async (teamSlug) => {
      const githubMembers = await this.gitHubApiHelper.fetchListMembersInOrg(teamSlug);
      const githubMember = githubMembers.find(({ login }) => login === githubName);
      return githubMember ? teamSlug : null;
    });

    const results = await Promise.all(githubMemberChecks);
    return results.find((slug) => slug !== null);
  }

  /**
   * Adds review and team data to each PR in the list.
   * @param {Array} nonDraftPRs - Array of non-draft PR objects.
   * @param {Array} slackMembers - Object containing Slack member information.
   * @param {string} repoName - Repository name.
   * @returns {Promise<Object>} A promise that resolves to an object of PRs with added review and team data.
   */
  async #addReviewAndTeamDataToPRs(nonDraftPRs, slackMembers, repoName) {
    return Promise.all(nonDraftPRs.map(async (pr) => {
      const reviewersAndStatus = await this.#getPRReviewersWithStatus(slackMembers, repoName, pr.number);
      const formattedReviewersStatus = EventHandler.#createFormattedReviewerStatusString(reviewersAndStatus);
      const teamSlug = await this.#findTeamSlugForGithubUser(pr.user.login, GITHUB_TEAM_SLUGS);

      return { ...pr, reviewersString: formattedReviewersStatus, teamSlug };
    }));
  }

  /**
   * Creates a formatted string representing the status of each reviewer.
   * @param {Object} reviewersAndStatus - Object mapping reviewers to their status.
   * @returns {string} A string representing the status of each reviewer.
   */
  static #createFormattedReviewerStatusString(reviewersAndStatus) {
    return Object.entries(reviewersAndStatus)
      .map(([reviewer, status]) => `<@${reviewer}> (${status})`)
      .join(', ');
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
   * @param {Array} slackMembers - The list of Slack users.
   * @param {string} searchName - The GitHub username to search for in Slack user profiles.
   * @param {string} property - The property to retrieve from the Slack user ('id' or 'realName').
   * @returns {string} The requested property of the found Slack user or the searchName if no user is found.
   */
  static #findSlackUserPropertyByGitName(slackMembers, searchName, property) {
    const cleanedSearchName = searchName
      .toLowerCase()
      .replace(/aitrics-/g, '') // Remove the word 'aitrics-' from the search name
      .replace(/[^a-zA-Z]/g, ''); // Remove any non-alphabetic characters

    const user = slackMembers.find(({ real_name: realName, profile, deleted }) => {
      if (deleted) return false;
      const nameToCheck = [realName, profile.display_name].map((name) => name?.toLowerCase());

      const isSkipUser = nameToCheck.some((name) => SKIP_SLACK_USER.some((skipName) => name?.includes(skipName)));
      if (isSkipUser) return false;

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
   * @param {Array} slackMembers - The list of Slack users.
   * @param {string} searchName - The GitHub username.
   * @param {string} property - The Slack user property to retrieve ('id' or 'realName').
   * @returns {Promise<string>} The Slack user property value.
   */
  async #getSlackUserProperty(slackMembers, searchName, property) {
    if (!searchName) {
      console.error('(#getSlackUserProperty) Invalid searchName: must be a non-empty string.');
      return null;
    }

    if (!['id', 'realName'].includes(property)) {
      console.error('Invalid property: must be either "id" or "realName".');
      return null;
    }

    const githubNickName = await this.gitHubApiHelper.fetchGithubNickNameToGitHub(searchName);
    return EventHandler.#findSlackUserPropertyByGitName(slackMembers, githubNickName, property);
  }

  /**
   * Organizes pull requests by their respective teams.
   *
   * @param {Object} pullRequestDetails - A pull request detail objects.
   * @returns {Object} An object with team slugs as keys and arrays of PRs as values.
   */
  static #groupPullRequestsByTeam(pullRequestDetails) {
    return GITHUB_TEAM_SLUGS.reduce((groupedPRs, currentTeamSlug) => {
      const prsForCurrentTeam = pullRequestDetails.filter((prDetail) => prDetail.teamSlug === currentTeamSlug);
      return {
        ...groupedPRs,
        [currentTeamSlug]: prsForCurrentTeam,
      };
    }, {});
  }

  /**
   * Extracts and returns repository data.
   * @param {Object} repository - The repository object.
   * @param {string} repository.name - The name of the repository.
   * @param {string} repository.full_name - The full name of the repository.
   * @param {string} repository.html_url - The HTML URL of the repository.
   * @returns {Object} Extracted repository data.
   */
  static #extractRepoData(repository) {
    return {
      name: repository.name,
      fullName: repository.full_name,
      url: repository.html_url,
    };
  }

  /**
   * Prepares and returns data for a deployment notification.
   * @param {Object} deployData - The deployment data.
   * @param {string} deployData.ec2Name - EC2 instance name.
   * @param {string} deployData.imageTag - Image tag.
   * @param {Object} deployData.repoData - Repository data.
   * @param {string} deployData.ref - The git reference.
   * @param {string} deployData.sha - The git SHA.
   * @param {string} deployData.slackStatus - Slack status, either 'good' for successful job status or 'danger' for failed job status.
   * @param {string} deployData.slackDeployResult - Slack deploy result, formatted as an emoji and text.
   * @param {number} deployData.totalDurationMinutes - Total duration in minutes.
   * @param {string} deployData.triggerUser - User who triggered the action.
   * @param {Object} deployData.gitActionRunData - Git action run data.
   * @returns {Object} Prepared notification data.
   */
  static #prepareNotificationData(deployData) {
    const {
      ec2Name,
      imageTag,
      repoData,
      ref,
      sha,
      slackStatus,
      slackDeployResult,
      totalDurationMinutes,
      triggerUser,
      gitActionRunData,
    } = deployData;

    const minutes = Math.floor(totalDurationMinutes);
    const seconds = Math.round((totalDurationMinutes - minutes) * 60);

    return {
      ec2Name,
      imageTag,
      ref,
      sha,
      slackStatus,
      slackDeployResult,
      triggerUser,
      repoName: repoData.name,
      repoFullName: repoData.fullName,
      repoUrl: repoData.url,
      commitUrl: `https://github.com/${repoData.fullName}/commit/${sha}`,
      workflowName: gitActionRunData.name,
      totalRunTime: `${minutes}분 ${seconds}초`,
      actionUrl: gitActionRunData.html_url,
    };
  }

  /**
   * Calculates the duration in minutes between two dates.
   * @param {Date|string} start - The start time as a Date object or an ISO 8601 string.
   * @param {Date|string} end - The end time as a Date object or an ISO 8601 string.
   * @returns {number} The duration in minutes between the two times.
   */
  static #calculateDurationInMinutes(start, end) {
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
    const repoName = payload.repository.name;
    const slackMembers = await fetchSlackUserList(this.web);
    const nonDraftPRs = (await this.gitHubApiHelper.fetchOpenPullRequests(repoName)).filter((pr) => !pr.draft);
    const pullRequestDetails = await this.#addReviewAndTeamDataToPRs(nonDraftPRs, slackMembers, repoName);
    const teamPRs = EventHandler.#groupPullRequestsByTeam(pullRequestDetails);

    // This approach because we have multiple PR notices to send.
    const notificationPromises = Object.entries(teamPRs).flatMap(([teamSlug, prs]) => {
      if (prs.length === 0) return [];

      const channelId = SLACK_CHANNEL[teamSlug] || SLACK_CHANNEL.gitAny;
      return prs.map((pr) => this.#sendPRNotificationToSlack(pr, channelId));
    });

    await Promise.all(notificationPromises);
  }

  async #sendPRNotificationToSlack(pr, channelId) {
    const notificationData = {
      mentionedGitName: pr.author,
      prUrl: pr.html_url,
      body: pr.reviewersString,
      prTitle: pr.title,
    };

    await this.slackMessages.sendSlackMessageToSchedule(notificationData, channelId);
  }

  async handleComment(payload) {
    const notificationData = {
      commentUrl: payload.comment?.html_url,
      mentionedGitName: payload.issue?.user.login ?? payload.pull_request?.user.login,
      prUrl: payload.pull_request?.html_url ?? payload.issue?.html_url,
      commentAuthorGitName: payload.comment?.user.login,
      commentBody: payload.comment?.body,
      prTitle: payload.issue?.title ?? payload.pull_request?.title,
      commentContent: payload.comment?.diff_hunk,
    };

    // Check if the comment is a reply to another comment.
    if (payload.comment.in_reply_to_id) {
      // Get the author of the original comment this one is replying to.
      const previousCommentAuthor = await this.gitHubApiHelper.fetchCommentAuthor(payload.repository.name, payload.comment.in_reply_to_id);

      // If the author of the previous comment is different from the author of the current comment,
      // update the mentionedGitName to the previous comment's author.
      if (previousCommentAuthor !== notificationData.commentAuthorGitName) {
        notificationData.mentionedGitName = previousCommentAuthor;
      }
    }

    const channelId = await this.#selectSlackChannel(notificationData.mentionedGitName);
    const slackMembers = await fetchSlackUserList(this.web);
    notificationData.mentionedSlackId = await this.#getSlackUserProperty(
      slackMembers,
      notificationData.mentionedGitName,
      'id',
    );
    notificationData.commentAuthorSlackRealName = await this.#getSlackUserProperty(
      slackMembers,
      notificationData.commentAuthorGitName,
      'realName',
    );

    await this.slackMessages.sendSlackMessageToComment(notificationData, channelId);
  }

  async handleApprove(payload) {
    const notificationData = {
      commentUrl: payload.review?.html_url,
      mentionedGitName: payload.pull_request?.user.login,
      prUrl: payload.pull_request?.html_url,
      commentAuthorGitName: payload.review?.user.login,
      commentBody: payload.review?.body || '',
      prTitle: payload.pull_request?.title,
    };

    const channelId = await this.#selectSlackChannel(notificationData.mentionedGitName);
    const slackMembers = await fetchSlackUserList(this.web);
    notificationData.mentionedSlackId = await this.#getSlackUserProperty(
      slackMembers,
      notificationData.mentionedGitName,
      'id',
    );
    notificationData.commentAuthorSlackRealName = await this.#getSlackUserProperty(
      slackMembers,
      notificationData.commentAuthorGitName,
      'realName',
    );

    await this.slackMessages.sendSlackMessageToApprove(notificationData, channelId);
  }

  async handleReviewRequested(payload) {
    const notificationData = {
      mentionedGitName: payload.pull_request?.user.login,
      prUrl: payload.pull_request?.html_url,
      reviewerGitName: payload.requested_reviewer?.login ?? payload.review?.user.login,
      prTitle: payload.pull_request?.title,
    };

    const channelId = await this.#selectSlackChannel(notificationData.reviewerGitName);
    const slackMembers = await fetchSlackUserList(this.web);
    notificationData.mentionedSlackId = await this.#getSlackUserProperty(
      slackMembers,
      notificationData.reviewerGitName,
      'id',
    );
    notificationData.commentAuthorSlackRealName = await this.#getSlackUserProperty(
      slackMembers,
      notificationData.mentionedGitName,
      'realName',
    );

    await this.slackMessages.sendSlackMessageToReviewRequested(notificationData, channelId);
  }

  async handleDeploy(context, ec2Name, imageTag, jobStatus) {
    const repoData = EventHandler.#extractRepoData(context.payload.repository);
    const gitActionRunData = await this.gitHubApiHelper.fetchGitActionRunData(repoData.name, context.runId);
    const slackMembers = await fetchSlackUserList(this.web);
    const totalDurationMinutes = EventHandler.#calculateDurationInMinutes(gitActionRunData.run_started_at, new Date());
    const mentionedSlackId = await this.#getSlackUserProperty(slackMembers, gitActionRunData.actor.login, 'id');

    const notificationData = EventHandler.#prepareNotificationData({
      ec2Name,
      imageTag,
      repoData,
      ref: context.ref,
      sha: context.sha,
      slackStatus: jobStatus === 'success' ? 'good' : 'danger',
      slackDeployResult: jobStatus === 'success' ? ':white_check_mark:*Succeeded*' : ':x:*Failed*',
      totalDurationMinutes,
      triggerUser: mentionedSlackId,
      gitActionRunData,
    });

    await this.slackMessages.sendSlackMessageToDeploy(notificationData, SLACK_CHANNEL.deploy);
  }
}

module.exports = EventHandler;
