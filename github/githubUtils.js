/**
 * Fetches the member list of a specific GitHub team.
 * @param {Octokit} octokit - The Octokit instance.
 * @param {string} teamSlug - The slug of the GitHub team.
 * @returns {Promise<Array>} A promise that resolves to an array of team members.
 * @throws Will throw an error if the GitHub API request fails.
 */
async function fetchListMembersInOrg(octokit, teamSlug) {
  try {
    const memberList = await octokit.teams.listMembersInOrg({
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
 * @param {Octokit} octokit - The Octokit instance.
 * @param {string} repo - The name of the repository.
 * @param {number} commentId - The ID of the review comment.
 * @returns {Promise<string|null>} The GitHub username of the comment author, or null if an error occurs.
 */
async function fetchCommentAuthor(octokit, repo, commentId) {
  try {
    // Fetching the review comment from GitHub using the Octokit client.
    const response = await octokit.rest.pulls.getReviewComment({
      owner: 'aitrics',
      repo,
      comment_id: commentId,
    });
    return response.data.user.login;
  } catch (error) {
    console.error(`Error fetching author of comment ID ${commentId} in repository '${repo}':`, error);
    throw error;
  }
}

/**
 * Retrieves the GitHub user's real name based on their username.
 * @param {Octokit} octokit - The Octokit instance for GitHub API requests.
 * @param {string} githubName - The GitHub username to retrieve the real name for.
 * @returns {Promise<string>} The real name of the GitHub user.
 * @throws Will throw an error if the GitHub API request fails.
 */
async function fetchGithubNickNameToGitHub(octokit, githubName) {
  try {
    const res = await octokit.rest.users.getByUsername({
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
 * @param {Octokit} octokit - The Octokit instance used for GitHub API requests.
 * @param {string} repo - The name of the repository.
 * @param {number} prNumber - The number of the pull request for which reviews are being fetched.
 * @returns {Promise<Object>} A promise that resolves to review objects for the pull request.
 */
async function fetchPullRequestReviews(octokit, repo, prNumber) {
  try {
    const reviewsResponse = await octokit.rest.pulls.listReviews({
      owner: 'aitrics',
      repo,
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
 * @param {Octokit} octokit - The Octokit instance.
 * @param {string} repo - The name of the repository.
 * @param {number} prNumber - The number of the pull request.
 * @returns {Promise<Object>} A promise that resolves to an object containing the pull request details.
 */
async function fetchPullRequestDetails(octokit, repo, prNumber) {
  try {
    const prDetails = await octokit.rest.pulls.get({
      owner: 'aitrics',
      repo,
      pull_number: prNumber,
    });
    return prDetails.data;
  } catch (error) {
    console.error(`Error fetching PR details for PR number ${prNumber}:`, error);
    throw error; // 혹은 에러에 따라 적절한 처리를 할 수 있습니다.
  }
}

/**
 * Fetches all open pull requests for a given repository.
 *
 * @param {Octokit} octokit - Octokit instance for GitHub API requests.
 * @param {string} repo - Repository name.
 * @returns {Promise<Object>} A promise that resolves to open pull request objects.
 */
async function fetchOpenPullRequests(octokit, repo) {
  try {
    const response = await octokit.rest.pulls.list({
      owner: 'aitrics',
      repo,
      state: 'open',
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching open PRs for repo ${repo}`, error);
    throw error;
  }
}

async function fetchGitActionRunData(octokit, repo, runId) {
  try {
    const response = await octokit.actions.getWorkflowRun({
      owner: 'aitrics',
      repo,
      run_id: runId,
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching action run status for run ID ${runId}:`, error);
    throw error;
  }
}

module.exports = {
  fetchGithubNickNameToGitHub,
  fetchCommentAuthor,
  fetchListMembersInOrg,
  fetchPullRequestReviews,
  fetchPullRequestDetails,
  fetchOpenPullRequests,
  fetchGitActionRunData,
};
