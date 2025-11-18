const SlackChannelService = require('../../slack/slackChannelService');
const { SLACK_CHANNELS } = require('../../constants');

describe('SlackChannelService', () => {
  let slackChannelService;
  let mockGitHubApiHelper;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock GitHub API helper
    mockGitHubApiHelper = {
      fetchTeamMembers: jest.fn(),
    };

    slackChannelService = new SlackChannelService(mockGitHubApiHelper);
  });

  describe('selectChannel', () => {
    beforeEach(() => {
      // Setup mock team members based on actual TEAM_SLUGS
      // GITHUB_CONFIG.TEAM_SLUGS = ['SE', 'Platform-frontend', 'Platform-backend']
      mockGitHubApiHelper.fetchTeamMembers
        .mockResolvedValueOnce([
          { login: 'alice' },
          { login: 'bob' },
        ]) // SE team
        .mockResolvedValueOnce([
          { login: 'charlie' },
          { login: 'david' },
        ]) // Platform-frontend team
        .mockResolvedValueOnce([
          { login: 'eve' },
        ]); // Platform-backend team
    });

    it('should return correct channel for SE team member', async () => {
      const channel = await slackChannelService.selectChannel('alice');

      // alice is in SE team, so should return SE channel
      expect(channel).toBe(SLACK_CHANNELS.SE);
      expect(mockGitHubApiHelper.fetchTeamMembers).toHaveBeenCalledTimes(3);
    });

    it('should return correct channel for Platform-frontend team member', async () => {
      const channel = await slackChannelService.selectChannel('charlie');

      expect(channel).toBe(SLACK_CHANNELS['Platform-frontend']);
    });

    it('should return correct channel for Platform-backend team member', async () => {
      const channel = await slackChannelService.selectChannel('eve');

      expect(channel).toBe(SLACK_CHANNELS['Platform-backend']);
    });

    it('should return gitAny channel for non-team member', async () => {
      const channel = await slackChannelService.selectChannel('unknown');

      expect(channel).toBe(SLACK_CHANNELS.gitAny);
    });

    it('should return gitAny channel for empty username', async () => {
      const channel = await slackChannelService.selectChannel('');

      expect(channel).toBe(SLACK_CHANNELS.gitAny);
      expect(mockGitHubApiHelper.fetchTeamMembers).not.toHaveBeenCalled();
    });

    it('should cache team members and not refetch', async () => {
      // First call
      await slackChannelService.selectChannel('alice');
      expect(mockGitHubApiHelper.fetchTeamMembers).toHaveBeenCalledTimes(3);

      // Second call should use cache
      await slackChannelService.selectChannel('bob');
      expect(mockGitHubApiHelper.fetchTeamMembers).toHaveBeenCalledTimes(3); // Still 3
    });
  });

  describe('findUserTeamSlug', () => {
    beforeEach(() => {
      mockGitHubApiHelper.fetchTeamMembers
        .mockResolvedValueOnce([
          { login: 'alice' },
          { login: 'bob' },
        ])
        .mockResolvedValueOnce([
          { login: 'charlie' },
        ])
        .mockResolvedValueOnce([
          { login: 'david' },
        ]);
    });

    it('should find team slug for SE team member', async () => {
      const teamSlug = await slackChannelService.findUserTeamSlug('alice');

      expect(teamSlug).toBe('SE');
    });

    it('should find team slug for Platform-frontend team member', async () => {
      const teamSlug = await slackChannelService.findUserTeamSlug('charlie');

      expect(teamSlug).toBe('Platform-frontend');
    });

    it('should find team slug for Platform-backend team member', async () => {
      const teamSlug = await slackChannelService.findUserTeamSlug('david');

      expect(teamSlug).toBe('Platform-backend');
    });

    it('should return null for non-team member', async () => {
      const teamSlug = await slackChannelService.findUserTeamSlug('unknown');

      expect(teamSlug).toBeNull();
    });
  });

  describe('team member caching', () => {
    it('should load team members only once for multiple calls', async () => {
      mockGitHubApiHelper.fetchTeamMembers
        .mockResolvedValueOnce([{ login: 'alice' }])
        .mockResolvedValueOnce([{ login: 'bob' }])
        .mockResolvedValueOnce([{ login: 'charlie' }]);

      // Multiple calls
      await slackChannelService.findUserTeamSlug('alice');
      await slackChannelService.findUserTeamSlug('bob');
      await slackChannelService.findUserTeamSlug('charlie');
      await slackChannelService.selectChannel('alice');

      // Should only fetch once per team (3 teams total)
      expect(mockGitHubApiHelper.fetchTeamMembers).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent requests without duplicate fetches', async () => {
      mockGitHubApiHelper.fetchTeamMembers
        .mockResolvedValueOnce([{ login: 'alice' }])
        .mockResolvedValueOnce([{ login: 'bob' }])
        .mockResolvedValueOnce([{ login: 'charlie' }]);

      // Concurrent calls
      const promises = [
        slackChannelService.selectChannel('alice'),
        slackChannelService.selectChannel('bob'),
        slackChannelService.selectChannel('charlie'),
      ];

      await Promise.all(promises);

      // Should only fetch once per team despite concurrent calls
      expect(mockGitHubApiHelper.fetchTeamMembers).toHaveBeenCalledTimes(3);
    });
  });
});
