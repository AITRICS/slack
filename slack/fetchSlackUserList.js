/**
 * Slack `users.list` API response type.
 *
 * @typedef {Object} SlackMember
 * @property {string} id           Slack user ID
 * @property {string} real_name    Real name
 * @property {boolean} deleted     Deactivated flag
 * @property {{display_name: string}} profile  Profile (subset)
 *
 * @see https://api.slack.com/methods/users.list
 */

/**
 * Retrieves the list of Slack users.
 *
 * @param {import('@slack/web-api').WebClient} web Slack WebClient instance
 * @returns {Promise<SlackMember[]>} Slack member array (subset)
 * @throws {Error} If the Slack API request fails
 */
async function fetchSlackUserList(web) {
  try {
    const { members } = await web.users.list();
    return members;
  } catch (error) {
    console.error('Error fetching Slack user list:', error);
    throw error;
  }
}

module.exports = fetchSlackUserList;
