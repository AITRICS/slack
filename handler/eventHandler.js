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
   * Normalizes a name by removing whitespace and parenthetical suffixes.
   *
   * This method standardizes names for consistent matching by:
   * 1. Removing leading/trailing whitespace
   * 2. Removing parenthetical expressions at the end (e.g., nicknames or titles)
   * 3. Converting to lowercase for case-insensitive comparison
   *
   * @example
   * // Returns "john doe"
   * #normalizeName("John Doe (Manager) ")
   *
   * // Returns "이동민"
   * #normalizeName("이동민 (Rooney)")
   *
   * @param {string} raw - The raw name to normalize
   * @returns {string} The normalized name in lowercase without parentheses or extra spaces
   * @private
   */
  static #normalizeName(raw = '') {
    return raw
      .trim() // Remove leading and trailing spaces
      .replace(/\s*\(.*?\)$/, '') // Remove trailing parentheses and content within them
      .toLowerCase();
  }

  /**
   * Finds a specific property of a Slack user by matching their real name or display name with the given GitHub username.
   * @param {Array} slackMembers - The list of Slack users.
   * @param {string} searchName - The GitHub username to search for in Slack user profiles.
   * @param {string} property - The property to retrieve from the Slack user ('id' or 'realName').
   * @returns {string} The requested property of the found Slack user or the searchName if no user is found.
   */
  static #findSlackUserPropertyByGitName(slackMembers, searchName, property) {
    const targetName = this.#normalizeName(searchName);
    const user = slackMembers.find(({ real_name: realName, profile, deleted }) => {
      if (deleted) return false;

      const nameToCheck = [realName, profile.display_name].map((name) => name?.toLowerCase());

      const isSkipUser = nameToCheck.some((name) => SKIP_SLACK_USER.some((skipName) => name?.includes(skipName)));
      if (isSkipUser) return false;

      return nameToCheck.some((sourceName) => {
        if (!sourceName) return false;

        // 양방향 검사 진행
        return sourceName.includes(targetName) || targetName.includes(sourceName);
      });
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
   * Prepares and returns data for a build notification.
   * @param {Object} buildData - The build data.
   * @param {string} buildData.branchName - Branch name.
   * @param {string} buildData.imageTag - Image tag.
   * @param {Object} buildData.repoData - Repository data.
   * @param {string} buildData.ref - The git reference.
   * @param {string} buildData.sha - The git SHA.
   * @param {string} buildData.slackStatus - Slack status, either 'good' for successful job status or 'danger' for failed job status.
   * @param {string} buildData.slackBuildResult - Slack build result, formatted as an emoji and text.
   * @param {number} buildData.totalDurationMinutes - Total duration in minutes.
   * @param {string} buildData.triggerUser - User who triggered the action.
   * @param {Object} buildData.gitActionRunData - Git action run data.
   * @param {string[]} buildData.jobNames - Names of the jobs related to the build.
   * @returns {Object} Prepared notification data.
   */
  static #prepareBuildNotificationData(buildData) {
    const {
      branchName,
      imageTag,
      repoData,
      ref,
      sha,
      slackStatus,
      slackBuildResult,
      totalDurationMinutes,
      triggerUser,
      gitActionRunData,
      jobNames,
    } = buildData;

    const minutes = Math.floor(totalDurationMinutes);
    const seconds = Math.round((totalDurationMinutes - minutes) * 60);

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
      workflowName: gitActionRunData.name,
      totalRunTime: `${minutes}분 ${seconds}초`,
      actionUrl: gitActionRunData.html_url,
      jobNames,
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

  /**
   * Fetches all reviewers for a pull request, including those who haven't submitted a review yet.
   *
   * @param {Array} slackMembers - The list of Slack users.
   * @param {string} repoName - The name of the repository.
   * @param {number} prNumber - The number of the pull request.
   * @returns {Promise<Array>} A promise that resolves to an array of reviewers' Slack IDs.
   */
  async #fetchAllPRReviewers(slackMembers, repoName, prNumber) {
    try {
      const prDetails = await this.gitHubApiHelper.fetchPullRequestDetails(repoName, prNumber);

      // Get requested reviewers who haven't submitted a review yet
      const requestedReviewers = prDetails.requested_reviewers || [];

      // Get users who have already submitted reviews
      const reviews = await this.gitHubApiHelper.fetchPullRequestReviews(repoName, prNumber);
      const reviewSubmitters = reviews.map((review) => review.user.login);

      // Combine both lists and remove duplicates
      const allReviewers = [...new Set([...requestedReviewers.map((r) => r.login), ...reviewSubmitters])];

      // Map GitHub usernames to Slack IDs and return directly
      return Promise.all(
        allReviewers.map(async (githubUsername) => {
          const slackId = await this.#getSlackUserProperty(slackMembers, githubUsername, 'id');
          return { githubUsername, slackId };
        }),
      );
    } catch (error) {
      console.error(`Error fetching PR reviewers for PR number ${prNumber}:`, error);
      return [];
    }
  }

  /**
   * EventHandler class processes different GitHub event types and sends corresponding notifications to Slack.
   * It handles four main types of events: comment, PR page comment, approve, and review request.
   * @param {object} payload - The payload of the GitHub event.
   */
  async handleComment(payload) {
    // 두 가지 코멘트 타입 구분
    const isPRPageComment = payload.comment.issue_url !== undefined;

    if (isPRPageComment) {
      await this.#handlePRPageComment(payload);
    } else {
      await this.#handleCodeComment(payload);
    }
  }

  /**
   * Handles code review comments (comments on specific lines of code).
   * @param {object} payload - The payload of the GitHub comment event.
   */
  async #handleCodeComment(payload) {
    const notificationData = {
      commentUrl: payload.comment?.html_url,
      mentionedGitName: payload.pull_request?.user.login,
      prUrl: payload.pull_request?.html_url,
      commentAuthorGitName: payload.comment?.user.login,
      commentBody: payload.comment?.body,
      prTitle: payload.pull_request?.title,
      commentContent: payload.comment?.diff_hunk,
    };

    // Check if the comment is a reply to another comment.
    if (payload.comment.in_reply_to_id) {
      // Get the author of the original comment this one is replying to.
      const previousCommentAuthor = await this.gitHubApiHelper.fetchCommentAuthor(
        payload.repository.name,
        payload.comment.in_reply_to_id,
      );

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

  /**
   * Handles comments on the PR page (not on specific code lines).
   * @param {object} payload - The payload of the GitHub comment event.
   */
  async #handlePRPageComment(payload) {
    try {
      // 필요한 기본 정보 추출
      const repoName = payload.repository.name;
      const prNumber = payload.issue.number; // PR 번호는 issue.number에 있음
      const commentAuthorGitName = payload.comment.user.login;

      // PR 세부 정보 가져오기
      const prDetails = await this.gitHubApiHelper.fetchPullRequestDetails(repoName, prNumber);
      const prAuthorGitName = prDetails.user.login;

      // Slack 멤버 정보 가져오기
      const slackMembers = await fetchSlackUserList(this.web);

      // PR의 모든 리뷰어 정보 가져오기
      const reviewers = await this.#fetchAllPRReviewers(slackMembers, repoName, prNumber);

      // 코멘트 작성자의 Slack 이름 가져오기
      const commentAuthorSlackRealName = await this.#getSlackUserProperty(
        slackMembers,
        commentAuthorGitName,
        'realName',
      );

      let recipients = [];

      // 코멘트 작성자가 PR 작성자인 경우: 모든 리뷰어에게 알림 (작성자 제외)
      if (commentAuthorGitName === prAuthorGitName) {
        recipients = reviewers.filter((reviewer) => reviewer.githubUsername !== commentAuthorGitName);
      }
      // 코멘트 작성자가 리뷰어인 경우: 다른 모든 리뷰어 + PR 작성자에게 알림 (작성자 제외)
      else {
        // PR 작성자가 이미 reviewers 목록에 있는지 확인
        const prAuthorInReviewers = reviewers.some(
          (reviewer) => reviewer.githubUsername === prAuthorGitName,
        );

        // reviewers에서 코멘트 작성자를 제외한 리뷰어들
        const filteredReviewers = reviewers.filter(
          (reviewer) => reviewer.githubUsername !== commentAuthorGitName,
        );

        // PR 작성자가 reviewers에 없는 경우에만 추가
        if (!prAuthorInReviewers) {
          const prAuthorSlackId = await this.#getSlackUserProperty(slackMembers, prAuthorGitName, 'id');
          recipients = [
            { githubUsername: prAuthorGitName, slackId: prAuthorSlackId },
            ...filteredReviewers,
          ];
        } else {
          recipients = filteredReviewers;
        }
      }

      // 수신자가 없으면 메시지 전송하지 않음
      if (recipients.length === 0) {
        console.log('PR 페이지 코멘트에 대한 수신자가 없습니다.');
        return;
      }

      // 중복 제거를 위한 Set 사용
      const uniqueRecipients = [];
      const addedGithubUsernames = new Set();

      // 중복 수신자 제거
      recipients.forEach((recipient) => {
        if (!addedGithubUsernames.has(recipient.githubUsername)) {
          addedGithubUsernames.add(recipient.githubUsername);
          uniqueRecipients.push(recipient);
        }
      });

      // 각 수신자의 채널 찾기 및 채널별로, 팀별로 그룹화
      const recipientsByChannel = {};

      await Promise.all(
        uniqueRecipients.map(async (recipient) => {
          // 각 수신자가 속한 채널 찾기
          const channelId = await this.#selectSlackChannel(recipient.githubUsername);

          // 채널별로 수신자 그룹화
          if (!recipientsByChannel[channelId]) {
            recipientsByChannel[channelId] = [];
          }

          recipientsByChannel[channelId].push(recipient);
        }),
      );

      // 각 채널에 맞는 메시지 전송
      await Promise.all(
        Object.entries(recipientsByChannel).map(async ([channelId, channelRecipients]) => {
          // 현재 채널의 수신자들만 멘션하는 문자열 생성
          const mentionsString = channelRecipients
            .map((recipient) => `<@${recipient.slackId}>`)
            .join(', ');

          // 통합 알림 데이터 생성
          const notificationData = {
            commentUrl: payload.comment.html_url,
            prUrl: `https://github.com/${payload.repository.full_name}/pull/${prNumber}`,
            commentAuthorGitName,
            commentBody: payload.comment.body,
            prTitle: prDetails.title,
            commentAuthorSlackRealName,
            mentionsString,
          };

          // 해당 채널에 메시지 전송
          await this.slackMessages.sendSlackMessageToPRPageComment(notificationData, channelId);

          console.log(`채널 ${channelId}에 ${channelRecipients.length}명의 수신자에게 PR 페이지 코멘트 알림을 전송했습니다.`);
        }),
      );
    } catch (error) {
      console.error('PR 페이지 코멘트 처리 중 오류 발생:', error);
    }
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

  /**
   * Handles build notifications triggered by GitHub Actions.
   * @param {object} context - The GitHub Actions context.
   * @param {string} branchName - The branch name where the build was triggered.
   * @param {string} imageTag - The image tag associated with the build.
   * @param {string} jobName - The name of the job that triggered the notification.
   * @param {string} jobStatus - The status of the job (success or failure).
   */
  async handleBuild(context, branchName, imageTag, jobName, jobStatus) {
    const repoData = EventHandler.#extractRepoData(context.payload.repository);
    const gitActionRunData = await this.gitHubApiHelper.fetchGitActionRunData(repoData.name, context.runId);
    const slackMembers = await fetchSlackUserList(this.web);
    const totalDurationMinutes = EventHandler.#calculateDurationInMinutes(gitActionRunData.run_started_at, new Date());
    const mentionedSlackId = await this.#getSlackUserProperty(slackMembers, gitActionRunData.actor.login, 'id');

    const jobNames = jobName ? jobName.split(',').map((name) => name.trim()) : [];

    const notificationData = EventHandler.#prepareBuildNotificationData({
      branchName: branchName || context.ref.replace('refs/heads/', ''),
      jobNames,
      imageTag,
      repoData,
      sha: context.sha,
      slackStatus: jobStatus === 'success' ? 'good' : 'danger',
      slackBuildResult: jobStatus === 'success' ? ':white_check_mark:*Succeeded*' : ':x:*Failed*',
      totalDurationMinutes,
      triggerUser: mentionedSlackId,
      gitActionRunData,
    });

    await this.slackMessages.sendSlackMessageToBuild(notificationData, SLACK_CHANNEL.deploy);
  }
}

module.exports = EventHandler;
