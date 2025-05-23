const { GITHUB_CONFIG } = require('../constants');

class GitHubApiHelper {
  /**
   * GitHubApiHelper class constructor.
   * @param {import('@octokit/rest').Octokit} octokit - Octokit instance.
   */
  constructor(octokit) {
    this.octokit = octokit;
  }

  /**
   * Fetches the member list of a specific GitHub team.
   * @param {string} teamSlug - The slug of the GitHub team.
   * @returns {Promise<Array>} A promise that resolves to team members.
   * @throws Will throw an error if the GitHub API request fails.
   */
  async fetchTeamMembers(teamSlug) {
    try {
      const response = await this.octokit.teams.listMembersInOrg({
        org: GITHUB_CONFIG.ORGANIZATION,
        team_slug: teamSlug,
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching member list for team slug ${teamSlug}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves the GitHub username of the author of a specific review comment.
   * @param {string} repoName - The name of the repository.
   * @param {number} commentId - The ID of the review comment.
   * @returns {Promise<string>} The GitHub username of the comment author.
   * @throws Will throw an error if the GitHub API request fails.
   */
  async fetchCommentAuthor(repoName, commentId) {
    try {
      const response = await this.octokit.rest.pulls.getReviewComment({
        owner: GITHUB_CONFIG.ORGANIZATION,
        repo: repoName,
        comment_id: commentId,
      });
      return response.data.user.login;
    } catch (error) {
      console.error(`Error fetching author of comment ID ${commentId} in repository '${repoName}':`, error);
      throw error;
    }
  }

  /**
   * Fetches all review comments for a pull request to find thread participants.
   * @param {string} repoName - The name of the repository.
   * @param {number} prNumber - The number of the pull request.
   * @param {string} path - The file path of the comment.
   * @param {number} line - The line number of the comment.
   * @returns {Promise<Array>} Array of usernames who participated in the comment thread.
   * @throws Will throw an error if the GitHub API request fails.
   */
  async fetchCommentThreadParticipants(repoName, prNumber, path, line) {
    try {
      const response = await this.octokit.rest.pulls.listReviewComments({
        owner: GITHUB_CONFIG.ORGANIZATION,
        repo: repoName,
        pull_number: prNumber,
      });

      // Filter comments that are on the same line and path
      const threadComments = response.data.filter((comment) => {
        // For multi-line comments, check if it's part of the same discussion
        const isSamePath = comment.path === path;
        const isSameLine = comment.line === line || comment.original_line === line;
        const isInReplyChain = comment.in_reply_to_id !== undefined;

        return isSamePath && (isSameLine || isInReplyChain);
      });

      // Extract unique usernames from thread participants
      const participants = [...new Set(threadComments.map((comment) => comment.user.login))];
      return participants;
    } catch (error) {
      console.error(`Error fetching comment thread participants for PR ${prNumber}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves the GitHub user's real name based on their username.
   * @param {string} username - The GitHub username to retrieve the real name for.
   * @returns {Promise<string>} The real name of the GitHub user or username if name is not available.
   * @throws Will throw an error if the GitHub API request fails.
   */
  async fetchUserRealName(username) {
    try {
      const response = await this.octokit.rest.users.getByUsername({
        username,
      });
      return response.data.name || username;
    } catch (error) {
      console.error(`Error fetching GitHub user info for ${username}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves the reviews for a given pull request.
   * @param {string} repoName - The name of the repository.
   * @param {number} prNumber - The number of the pull request.
   * @returns {Promise<Array>} A promise that resolves to review objects.
   * @throws Will throw an error if the GitHub API request fails.
   */
  async fetchPullRequestReviews(repoName, prNumber) {
    try {
      const response = await this.octokit.rest.pulls.listReviews({
        owner: GITHUB_CONFIG.ORGANIZATION,
        repo: repoName,
        pull_number: prNumber,
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching PR reviews for PR number ${prNumber}:`, error);
      throw error;
    }
  }

  /**
   * Fetches the details of a pull request.
   * @param {string} repoName - The name of the repository.
   * @param {number} prNumber - The number of the pull request.
   * @returns {Promise<Object>} A promise that resolves to pull request details.
   * @throws Will throw an error if the GitHub API request fails.
   */
  async fetchPullRequestDetails(repoName, prNumber) {
    try {
      const response = await this.octokit.rest.pulls.get({
        owner: GITHUB_CONFIG.ORGANIZATION,
        repo: repoName,
        pull_number: prNumber,
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching PR details for PR number ${prNumber}:`, error);
      throw error;
    }
  }

  /**
   * Fetches all open pull requests for a given repository.
   * @param {string} repoName - Repository name.
   * @returns {Promise<Array>} A promise that resolves to open pull request objects.
   * @throws Will throw an error if the GitHub API request fails.
   */
  async fetchOpenPullRequests(repoName) {
    try {
      const response = await this.octokit.rest.pulls.list({
        owner: GITHUB_CONFIG.ORGANIZATION,
        repo: repoName,
        state: 'open',
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching open PRs for repo ${repoName}:`, error);
      throw error;
    }
  }

  /**
   * Fetches the GitHub Actions workflow run data.
   * @param {string} repoName - The name of the GitHub repository.
   * @param {string} runId - The ID of the workflow run.
   * @returns {Promise<Object>} A promise containing the GitHub Actions workflow run data.
   * @throws Will throw an error if the GitHub API request fails.
   */
  async fetchWorkflowRunData(repoName, runId) {
    try {
      const response = await this.octokit.actions.getWorkflowRun({
        owner: GITHUB_CONFIG.ORGANIZATION,
        repo: repoName,
        run_id: runId,
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching workflow run data for run ID ${runId}:`, error);
      throw error;
    }
  }
}

module.exports = GitHubApiHelper;
