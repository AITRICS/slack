const { SLACK_CHANNELS, GITHUB_CONFIG } = require('../constants');
const Logger = require('../utils/logger');

/**
 * Service for managing Slack channel selection with optimized API usage
 */
class SlackChannelService {
  /**
   * @param {import('../github/gitHubApiHelper')} gitHubApiHelper
   */
  constructor(gitHubApiHelper) {
    this.gitHubApiHelper = gitHubApiHelper;
    this.teamMembershipCache = new Map(); // GitHub username -> team slug
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
    this.lastCacheUpdate = new Map(); // team slug -> timestamp
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
   * Finds the team slug for a GitHub user with caching
   * @param {string} githubUsername
   * @returns {Promise<string|null>}
   */
  async findUserTeamSlug(githubUsername) {
    // Check cache first
    if (this.teamMembershipCache.has(githubUsername)) {
      return this.teamMembershipCache.get(githubUsername);
    }

    const teamChecks = GITHUB_CONFIG.TEAM_SLUGS.map(async (teamSlug) => {
      try {
        // Check if team cache is expired
        const lastUpdate = this.lastCacheUpdate.get(teamSlug) || 0;
        const now = Date.now();

        if (now - lastUpdate > this.cacheExpiry) {
          // Cache is expired, refresh team members
          await this.refreshTeamCache(teamSlug);
        }

        // Check cached team membership
        const cacheKey = `${teamSlug}:${githubUsername}`;
        if (this.teamMembershipCache.has(cacheKey)) {
          return this.teamMembershipCache.get(cacheKey) ? teamSlug : null;
        }

        // If not in cache, fetch and check
        const members = await this.gitHubApiHelper.fetchTeamMembers(teamSlug);
        const isMember = members.some(({ login }) => login === githubUsername);

        // Cache the result
        this.teamMembershipCache.set(cacheKey, isMember);

        return isMember ? teamSlug : null;
      } catch (error) {
        Logger.error(`Failed to check team membership for ${teamSlug}`, error);
        return null;
      }
    });

    const results = await Promise.all(teamChecks);
    const userTeamSlug = results.find((slug) => slug !== null) || null;

    // Cache the user's team membership
    this.teamMembershipCache.set(githubUsername, userTeamSlug);

    return userTeamSlug;
  }

  /**
   * Refreshes the team membership cache for a specific team
   * @private
   * @param {string} teamSlug
   * @returns {Promise<void>}
   */
  async refreshTeamCache(teamSlug) {
    try {
      const members = await this.gitHubApiHelper.fetchTeamMembers(teamSlug);

      // Update cache for all team members
      members.forEach(({ login }) => {
        const cacheKey = `${teamSlug}:${login}`;
        this.teamMembershipCache.set(cacheKey, true);

        // Also update the user's primary team if not already set
        if (!this.teamMembershipCache.has(login)) {
          this.teamMembershipCache.set(login, teamSlug);
        }
      });

      // Update cache timestamp
      this.lastCacheUpdate.set(teamSlug, Date.now());

      Logger.debug(`Refreshed team cache for ${teamSlug}: ${members.length} members`);
    } catch (error) {
      Logger.error(`Failed to refresh team cache for ${teamSlug}`, error);
    }
  }

  /**
   * Pre-loads team membership data for better performance
   * @returns {Promise<void>}
   */
  async preloadTeamMemberships() {
    try {
      Logger.info('Pre-loading team memberships...');

      await Promise.all(
        GITHUB_CONFIG.TEAM_SLUGS.map((teamSlug) => this.refreshTeamCache(teamSlug)),
      );

      Logger.info(`Pre-loaded team memberships for ${GITHUB_CONFIG.TEAM_SLUGS.length} teams`);
    } catch (error) {
      Logger.error('Failed to pre-load team memberships', error);
    }
  }

  /**
   * Clears the team membership cache
   */
  clearCache() {
    this.teamMembershipCache.clear();
    this.lastCacheUpdate.clear();
    Logger.info('Team membership cache cleared');
  }

  /**
   * Gets cache statistics for debugging
   * @returns {Object}
   */
  getCacheStats() {
    return {
      teamMembershipEntries: this.teamMembershipCache.size,
      teamCacheTimestamps: Object.fromEntries(this.lastCacheUpdate),
      cacheExpiryMs: this.cacheExpiry,
    };
  }
}

module.exports = SlackChannelService;
