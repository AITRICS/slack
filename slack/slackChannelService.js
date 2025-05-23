const { SLACK_CHANNELS, GITHUB_CONFIG } = require('../constants');
const Logger = require('../utils/logger');

/**
 * Service for managing Slack channel selection
 */
class SlackChannelService {
  /**
   * @param {import('../github/gitHubApiHelper')} gitHubApiHelper
   */
  constructor(gitHubApiHelper) {
    this.gitHubApiHelper = gitHubApiHelper;
  }

  /**
   * Selects the appropriate Slack channel based on GitHub username
   * @param {string} githubUsername
   * @returns {Promise<string>} Channel ID
   */
  async selectChannel(githubUsername) {
    if (!githubUsername) {
      Logger.error('Invalid GitHub username for channel selection');
      return SLACK_CHANNELS.gitAny;
    }

    try {
      const teamSlug = await this.findUserTeamSlug(githubUsername);
      return SLACK_CHANNELS[teamSlug] || SLACK_CHANNELS.gitAny;
    } catch (error) {
      Logger.error(`Failed to select channel for ${githubUsername}`, error);
      return SLACK_CHANNELS.gitAny;
    }
  }

  /**
   * Finds the team slug for a GitHub user
   * @private
   * @param {string} githubUsername
   * @returns {Promise<string|null>}
   */
  async findUserTeamSlug(githubUsername) {
    const teamChecks = GITHUB_CONFIG.TEAM_SLUGS.map(async (teamSlug) => {
      try {
        const members = await this.gitHubApiHelper.fetchTeamMembers(teamSlug);
        return members.some(({ login }) => login === githubUsername) ? teamSlug : null;
      } catch (error) {
        Logger.error(`Failed to check team membership for ${teamSlug}`, error);
        return null;
      }
    });

    const results = await Promise.all(teamChecks);
    return results.find((slug) => slug !== null) || null;
  }
}

module.exports = SlackChannelService;
