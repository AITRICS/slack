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
    const a = results.find((slug) => slug !== null);
    return a;
  } catch (error) {
    console.error('Error finding team slug for GitHub user:', error);
    throw error;
  }
}

module.exports = findTeamSlugForGithubUser;
