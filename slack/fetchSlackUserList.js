/**
 * Retrieves the list of Slack users.
 * @param {WebClient} web - The Slack WebClient instance for API requests.
 * @returns {Promise<Array>} The list of Slack users.
 * @throws Will throw an error if the Slack API request fails.
 */
async function fetchSlackUserList(web) {
  try {
    const slackUserList = await web.users.list();
    return slackUserList.members;
  } catch (error) {
    console.error('Error fetching Slack user list:', error);
    throw error;
  }
}

module.exports = fetchSlackUserList;
