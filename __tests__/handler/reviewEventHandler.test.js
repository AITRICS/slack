const ReviewEventHandler = require('../../handler/reviewEventHandler');
const { PayloadValidationError } = require('../../utils/errors');
const { REVIEW_STATES } = require('../../constants');

describe('ReviewEventHandler', () => {
  let handler;
  let mockServices;

  beforeEach(() => {
    jest.clearAllMocks();

    mockServices = {
      gitHubApiHelper: {
        fetchOpenPullRequests: jest.fn(),
        fetchPullRequestReviews: jest.fn(),
        fetchPullRequestDetails: jest.fn(),
      },
      slackUserService: {
        getSlackProperties: jest.fn(),
      },
      slackChannelService: {
        selectChannel: jest.fn().mockResolvedValue('C12345'),
        findUserTeamSlug: jest.fn().mockResolvedValue('SE'),
      },
      slackMessageService: {
        sendApprovalMessage: jest.fn().mockResolvedValue(true),
        sendReviewRequestMessage: jest.fn().mockResolvedValue(true),
        sendScheduledReviewMessage: jest.fn().mockResolvedValue(true),
      },
    };

    handler = new ReviewEventHandler(mockServices);
  });

  describe('handleApprovalEvent', () => {
    it('should send approval notification', async () => {
      const payload = {
        repository: { name: 'test-repo' },
        pull_request: {
          number: 1,
          html_url: 'https://github.com/org/test-repo/pull/1',
          title: 'Test PR',
          user: { login: 'pr-author' },
        },
        review: {
          html_url: 'https://github.com/org/test-repo/pull/1#review-1',
          body: 'LGTM',
          user: { login: 'reviewer' },
        },
      };

      mockServices.slackUserService.getSlackProperties.mockResolvedValue(
        new Map([
          ['pr-author', 'U12345'],
          ['reviewer', 'U67890'],
        ]),
      );

      await handler.handleApprovalEvent(payload);

      expect(mockServices.slackChannelService.selectChannel).toHaveBeenCalledWith('pr-author');
      expect(mockServices.slackMessageService.sendApprovalMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          prTitle: 'Test PR',
          prUrl: 'https://github.com/org/test-repo/pull/1',
          targetGithubUsername: 'pr-author',
          authorGithubUsername: 'reviewer',
          targetSlackId: 'U12345',
          authorSlackName: 'U67890',
        }),
        'C12345',
      );
    });

    it('should throw error when payload is invalid', async () => {
      await expect(handler.handleApprovalEvent(null)).rejects.toThrow(PayloadValidationError);
    });
  });

  describe('handleReviewRequestEvent', () => {
    it('should send review request notification', async () => {
      const payload = {
        repository: { name: 'test-repo' },
        pull_request: {
          number: 1,
          html_url: 'https://github.com/org/test-repo/pull/1',
          title: 'Test PR',
          user: { login: 'pr-author' },
        },
        requested_reviewer: { login: 'reviewer' },
      };

      mockServices.slackUserService.getSlackProperties.mockResolvedValue(
        new Map([
          ['pr-author', 'U12345'],
          ['reviewer', 'U67890'],
        ]),
      );

      await handler.handleReviewRequestEvent(payload);

      expect(mockServices.slackChannelService.selectChannel).toHaveBeenCalledWith('reviewer');
      expect(mockServices.slackMessageService.sendReviewRequestMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          prTitle: 'Test PR',
          reviewerGithubUsername: 'reviewer',
          targetGithubUsername: 'pr-author',
        }),
        'C12345',
      );
    });

    it('should throw error when payload is invalid', async () => {
      await expect(handler.handleReviewRequestEvent(null)).rejects.toThrow(PayloadValidationError);
    });
  });

  describe('handleScheduledReview', () => {
    it('should send scheduled review notifications for open PRs', async () => {
      const payload = {
        repository: { name: 'test-repo' },
      };

      mockServices.gitHubApiHelper.fetchOpenPullRequests.mockResolvedValue([
        {
          number: 1,
          html_url: 'https://github.com/org/test-repo/pull/1',
          title: 'Test PR 1',
          user: { login: 'author1' },
          draft: false,
        },
        {
          number: 2,
          html_url: 'https://github.com/org/test-repo/pull/2',
          title: 'Test PR 2',
          user: { login: 'author2' },
          draft: false,
        },
      ]);

      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([
        { user: { login: 'reviewer1' }, state: REVIEW_STATES.APPROVED },
      ]);

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        requested_reviewers: [{ login: 'reviewer2' }],
      });

      mockServices.slackUserService.getSlackProperties.mockResolvedValue(
        new Map([
          ['reviewer1', 'U11111'],
          ['reviewer2', 'U22222'],
        ]),
      );

      await handler.handleScheduledReview(payload);

      expect(mockServices.gitHubApiHelper.fetchOpenPullRequests).toHaveBeenCalledWith('test-repo');
      expect(mockServices.slackMessageService.sendScheduledReviewMessage).toHaveBeenCalledTimes(2);
    });

    it('should filter out draft PRs', async () => {
      const payload = {
        repository: { name: 'test-repo' },
      };

      mockServices.gitHubApiHelper.fetchOpenPullRequests.mockResolvedValue([
        {
          number: 1,
          html_url: 'https://github.com/org/test-repo/pull/1',
          title: 'Draft PR',
          user: { login: 'author' },
          draft: true,
        },
      ]);

      await handler.handleScheduledReview(payload);

      expect(mockServices.slackMessageService.sendScheduledReviewMessage).not.toHaveBeenCalled();
    });

    it('should include reviewer status in notification', async () => {
      const payload = {
        repository: { name: 'test-repo' },
      };

      mockServices.gitHubApiHelper.fetchOpenPullRequests.mockResolvedValue([
        {
          number: 1,
          html_url: 'https://github.com/org/test-repo/pull/1',
          title: 'Test PR',
          user: { login: 'author' },
          draft: false,
        },
      ]);

      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([
        { user: { login: 'reviewer1' }, state: REVIEW_STATES.APPROVED },
      ]);

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        requested_reviewers: [{ login: 'reviewer2' }],
      });

      mockServices.slackUserService.getSlackProperties.mockResolvedValue(
        new Map([
          ['reviewer1', 'U11111'],
          ['reviewer2', 'U22222'],
        ]),
      );

      await handler.handleScheduledReview(payload);

      expect(mockServices.slackMessageService.sendScheduledReviewMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('U11111'),
          body: expect.stringContaining('U22222'),
        }),
        expect.any(String),
      );
    });

    it('should throw error when payload is invalid', async () => {
      await expect(handler.handleScheduledReview(null)).rejects.toThrow(PayloadValidationError);
    });
  });
});
