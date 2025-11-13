const SlackUserService = require('../../slack/slackUserService');
const { createMockSlackWeb } = require('../mocks/commonMocks');

describe('SlackUserService', () => {
  let slackUserService;
  let mockWeb;
  let mockGitHubApiHelper;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWeb = createMockSlackWeb();
    mockGitHubApiHelper = {
      fetchUserRealName: jest.fn(),
    };
    slackUserService = new SlackUserService(mockWeb, mockGitHubApiHelper);
  });

  describe('getSlackProperty', () => {
    it('should return Slack ID for valid GitHub username', async () => {
      mockGitHubApiHelper.fetchUserRealName.mockResolvedValue('최경환');

      const slackId = await slackUserService.getSlackProperty('ray', 'id');

      expect(slackId).toBe('U12345');
      expect(mockWeb.users.list).toHaveBeenCalledTimes(1);
    });

    it('should return Slack real name for valid GitHub username', async () => {
      mockGitHubApiHelper.fetchUserRealName.mockResolvedValue('최경환');

      const realName = await slackUserService.getSlackProperty('ray', 'realName');

      // findSlackUserProperty returns GitHub username when property is 'realName'
      expect(realName).toBe('ray');
    });

    it('should return GitHub username when user not found', async () => {
      mockGitHubApiHelper.fetchUserRealName.mockResolvedValue('Unknown User');

      const result = await slackUserService.getSlackProperty('unknown', 'id');

      // Returns GitHub real name when Slack user not found
      expect(result).toBe('Unknown User');
    });

    it('should handle empty GitHub username', async () => {
      const result = await slackUserService.getSlackProperty('', 'id');

      expect(result).toBe('');
    });

    it('should cache Slack users and not refetch', async () => {
      mockGitHubApiHelper.fetchUserRealName.mockResolvedValue('최경환');

      // First call
      await slackUserService.getSlackProperty('ray', 'id');
      expect(mockWeb.users.list).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await slackUserService.getSlackProperty('ray', 'realName');
      expect(mockWeb.users.list).toHaveBeenCalledTimes(1);
    });

    it('should handle errors when fetching users', async () => {
      mockWeb.users.list.mockRejectedValueOnce(new Error('API Error'));

      const result = await slackUserService.getSlackProperty('testuser', 'id');

      // Should return the github username on error
      expect(result).toBe('testuser');
    });
  });

  describe('getSlackProperties', () => {
    it('should return multiple Slack IDs for GitHub usernames', async () => {
      mockGitHubApiHelper.fetchUserRealName
        .mockResolvedValueOnce('최경환')
        .mockResolvedValueOnce('홍길동');

      const result = await slackUserService.getSlackProperties(['ray', 'hong'], 'id');

      expect(result.get('ray')).toBe('U12345');
      expect(result.get('hong')).toBe('홍길동'); // Returns GitHub real name when not in Slack
      expect(mockWeb.users.list).toHaveBeenCalledTimes(1);
    });

    it('should handle errors for individual users', async () => {
      mockGitHubApiHelper.fetchUserRealName
        .mockResolvedValueOnce('최경환')
        .mockRejectedValueOnce(new Error('User not found'));

      const result = await slackUserService.getSlackProperties(['ray', 'unknown'], 'id');

      expect(result.get('ray')).toBe('U12345');
      expect(result.get('unknown')).toBe('unknown');
    });
  });

  describe('addSlackIdsToRecipients', () => {
    it('should add Slack IDs to recipients', async () => {
      mockGitHubApiHelper.fetchUserRealName
        .mockResolvedValueOnce('최경환')
        .mockResolvedValueOnce('홍길동');

      const recipients = [
        { githubUsername: 'ray' },
        { githubUsername: 'hong' },
      ];

      const result = await slackUserService.addSlackIdsToRecipients(recipients);

      expect(result).toEqual([
        { githubUsername: 'ray', slackId: 'U12345' },
        { githubUsername: 'hong', slackId: '홍길동' }, // Returns GitHub real name when not found
      ]);
    });

    it('should handle empty recipients list', async () => {
      const result = await slackUserService.addSlackIdsToRecipients([]);

      expect(result).toEqual([]);
      expect(mockWeb.users.list).toHaveBeenCalledTimes(1);
    });
  });
});
