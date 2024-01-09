/**
 * Finds the team slug for a given GitHub user from a list of GitHub team slugs.
 * @param {Octokit} octokit - The Octokit instance.
 * @param {string} githubName - The GitHub username to search for.
 * @param {string[]} githubTeamSlugs - An array of GitHub team slugs.
 * @returns {Promise<string|null>} The team slug if the user is found, null otherwise.
 * @throws Will throw an error if the GitHub API request fails.
 */
async function findTeamSlugForGithubUser(octokit, githubName, githubTeamSlugs) {
  try {
    const memberChecks = githubTeamSlugs.map(async (teamSlug) => {
      const memberList = await octokit.teams.listMembersInOrg({
        org: 'aitrics',
        team_slug: teamSlug,
      });

      const member = memberList.data.find(({ login }) => login === githubName);
      return member ? teamSlug : null;
    });

    const results = await Promise.all(memberChecks);
    return results.find((slug) => slug !== null);
  } catch (error) {
    console.error('Error finding team slug for GitHub user:', error);
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
async function getCommentAuthor(octokit, repo, commentId) {
  try {
    // Fetching the review comment from GitHub using the Octokit client.
    const response = await octokit.rest.pulls.getReviewComment({
      owner: 'aitrics',
      repo,
      comment_id: commentId,
    });
    return response.data.user.login;
  } catch (error) {
    console.error(error);
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
async function getGithubNickNameToGitHub(octokit, githubName) {
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
 * @param {string} owner - The owner of the repository.
 * @param {string} repo - The name of the repository.
 * @param {number} prNumber - The number of the pull request for which reviews are being fetched.
 * @returns {Promise<Object>} A promise that resolves to an array of review objects for the pull request.
 */
async function getPullRequestReviews(octokit, owner, repo, prNumber) {
  try {
    const reviewsResponse = await octokit.rest.pulls.listReviews({
      owner,
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
 * @param {string} owner - The owner of the repository.
 * @param {string} repo - The name of the repository.
 * @param {number} prNumber - The number of the pull request.
 * @returns {Promise<Object>} A promise that resolves to an object containing the pull request details.
 */
async function getPullRequestDetails(octokit, owner, repo, prNumber) {
  try {
    const prDetails = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });
    return prDetails.data;
  } catch (error) {
    console.error(`Error fetching PR details for PR number ${prNumber}:`, error);
    throw error; // 혹은 에러에 따라 적절한 처리를 할 수 있습니다.
  }
}

module.exports = {
  getGithubNickNameToGitHub,
  getCommentAuthor,
  findTeamSlugForGithubUser,
  getPullRequestReviews,
  getPullRequestDetails,
};
