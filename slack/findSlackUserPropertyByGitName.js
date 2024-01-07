/**
 * Finds a specific property of a Slack user by matching their real name or display name with the given GitHub username.
 * @param {WebClient} web - The Slack WebClient instance for API requests.
 * @param {string} searchName - The GitHub username to search for in Slack user profiles.
 * @param {string} property - The property to retrieve from the Slack user ('id' or 'realName').
 * @returns {Promise<string>} The requested property of the found Slack user or the searchName if no user is found.
 * @throws Will throw an error if the Slack API request fails.
 */
async function findSlackUserPropertyByGitName(web, searchName, property) {
  try {
    const slackUserList = await web.users.list();
    const lowerCaseSearchName = searchName.toLowerCase();

    const user = slackUserList.members.find(({ real_name: realName, profile }) => {
      const nameToCheck = [realName, profile.display_name].map((name) => name?.toLowerCase());
      return nameToCheck.some((name) => name?.includes(lowerCaseSearchName));
    });

    if (user) {
      if (property === 'id') {
        return user.id;
      }
      if (property === 'realName') {
        return user.profile.display_name;
      }
    }

    return searchName;
  } catch (error) {
    console.error('Error finding Slack user property:', error);
    throw error;
  }
}

module.exports = findSlackUserPropertyByGitName;
