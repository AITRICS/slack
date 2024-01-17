class GitHubApiHelper {
  /**
   * GitHubClient class constructor.
   * @param {Octokit} octokit - Octokit instance.
   */
  constructor(octokit) {
    this.octokit = octokit;
  }

  /**
   * Fetches the member list of a specific GitHub team.
   * @param {string} teamSlug - The slug of the GitHub team.
   * @returns {Promise<Object>} A promise that resolves to team members.
   * @throws Will throw an error if the GitHub API request fails.
   */
  async fetchListMembersInOrg(teamSlug) {
    try {
      const memberList = await this.octokit.teams.listMembersInOrg({
        org: 'aitrics',
        team_slug: teamSlug,
      });
      return memberList.data;
    } catch (error) {
      console.error(`Error fetching member list for team slug ${teamSlug}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves the GitHub username of the author of a specific review comment.
   * @param {string} repoName - The name of the repository.
   * @param {number} commentId - The ID of the review comment.
   * @returns {Promise<string|null>} The GitHub username of the comment author, or null if an error occurs.
   */
  async fetchCommentAuthor(repoName, commentId) {
    try {
      // Fetching the review comment from GitHub using the Octokit client.
      const response = await this.octokit.rest.pulls.getReviewComment({
        owner: 'aitrics',
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
   * Retrieves the GitHub user's real name based on their username.
   * @param {string} githubName - The GitHub username to retrieve the real name for.
   * @returns {Promise<string>} The real name of the GitHub user.
   * @throws Will throw an error if the GitHub API request fails.
   */
  async fetchGithubNickNameToGitHub(githubName) {
    try {
      const res = await this.octokit.rest.users.getByUsername({
        username: githubName,
      });
      return res.data.name || githubName;
    } catch (error) {
      console.error('Error fetching GitHub username:', error);
      throw error;
    }
  }

  /**
   * Retrieves the reviews for a given pull request.
   *
   * @param {string} repoName - The name of the repository.
   * @param {string|number} prNumber - The number of the pull request for which reviews are being fetched.
   * @returns {Promise<Object>} A promise that resolves to review objects for the pull request.
   */
  async fetchPullRequestReviews(repoName, prNumber) {
    try {
      const reviewsResponse = await this.octokit.rest.pulls.listReviews({
        owner: 'aitrics',
        repo: repoName,
        pull_number: prNumber,
      });
      return reviewsResponse.data;
    } catch (error) {
      console.error(`Error fetching PR reviews for PR number ${prNumber}:`, error);
      throw error; // 혹은 에러에 따라 적절한 처리를 할 수 있습니다.
    }
  }

  /**
   * Fetches the details of a pull request.
   *
   * @param {string} repoName - The name of the repository.
   * @param {number} prNumber - The number of the pull request.
   * @returns {Promise<Object>} A promise that resolves to an object containing the pull request details.
   */
  async fetchPullRequestDetails(repoName, prNumber) {
    try {
      const prDetails = await this.octokit.rest.pulls.get({
        owner: 'aitrics',
        repo: repoName,
        pull_number: prNumber,
      });
      return prDetails.data;
    } catch (error) {
      console.error(`Error fetching PR details for PR number ${prNumber}:`, error);
      throw error;
    }
  }

  /**
   * Fetches all open pull requests for a given repository.
   *
   * @param {string} repoName - Repository name.
   * @returns {Promise<Array>} A promise that resolves to open pull request objects.
   */
  async fetchOpenPullRequests(repoName) {
    try {
      const response = await this.octokit.rest.pulls.list({
        owner: 'aitrics',
        repo: repoName,
        state: 'open',
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching open PRs for repo ${repoName}`, error);
      throw error;
    }
  }

  /**
   * Fetches the GitHub Actions workflow run data.
   * @param {string} repoName - The name of the GitHub repository.
   * @param {string} runId - The ID of the workflow run.
   * @returns {Promise<Object>} A promise containing the GitHub Actions workflow run data.
   */
  async fetchGitActionRunData(repoName, runId) {
    try {
      const response = await this.octokit.actions.getWorkflowRun({
        owner: 'aitrics',
        repo: repoName,
        run_id: runId,
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching action run status for run ID ${runId}:`, error);
      throw error;
    }
  }
}

module.exports = GitHubApiHelper;
