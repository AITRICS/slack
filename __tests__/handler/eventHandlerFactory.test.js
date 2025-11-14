const EventHandlerFactory = require('../../handler/eventHandlerFactory');
const { ACTION_TYPES } = require('../../constants');
const { SlackNotificationError } = require('../../utils/errors');

describe('EventHandlerFactory', () => {
  let factory;
  let mockServiceFactory;
  let mockServices;

  beforeEach(() => {
    jest.clearAllMocks();

    mockServices = {
      gitHubApiHelper: {
        fetchWorkflowRunData: jest.fn(),
        fetchOpenPullRequests: jest.fn(),
        fetchPullRequestReviews: jest.fn(),
        fetchPullRequestDetails: jest.fn(),
      },
      slackUserService: {
        getSlackProperties: jest.fn(),
        addSlackIdsToRecipients: jest.fn(),
      },
      slackChannelService: {
        selectChannel: jest.fn().mockResolvedValue('C12345'),
        findUserTeamSlug: jest.fn().mockResolvedValue('SE'),
      },
      slackMessageService: {
        sendCodeCommentMessage: jest.fn().mockResolvedValue(true),
        sendApprovalMessage: jest.fn().mockResolvedValue(true),
        sendReviewRequestMessage: jest.fn().mockResolvedValue(true),
        sendScheduledReviewMessage: jest.fn().mockResolvedValue(true),
        sendDeploymentMessage: jest.fn().mockResolvedValue(true),
        sendBuildMessage: jest.fn().mockResolvedValue(true),
      },
    };

    mockServiceFactory = {
      createServices: jest.fn().mockReturnValue(mockServices),
    };

    factory = new EventHandlerFactory(mockServiceFactory);
  });

  describe('constructor', () => {
    it('should register all event handlers', () => {
      expect(mockServiceFactory.createServices).toHaveBeenCalled();
    });
  });

  describe('handleEvent - comment', () => {
    it('should handle comment event', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        pull_request: {
          number: 1,
          title: 'Test PR',
          html_url: 'https://github.com/test/pull/1',
          user: { login: 'pr-author' },
        },
        comment: {
          id: 123,
          body: 'Test comment',
          user: { login: 'reviewer' },
          html_url: 'https://github.com/test/pull/1#comment-123',
          diff_hunk: '@@ -1,3 +1,3 @@',
        },
      };

      mockServices.gitHubApiHelper.fetchCommentAuthor = jest.fn().mockResolvedValue('reviewer');
      mockServices.gitHubApiHelper.fetchCommentThreadParticipants = jest.fn().mockResolvedValue(['pr-author']);
      mockServices.slackUserService.getSlackProperty = jest.fn().mockResolvedValue('U12345');

      await factory.handleEvent(ACTION_TYPES.COMMENT, payload);

      expect(mockServices.slackMessageService.sendCodeCommentMessage).toHaveBeenCalled();
    });
  });

  describe('handleEvent - review', () => {
    it('should handle approval event', async () => {
      const payload = {
        repository: { name: 'test-repo' },
        pull_request: {
          number: 1,
          html_url: 'https://github.com/test/pull/1',
          title: 'Test PR',
          user: { login: 'pr-author' },
        },
        review: {
          html_url: 'https://github.com/test/pull/1#review-1',
          body: 'LGTM',
          user: { login: 'reviewer' },
        },
      };

      mockServices.slackUserService.getSlackProperties.mockResolvedValue(
        new Map([['pr-author', 'U12345'], ['reviewer', 'U67890']]),
      );

      await factory.handleEvent(ACTION_TYPES.APPROVE, payload);

      expect(mockServices.slackMessageService.sendApprovalMessage).toHaveBeenCalled();
    });

    it('should handle review request event', async () => {
      const payload = {
        repository: { name: 'test-repo' },
        pull_request: {
          number: 1,
          html_url: 'https://github.com/test/pull/1',
          title: 'Test PR',
          user: { login: 'pr-author' },
        },
        requested_reviewer: { login: 'reviewer' },
      };

      mockServices.slackUserService.getSlackProperties.mockResolvedValue(
        new Map([['pr-author', 'U12345'], ['reviewer', 'U67890']]),
      );

      await factory.handleEvent(ACTION_TYPES.REVIEW_REQUESTED, payload);

      expect(mockServices.slackMessageService.sendReviewRequestMessage).toHaveBeenCalled();
    });

    it('should handle scheduled review event', async () => {
      const payload = {
        repository: { name: 'test-repo' },
      };

      mockServices.gitHubApiHelper.fetchOpenPullRequests.mockResolvedValue([
        {
          number: 1,
          html_url: 'https://github.com/test/pull/1',
          title: 'Test PR',
          user: { login: 'pr-author' },
          draft: false,
        },
      ]);

      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);
      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        requested_reviewers: [],
      });

      mockServices.slackUserService.getSlackProperties.mockResolvedValue(new Map());

      await factory.handleEvent(ACTION_TYPES.SCHEDULE, payload);

      expect(mockServices.gitHubApiHelper.fetchOpenPullRequests).toHaveBeenCalledWith('test-repo');
    });
  });

  describe('handleEvent - deployment', () => {
    it('should handle deploy event', async () => {
      const context = {
        payload: {
          repository: {
            name: 'test-repo',
            full_name: 'org/test-repo',
            html_url: 'https://github.com/org/test-repo',
          },
        },
        runId: 123456,
        ref: 'refs/heads/main',
        sha: 'abc123',
      };

      mockServices.gitHubApiHelper.fetchWorkflowRunData.mockResolvedValue({
        name: 'Deploy',
        html_url: 'https://github.com/test/actions/runs/123',
        run_started_at: new Date().toISOString(),
        actor: { login: 'deployer' },
      });

      mockServices.slackUserService.getSlackProperties.mockResolvedValue(
        new Map([['deployer', 'U12345']]),
      );

      await factory.handleEvent(ACTION_TYPES.DEPLOY, context, 'prod-server', 'v1.0.0', 'success');

      expect(mockServices.slackMessageService.sendDeploymentMessage).toHaveBeenCalled();
    });

    it('should handle build event', async () => {
      const context = {
        payload: {
          repository: {
            name: 'test-repo',
            full_name: 'org/test-repo',
            html_url: 'https://github.com/org/test-repo',
          },
        },
        runId: 123456,
        ref: 'refs/heads/main',
        sha: 'abc123',
      };

      mockServices.gitHubApiHelper.fetchWorkflowRunData.mockResolvedValue({
        name: 'CI',
        html_url: 'https://github.com/test/actions/runs/123',
        run_started_at: new Date().toISOString(),
        actor: { login: 'developer' },
      });

      mockServices.slackUserService.getSlackProperties.mockResolvedValue(
        new Map([['developer', 'U12345']]),
      );

      await factory.handleEvent(ACTION_TYPES.CI, context, 'main', 'v1.0.0', 'lint, test', 'success');

      expect(mockServices.slackMessageService.sendBuildMessage).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should throw error for unknown action type', async () => {
      await expect(
        factory.handleEvent('unknown_action', {}),
      ).rejects.toThrow(SlackNotificationError);

      await expect(
        factory.handleEvent('unknown_action', {}),
      ).rejects.toThrow('알 수 없는 액션 타입');
    });
  });
});
