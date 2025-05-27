const SlackUserService = require('../../slack/slackUserService');
const { createMockOctokit, createMockSlackWeb, mockSlackMembers } = require('../mocks/commonMocks');

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

  describe('getSlackUsers', () => {
    it('should fetch and cache Slack users', async () => {
      const users = await slackUserService.getSlackUsers();
      expect(users).toEqual(mockSlackMembers);
      expect(mockWeb.users.list).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const cachedUsers = await slackUserService.getSlackUsers();
      expect(cachedUsers).toEqual(mockSlackMembers);
      expect(mockWeb.users.list).toHaveBeenCalledTimes(1);
    });

    it('should handle errors when fetching users', async () => {
      mockWeb.users.list.mockRejectedValueOnce(new Error('API Error'));

      await expect(slackUserService.getSlackUsers()).rejects.toThrow('Failed to fetch Slack users');
    });
  });

  describe('getSlackUserPropertyByGithubUsername', () => {
    it('should return Slack ID for valid GitHub username', async () => {
      mockGitHubApiHelper.fetchUserRealName.mockResolvedValue('최경환');

      const slackId = await slackUserService.getSlackUserPropertyByGithubUsername('ray', 'id');
      expect(slackId).toBe('U12345');
    });

    it('should return GitHub username when user not found', async () => {
      mockGitHubApiHelper.fetchUserRealName.mockResolvedValue('Unknown User');

      const result = await slackUserService.getSlackUserPropertyByGithubUsername('unknown', 'id');
      expect(result).toBe('Unknown User');
    });

    it('should handle empty GitHub username', async () => {
      const result = await slackUserService.getSlackUserPropertyByGithubUsername('', 'id');
      expect(result).toBe('');
    });
  });

  describe('clearCache', () => {
    it('should clear the cached users', async () => {
      await slackUserService.getSlackUsers();
      expect(mockWeb.users.list).toHaveBeenCalledTimes(1);

      slackUserService.clearCache();

      await slackUserService.getSlackUsers();
      expect(mockWeb.users.list).toHaveBeenCalledTimes(2);
    });
  });
});

// ===== __tests__/slack/slackMessageService.test.js =====
const SlackMessageService = require('../../slack/slackMessageService');
const { createMockSlackWeb } = require('../mocks/commonMocks');

describe('SlackMessageService', () => {
  let slackMessageService;
  let mockWeb;
  let mockPostMessage;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWeb = createMockSlackWeb();
    mockPostMessage = mockWeb._mockFunctions.mockPostMessage;
    slackMessageService = new SlackMessageService(mockWeb);
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      const message = { channel: 'C12345', text: 'Test message' };

      await slackMessageService.sendMessage(message);

      expect(mockPostMessage).toHaveBeenCalledWith(message);
    });

    it('should handle send errors', async () => {
      mockPostMessage.mockRejectedValueOnce(new Error('API Error'));

      await expect(slackMessageService.sendMessage({})).rejects.toThrow('Failed to send Slack message');
    });
  });

  describe('sendCodeCommentMessage', () => {
    it('should send code comment with diff hunk', async () => {
      const data = {
        commentContent: 'console.log("test")',
        commentBody: '코드 리뷰 내용',
        commentUrl: 'https://github.com/test/repo/pull/1#comment-1',
        prUrl: 'https://github.com/test/repo/pull/1',
        prTitle: '테스트 PR',
        commentAuthorSlackRealName: '김철수',
        mentionedSlackId: 'U12345',
      };

      await slackMessageService.sendCodeCommentMessage(data, 'C12345');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        channel: 'C12345',
        text: expect.stringContaining(':pencil:'),
        attachments: expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('```console.log("test")```'),
          }),
        ]),
      }));
    });
  });

  describe('sendDeploymentMessage', () => {
    it('should send deployment success message', async () => {
      const data = {
        slackDeployResult: ':white_check_mark:*Succeeded*',
        slackStatus: 'good',
        repoUrl: 'https://github.com/test/repo',
        repoName: 'test-repo',
        ec2Name: 'prod-server',
        triggerUser: 'U12345',
        commitUrl: 'https://github.com/test/repo/commit/abc123',
        sha: 'abc123def456',
        imageTag: 'v1.0.0',
        totalRunTime: '5분 30초',
        actionUrl: 'https://github.com/test/repo/actions/runs/123',
        workflowName: 'Deploy',
        ref: 'refs/heads/main',
      };

      await slackMessageService.sendDeploymentMessage(data, 'C12345');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Deploy Notification'),
        attachments: expect.arrayContaining([
          expect.objectContaining({
            color: 'good',
            fields: expect.arrayContaining([
              expect.objectContaining({ title: 'Deploy Server', value: 'https://prod-server' }),
              expect.objectContaining({ title: 'Image Tag', value: 'v1.0.0' }),
            ]),
          }),
        ]),
      }));
    });
  });

  describe('sendBuildMessage', () => {
    it('should send build failure message with failed jobs', async () => {
      const data = {
        slackBuildResult: ':x:*Failed*',
        slackStatus: 'danger',
        repoUrl: 'https://github.com/test/repo',
        repoName: 'test-repo',
        branchName: 'feature-branch',
        triggerUser: 'U12345',
        commitUrl: 'https://github.com/test/repo/commit/abc123',
        sha: 'abc123def456',
        totalRunTime: '3분 15초',
        actionUrl: 'https://github.com/test/repo/actions/runs/123',
        workflowName: 'CI',
        jobNames: ['lint', 'test'],
      };

      await slackMessageService.sendBuildMessage(data, 'C12345');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({
            color: 'danger',
            fields: expect.arrayContaining([
              expect.objectContaining({
                title: 'Failed Jobs',
                value: '`lint`\n`test`',
              }),
            ]),
          }),
        ]),
      }));
    });
  });
});
