const { SlackAPIError } = require('../utils/errors');
const Logger = require('../utils/logger');

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
 * @param {import('@slack/web-api').WebClient} webClient Slack WebClient instance
 * @returns {Promise<SlackMember[]>} Slack member array (subset)
 * @throws {SlackAPIError} If the Slack API request fails
 */
async function fetchSlackUserList(webClient) {
  try {
    Logger.debug('Slack 사용자 목록 조회 시작');

    const result = await webClient.users.list();
    const { members } = result;

    if (!members || !Array.isArray(members)) {
      throw new SlackAPIError(
        'Slack API에서 유효하지 않은 응답을 받았습니다',
        { apiResponse: result },
      );
    }

    Logger.debug(`Slack 사용자 목록 조회 완료: ${members.length}명`);
    return members;
  } catch (error) {
    Logger.error('Slack 사용자 목록 조회 실패', error);

    if (error instanceof SlackAPIError) {
      throw error;
    }

    throw new SlackAPIError(
      'Slack 사용자 목록 조회 중 오류 발생',
      { originalError: error.message },
    );
  }
}

module.exports = fetchSlackUserList;
