const GitHubApiHelper = require('../github/gitHubApiHelper');
const SlackMessages = require('../slack/slackMessages');
const fetchSlackUserList = require('../slack/fetchSlackUserList');
const {
  GITHUB_CONFIG, SLACK_CHANNELS, SLACK_CONFIG, REVIEW_STATES,
} = require('../constants');
const { calculateDurationInMinutes, formatDuration } = require('../utils/timeUtils');
const { findSlackUserProperty } = require('../utils/nameUtils');

class EventHandler {
  /**
   * Constructs the EventHandler class.
   * @param {import('@octokit/rest').Octokit} octokit - The Octokit instance.
   * @param {import('@slack/web-api').WebClient} webClient - The Slack WebClient instance.
   */
  constructor(octokit, webClient) {
    this.gitHubApiHelper = new GitHubApiHelper(octokit);
    this.slackMessages = new SlackMessages(webClient);
    this.webClient = webClient;
  }

  /**
   * Fetches the reviewers' Slack IDs and their review status for a given pull request.
   * @param {Array} slackMembers - Array of Slack member objects.
   * @param {string} repoName - The name of the repository.
   * @param {number} prNumber - The pull request number.
   * @returns {Promise<Object>} Object mapping Slack IDs to their review status.
   */
  async getPRReviewersWithStatus(slackMembers, repoName, prNumber) {
    try {
      const [reviewsData, prDetailsData] = await Promise.all([
        this.gitHubApiHelper.fetchPullRequestReviews(repoName, prNumber),
        this.gitHubApiHelper.fetchPullRequestDetails(repoName, prNumber),
      ]);

      const mapReviewersToSlackIdAndState = (reviewers, defaultState = null) => Promise.all(
        reviewers.map((reviewer) => this.getSlackUserProperty(
          slackMembers,
          reviewer.user?.login || reviewer.login,
          'id',
        ).then((slackId) => ({ slackId, state: reviewer.state || defaultState }))),
      );

      const [submittedReviewers, requestedReviewers] = await Promise.all([
        mapReviewersToSlackIdAndState(reviewsData, REVIEW_STATES.COMMENTED),
        mapReviewersToSlackIdAndState(prDetailsData.requested_reviewers, REVIEW_STATES.AWAITING),
      ]);

      return [...submittedReviewers, ...requestedReviewers].reduce(
        (reviewersStatus, { slackId, state }) => ({
          ...reviewersStatus,
          [slackId]: state,
        }),
        {},
      );
    } catch (error) {
      console.error(`Error getting PR reviewers status for PR ${prNumber}:`, error);
      throw error;
    }
  }

  /**
   * Finds the team slug for a given GitHub user.
   * @param {string} githubUsername - The GitHub username to search for.
   * @returns {Promise<string|null>} The team slug if found, null otherwise.
   */
  async findUserTeamSlug(githubUsername) {
    try {
      const teamChecks = GITHUB_CONFIG.TEAM_SLUGS.map(async (teamSlug) => {
        try {
          const members = await this.gitHubApiHelper.fetchTeamMembers(teamSlug);
          const isMember = members.some(({ login }) => login === githubUsername);
          return isMember ? teamSlug : null;
        } catch (error) {
          console.error(`Error checking team membership for ${teamSlug}:`, error);
          return null;
        }
      });

      const results = await Promise.all(teamChecks);
      return results.find((slug) => slug !== null) || null;
    } catch (error) {
      console.error(`Error finding team slug for user ${githubUsername}:`, error);
      return null;
    }
  }

  /**
   * Adds review and team data to each PR in the list.
   * @param {Array} nonDraftPRs - Array of non-draft PR objects.
   * @param {Array} slackMembers - Array containing Slack member information.
   * @param {string} repoName - Repository name.
   * @returns {Promise<Array>} Array of PRs with added review and team data.
   */
  async addReviewAndTeamDataToPRs(nonDraftPRs, slackMembers, repoName) {
    try {
      return Promise.all(
        nonDraftPRs.map(async (pr) => {
          const reviewersAndStatus = await this.getPRReviewersWithStatus(
            slackMembers,
            repoName,
            pr.number,
          );
          const formattedReviewersStatus = EventHandler.createFormattedReviewerStatusString(reviewersAndStatus);
          const teamSlug = await this.findUserTeamSlug(pr.user.login);

          return { ...pr, reviewersString: formattedReviewersStatus, teamSlug };
        }),
      );
    } catch (error) {
      console.error('Error adding review and team data to PRs:', error);
      throw error;
    }
  }

  /**
   * Creates a formatted string representing the status of each reviewer.
   * @param {Object} reviewersAndStatus - Object mapping reviewers to their status.
   * @returns {string} Formatted string representing reviewer status.
   */
  static createFormattedReviewerStatusString(reviewersAndStatus) {
    return Object.entries(reviewersAndStatus)
      .map(([reviewer, status]) => `<@${reviewer}> (${status})`)
      .join(', ');
  }

  /**
   * Selects the appropriate Slack channel ID based on a GitHub username.
   * @param {string} githubUsername - The GitHub username.
   * @returns {Promise<string>} The Slack channel ID.
   */
  async selectSlackChannel(githubUsername) {
    if (!githubUsername) {
      console.error('Invalid GitHub username for channel selection');
      return SLACK_CHANNELS.gitAny;
    }

    try {
      const teamSlug = await this.findUserTeamSlug(githubUsername);
      return SLACK_CHANNELS[teamSlug] || SLACK_CHANNELS.gitAny;
    } catch (error) {
      console.error(`Error selecting Slack channel for ${githubUsername}:`, error);
      return SLACK_CHANNELS.gitAny;
    }
  }

  /**
   * Retrieves a Slack user property based on a GitHub username.
   * @param {Array} slackMembers - The list of Slack users.
   * @param {string} githubUsername - The GitHub username.
   * @param {string} property - The Slack user property to retrieve ('id' or 'realName').
   * @returns {Promise<string>} The Slack user property value.
   */
  async getSlackUserProperty(slackMembers, githubUsername, property) {
    if (!githubUsername) {
      console.error('Invalid GitHub username provided');
      return null;
    }

    if (!['id', 'realName'].includes(property)) {
      console.error('Invalid property: must be either "id" or "realName"');
      return null;
    }

    try {
      const realName = await this.gitHubApiHelper.fetchUserRealName(githubUsername);
      return findSlackUserProperty(slackMembers, realName, property);
    } catch (error) {
      console.error(`Error getting Slack user property for ${githubUsername}:`, error);
      return githubUsername;
    }
  }

  /**
   * Organizes pull requests by their respective teams.
   * @param {Array} pullRequestDetails - Array of pull request detail objects.
   * @returns {Object} Object with team slugs as keys and arrays of PRs as values.
   */
  static groupPullRequestsByTeam(pullRequestDetails) {
    return GITHUB_CONFIG.TEAM_SLUGS.reduce((groupedPRs, currentTeamSlug) => {
      const prsForCurrentTeam = pullRequestDetails.filter(
        (prDetail) => prDetail.teamSlug === currentTeamSlug,
      );
      return {
        ...groupedPRs,
        [currentTeamSlug]: prsForCurrentTeam,
      };
    }, {});
  }

  /**
   * Extracts and returns repository data.
   * @param {Object} repository - The repository object.
   * @returns {Object} Extracted repository data.
   */
  static extractRepoData(repository) {
    return {
      name: repository.name,
      fullName: repository.full_name,
      url: repository.html_url,
    };
  }

  /**
   * Prepares and returns data for a deployment notification.
   * @param {Object} deployData - The deployment data.
   * @returns {Object} Prepared notification data.
   */
  static prepareDeploymentNotificationData(deployData) {
    const {
      ec2Name,
      imageTag,
      repoData,
      ref,
      sha,
      slackStatus,
      slackDeployResult,
      totalRunTime,
      triggerUser,
      workflowData,
    } = deployData;

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
      workflowName: workflowData.name,
      totalRunTime,
      actionUrl: workflowData.html_url,
    };
  }

  /**
   * Prepares and returns data for a build notification.
   * @param {Object} buildData - The build data.
   * @returns {Object} Prepared notification data.
   */
  static prepareBuildNotificationData(buildData) {
    const {
      branchName,
      imageTag,
      repoData,
      ref,
      sha,
      slackStatus,
      slackBuildResult,
      totalRunTime,
      triggerUser,
      workflowData,
      jobNames,
    } = buildData;

    return {
      branchName,
      imageTag,
      ref,
      sha,
      slackStatus,
      slackBuildResult,
      triggerUser,
      repoName: repoData.name,
      repoFullName: repoData.fullName,
      repoUrl: repoData.url,
      commitUrl: `https://github.com/${repoData.fullName}/commit/${sha}`,
      workflowName: workflowData.name,
      totalRunTime,
      actionUrl: workflowData.html_url,
      jobNames,
    };
  }

  /**
   * Handles scheduled PR review notifications.
   * @param {Object} payload - The GitHub event payload.
   */
  async handleSchedule(payload) {
    try {
      const repoName = payload.repository.name;
      const slackMembers = await fetchSlackUserList(this.webClient);
      const allPRs = await this.gitHubApiHelper.fetchOpenPullRequests(repoName);
      const nonDraftPRs = allPRs.filter((pr) => !pr.draft);
      const pullRequestDetails = await this.addReviewAndTeamDataToPRs(nonDraftPRs, slackMembers, repoName);
      const teamPRs = EventHandler.groupPullRequestsByTeam(pullRequestDetails);

      const notificationPromises = Object.entries(teamPRs).flatMap(([teamSlug, prs]) => {
        if (prs.length === 0) return [];

        const channelId = SLACK_CHANNELS[teamSlug] || SLACK_CHANNELS.gitAny;
        return prs.map((pr) => this.sendPRNotificationToSlack(pr, channelId));
      });

      await Promise.all(notificationPromises);
    } catch (error) {
      console.error('Error handling schedule event:', error);
      throw error;
    }
  }

  /**
   * Sends a PR notification to Slack.
   * @param {Object} pr - Pull request object.
   * @param {string} channelId - Slack channel ID.
   */
  async sendPRNotificationToSlack(pr, channelId) {
    try {
      const notificationData = {
        mentionedGitName: pr.author,
        prUrl: pr.html_url,
        body: pr.reviewersString,
        prTitle: pr.title,
      };

      await this.slackMessages.sendScheduledReviewMessage(notificationData, channelId);
    } catch (error) {
      console.error('Error sending PR notification to Slack:', error);
      throw error;
    }
  }

  /**
   * Fetches all reviewers for a pull request.
   * @param {Array} slackMembers - The list of Slack users.
   * @param {string} repoName - The name of the repository.
   * @param {number} prNumber - The number of the pull request.
   * @returns {Promise<Array>} Array of reviewers with Slack IDs.
   */
  async fetchAllPRReviewers(slackMembers, repoName, prNumber) {
    try {
      const prDetails = await this.gitHubApiHelper.fetchPullRequestDetails(repoName, prNumber);
      const requestedReviewers = prDetails.requested_reviewers || [];
      const reviews = await this.gitHubApiHelper.fetchPullRequestReviews(repoName, prNumber);
      const reviewSubmitters = reviews.map((review) => review.user.login);

      const allReviewers = [
        ...new Set([
          ...requestedReviewers.map((r) => r.login),
          ...reviewSubmitters,
        ]),
      ];

      return Promise.all(
        allReviewers.map(async (githubUsername) => {
          const slackId = await this.getSlackUserProperty(slackMembers, githubUsername, 'id');
          return { githubUsername, slackId };
        }),
      );
    } catch (error) {
      console.error(`Error fetching PR reviewers for PR number ${prNumber}:`, error);
      return [];
    }
  }

  /**
   * Handles comment events (both code comments and PR page comments).
   * @param {Object} payload - The GitHub event payload.
   */
  async handleComment(payload) {
    try {
      const isPRPageComment = payload.comment.issue_url !== undefined;

      if (isPRPageComment) {
        await this.handlePRPageComment(payload);
      } else {
        await this.handleCodeComment(payload);
      }
    } catch (error) {
      console.error('Error handling comment event:', error);
      throw error;
    }
  }

  /**
   * Handles code review comments (comments on specific lines of code).
   * @param {Object} payload - The GitHub comment event payload.
   */
  async handleCodeComment(payload) {
    try {
      const notificationData = {
        commentUrl: payload.comment?.html_url,
        mentionedGitName: payload.pull_request?.user.login,
        prUrl: payload.pull_request?.html_url,
        commentAuthorGitName: payload.comment?.user.login,
        commentBody: payload.comment?.body,
        prTitle: payload.pull_request?.title,
        commentContent: payload.comment?.diff_hunk,
      };

      // Check if this is a reply to another comment
      if (payload.comment.in_reply_to_id) {
        const previousCommentAuthor = await this.gitHubApiHelper.fetchCommentAuthor(
          payload.repository.name,
          payload.comment.in_reply_to_id,
        );

        if (previousCommentAuthor !== notificationData.commentAuthorGitName) {
          notificationData.mentionedGitName = previousCommentAuthor;
        }
      }

      const channelId = await this.selectSlackChannel(notificationData.mentionedGitName);
      const slackMembers = await fetchSlackUserList(this.webClient);

      notificationData.mentionedSlackId = await this.getSlackUserProperty(
        slackMembers,
        notificationData.mentionedGitName,
        'id',
      );
      notificationData.commentAuthorSlackRealName = await this.getSlackUserProperty(
        slackMembers,
        notificationData.commentAuthorGitName,
        'realName',
      );

      await this.slackMessages.sendCodeCommentMessage(notificationData, channelId);
    } catch (error) {
      console.error('Error handling code comment:', error);
      throw error;
    }
  }

  /**
   * Handles comments on the PR page (not on specific code lines).
   * @param {Object} payload - The GitHub comment event payload.
   */
  async handlePRPageComment(payload) {
    try {
      const repoName = payload.repository.name;
      const prNumber = payload.issue.number;
      const commentAuthorGitName = payload.comment.user.login;

      const prDetails = await this.gitHubApiHelper.fetchPullRequestDetails(repoName, prNumber);
      const prAuthorGitName = prDetails.user.login;
      const slackMembers = await fetchSlackUserList(this.webClient);
      const reviewers = await this.fetchAllPRReviewers(slackMembers, repoName, prNumber);

      const commentAuthorSlackRealName = await this.getSlackUserProperty(
        slackMembers,
        commentAuthorGitName,
        'realName',
      );

      let recipients = [];

      if (commentAuthorGitName === prAuthorGitName) {
        // PR author commented - notify all reviewers except author
        recipients = reviewers.filter((reviewer) => reviewer.githubUsername !== commentAuthorGitName);
      } else {
        // Reviewer commented - notify other reviewers + PR author (if not already in reviewers)
        const prAuthorInReviewers = reviewers.some(
          (reviewer) => reviewer.githubUsername === prAuthorGitName,
        );

        const filteredReviewers = reviewers.filter(
          (reviewer) => reviewer.githubUsername !== commentAuthorGitName,
        );

        if (!prAuthorInReviewers) {
          const prAuthorSlackId = await this.getSlackUserProperty(slackMembers, prAuthorGitName, 'id');
          recipients = [
            { githubUsername: prAuthorGitName, slackId: prAuthorSlackId },
            ...filteredReviewers,
          ];
        } else {
          recipients = filteredReviewers;
        }
      }

      if (recipients.length === 0) {
        console.log('No recipients found for PR page comment notification');
        return;
      }

      // Remove duplicates
      const uniqueRecipients = [];
      const addedGithubUsernames = new Set();

      recipients.forEach((recipient) => {
        if (!addedGithubUsernames.has(recipient.githubUsername)) {
          addedGithubUsernames.add(recipient.githubUsername);
          uniqueRecipients.push(recipient);
        }
      });

      // Group recipients by channel
      const recipientsByChannel = {};

      await Promise.all(
        uniqueRecipients.map(async (recipient) => {
          const channelId = await this.selectSlackChannel(recipient.githubUsername);

          if (!recipientsByChannel[channelId]) {
            recipientsByChannel[channelId] = [];
          }

          recipientsByChannel[channelId].push(recipient);
        }),
      );

      // Send messages to each channel
      await Promise.all(
        Object.entries(recipientsByChannel).map(async ([channelId, channelRecipients]) => {
          const mentionsString = channelRecipients
            .map((recipient) => `<@${recipient.slackId}>`)
            .join(', ');

          const notificationData = {
            commentUrl: payload.comment.html_url,
            prUrl: `https://github.com/${payload.repository.full_name}/pull/${prNumber}`,
            commentAuthorGitName,
            commentBody: payload.comment.body,
            prTitle: prDetails.title,
            commentAuthorSlackRealName,
            mentionsString,
          };

          await this.slackMessages.sendPRPageCommentMessage(notificationData, channelId);

          console.log(`Sent PR page comment notification to channel ${channelId} for ${channelRecipients.length} recipients`);
        }),
      );
    } catch (error) {
      console.error('Error handling PR page comment:', error);
      throw error;
    }
  }

  /**
   * Handles approval events.
   * @param {Object} payload - The GitHub event payload.
   */
  async handleApprove(payload) {
    try {
      const notificationData = {
        commentUrl: payload.review?.html_url,
        mentionedGitName: payload.pull_request?.user.login,
        prUrl: payload.pull_request?.html_url,
        commentAuthorGitName: payload.review?.user.login,
        commentBody: payload.review?.body || '',
        prTitle: payload.pull_request?.title,
      };

      const channelId = await this.selectSlackChannel(notificationData.mentionedGitName);
      const slackMembers = await fetchSlackUserList(this.webClient);

      notificationData.mentionedSlackId = await this.getSlackUserProperty(
        slackMembers,
        notificationData.mentionedGitName,
        'id',
      );
      notificationData.commentAuthorSlackRealName = await this.getSlackUserProperty(
        slackMembers,
        notificationData.commentAuthorGitName,
        'realName',
      );

      await this.slackMessages.sendApprovalMessage(notificationData, channelId);
    } catch (error) {
      console.error('Error handling approve event:', error);
      throw error;
    }
  }

  /**
   * Handles review request events.
   * @param {Object} payload - The GitHub event payload.
   */
  async handleReviewRequested(payload) {
    try {
      const notificationData = {
        mentionedGitName: payload.pull_request?.user.login,
        prUrl: payload.pull_request?.html_url,
        reviewerGitName: payload.requested_reviewer?.login ?? payload.review?.user.login,
        prTitle: payload.pull_request?.title,
      };

      const channelId = await this.selectSlackChannel(notificationData.reviewerGitName);
      const slackMembers = await fetchSlackUserList(this.webClient);

      notificationData.mentionedSlackId = await this.getSlackUserProperty(
        slackMembers,
        notificationData.reviewerGitName,
        'id',
      );
      notificationData.commentAuthorSlackRealName = await this.getSlackUserProperty(
        slackMembers,
        notificationData.mentionedGitName,
        'realName',
      );

      await this.slackMessages.sendReviewRequestMessage(notificationData, channelId);
    } catch (error) {
      console.error('Error handling review request event:', error);
      throw error;
    }
  }

  /**
   * Handles deployment events.
   * @param {Object} context - GitHub Actions context.
   * @param {string} ec2Name - EC2 instance name.
   * @param {string} imageTag - Docker image tag.
   * @param {string} jobStatus - Job status (success/failure).
   */
  async handleDeploy(context, ec2Name, imageTag, jobStatus) {
    try {
      const repoData = EventHandler.extractRepoData(context.payload.repository);
      const workflowData = await this.gitHubApiHelper.fetchWorkflowRunData(repoData.name, context.runId);
      const slackMembers = await fetchSlackUserList(this.webClient);
      const totalDurationMinutes = calculateDurationInMinutes(workflowData.run_started_at, new Date());
      const triggerUserSlackId = await this.getSlackUserProperty(
        slackMembers,
        workflowData.actor.login,
        'id',
      );

      const isSuccess = jobStatus === 'success';
      const notificationData = EventHandler.prepareDeploymentNotificationData({
        ec2Name,
        imageTag,
        repoData,
        ref: context.ref,
        sha: context.sha,
        slackStatus: isSuccess ? SLACK_CONFIG.MESSAGE_COLORS.SUCCESS : SLACK_CONFIG.MESSAGE_COLORS.DANGER,
        slackDeployResult: `${isSuccess ? SLACK_CONFIG.ICONS.SUCCESS : SLACK_CONFIG.ICONS.FAILURE}*${isSuccess ? 'Succeeded' : 'Failed'}*`,
        totalRunTime: formatDuration(totalDurationMinutes),
        triggerUser: triggerUserSlackId,
        workflowData,
      });

      await this.slackMessages.sendDeploymentMessage(notificationData, SLACK_CHANNELS.deploy);
    } catch (error) {
      console.error('Error handling deploy event:', error);
      throw error;
    }
  }

  /**
   * Handles build notifications triggered by GitHub Actions.
   * @param {Object} context - The GitHub Actions context.
   * @param {string} branchName - The branch name where the build was triggered.
   * @param {string} imageTag - The image tag associated with the build.
   * @param {string} jobName - The name of the job that triggered the notification.
   * @param {string} jobStatus - The status of the job (success or failure).
   */
  async handleBuild(context, branchName, imageTag, jobName, jobStatus) {
    try {
      const repoData = EventHandler.extractRepoData(context.payload.repository);
      const workflowData = await this.gitHubApiHelper.fetchWorkflowRunData(repoData.name, context.runId);
      const slackMembers = await fetchSlackUserList(this.webClient);
      const totalDurationMinutes = calculateDurationInMinutes(workflowData.run_started_at, new Date());
      const triggerUserSlackId = await this.getSlackUserProperty(
        slackMembers,
        workflowData.actor.login,
        'id',
      );

      const jobNames = jobName ? jobName.split(',').map((name) => name.trim()) : [];
      const isSuccess = jobStatus === 'success';

      const notificationData = EventHandler.prepareBuildNotificationData({
        branchName: branchName || context.ref.replace('refs/heads/', ''),
        jobNames,
        imageTag,
        repoData,
        sha: context.sha,
        slackStatus: isSuccess ? SLACK_CONFIG.MESSAGE_COLORS.SUCCESS : SLACK_CONFIG.MESSAGE_COLORS.DANGER,
        slackBuildResult: `${isSuccess ? SLACK_CONFIG.ICONS.SUCCESS : SLACK_CONFIG.ICONS.FAILURE}*${isSuccess ? 'Succeeded' : 'Failed'}*`,
        totalRunTime: formatDuration(totalDurationMinutes),
        triggerUser: triggerUserSlackId,
        workflowData,
      });

      await this.slackMessages.sendBuildMessage(notificationData, SLACK_CHANNELS.deploy);
    } catch (error) {
      console.error('Error handling build event:', error);
      throw error;
    }
  }
}

module.exports = EventHandler;
