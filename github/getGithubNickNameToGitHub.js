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

module.exports = getGithubNickNameToGitHub;
