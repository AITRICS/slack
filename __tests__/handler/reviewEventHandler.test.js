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
        fetchTeamMembers: jest.fn(),
      },
      slackUserService: {
        getSlackProperties: jest.fn(),
        addSlackIdsToRecipients: jest.fn(),
        getSlackProperty: jest.fn(),
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
    describe('individual reviewer', () => {
      it('should send review request notification to individual reviewer', async () => {
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

    describe('team reviewer', () => {
      it('should send review request to all team members except PR author', async () => {
        const payload = {
          repository: { name: 'test-repo' },
          pull_request: {
            number: 1,
            html_url: 'https://github.com/org/test-repo/pull/1',
            title: 'Test PR',
            user: { login: 'pr-author' },
          },
          requested_team: {
            slug: 'vc-backend',
            name: 'VC-backend',
          },
        };

        mockServices.gitHubApiHelper.fetchTeamMembers.mockResolvedValue([
          { login: 'member1' },
          { login: 'member2' },
          { login: 'pr-author' },
          { login: 'member3' },
        ]);

        mockServices.slackUserService.addSlackIdsToRecipients.mockResolvedValue([
          { githubUsername: 'member1', slackId: 'U001' },
          { githubUsername: 'member2', slackId: 'U002' },
          { githubUsername: 'member3', slackId: 'U003' },
        ]);

        mockServices.slackUserService.getSlackProperty.mockResolvedValue('PR Author Name');

        mockServices.slackChannelService.selectChannel
          .mockResolvedValueOnce('C_BACKEND')
          .mockResolvedValueOnce('C_BACKEND')
          .mockResolvedValueOnce('C_FRONTEND');

        await handler.handleReviewRequestEvent(payload);

        expect(mockServices.gitHubApiHelper.fetchTeamMembers).toHaveBeenCalledWith('vc-backend');
        expect(mockServices.slackUserService.addSlackIdsToRecipients).toHaveBeenCalledWith([
          { githubUsername: 'member1' },
          { githubUsername: 'member2' },
          { githubUsername: 'member3' },
        ]);
        expect(mockServices.slackMessageService.sendReviewRequestMessage).toHaveBeenCalledTimes(2);
        expect(mockServices.slackMessageService.sendReviewRequestMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            prTitle: 'Test PR',
            targetSlackId: '<@U001>, <@U002>',
            authorSlackName: 'PR Author Name',
          }),
          'C_BACKEND',
        );
        expect(mockServices.slackMessageService.sendReviewRequestMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            targetSlackId: '<@U003>',
          }),
          'C_FRONTEND',
        );
      });

      it('should handle team with no members', async () => {
        const payload = {
          repository: { name: 'test-repo' },
          pull_request: {
            number: 1,
            html_url: 'https://github.com/org/test-repo/pull/1',
            title: 'Test PR',
            user: { login: 'pr-author' },
          },
          requested_team: {
            slug: 'empty-team',
            name: 'Empty Team',
          },
        };

        mockServices.gitHubApiHelper.fetchTeamMembers.mockResolvedValue([]);

        await handler.handleReviewRequestEvent(payload);

        expect(mockServices.slackMessageService.sendReviewRequestMessage).not.toHaveBeenCalled();
      });

      it('should handle team with only PR author', async () => {
        const payload = {
          repository: { name: 'test-repo' },
          pull_request: {
            number: 1,
            html_url: 'https://github.com/org/test-repo/pull/1',
            title: 'Test PR',
            user: { login: 'pr-author' },
          },
          requested_team: {
            slug: 'solo-team',
            name: 'Solo Team',
          },
        };

        mockServices.gitHubApiHelper.fetchTeamMembers.mockResolvedValue([
          { login: 'pr-author' },
        ]);

        await handler.handleReviewRequestEvent(payload);

        expect(mockServices.slackMessageService.sendReviewRequestMessage).not.toHaveBeenCalled();
      });

      it('should group team members by channel', async () => {
        const payload = {
          repository: { name: 'test-repo' },
          pull_request: {
            number: 1,
            html_url: 'https://github.com/org/test-repo/pull/1',
            title: 'Test PR',
            user: { login: 'pr-author' },
          },
          requested_team: {
            slug: 'multi-channel-team',
            name: 'Multi Channel Team',
          },
        };

        mockServices.gitHubApiHelper.fetchTeamMembers.mockResolvedValue([
          { login: 'backend1' },
          { login: 'backend2' },
          { login: 'frontend1' },
        ]);

        mockServices.slackUserService.addSlackIdsToRecipients.mockResolvedValue([
          { githubUsername: 'backend1', slackId: 'U_BE1' },
          { githubUsername: 'backend2', slackId: 'U_BE2' },
          { githubUsername: 'frontend1', slackId: 'U_FE1' },
        ]);

        mockServices.slackUserService.getSlackProperty.mockResolvedValue('Author');

        mockServices.slackChannelService.selectChannel
          .mockResolvedValueOnce('C_BACKEND')
          .mockResolvedValueOnce('C_BACKEND')
          .mockResolvedValueOnce('C_FRONTEND');

        await handler.handleReviewRequestEvent(payload);

        expect(mockServices.slackMessageService.sendReviewRequestMessage).toHaveBeenCalledTimes(2);
        expect(mockServices.slackMessageService.sendReviewRequestMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            targetSlackId: '<@U_BE1>, <@U_BE2>',
          }),
          'C_BACKEND',
        );
        expect(mockServices.slackMessageService.sendReviewRequestMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            targetSlackId: '<@U_FE1>',
          }),
          'C_FRONTEND',
        );
      });

      it('should handle team fetch error', async () => {
        const payload = {
          repository: { name: 'test-repo' },
          pull_request: {
            number: 1,
            html_url: 'https://github.com/org/test-repo/pull/1',
            title: 'Test PR',
            user: { login: 'pr-author' },
          },
          requested_team: {
            slug: 'error-team',
            name: 'Error Team',
          },
        };

        mockServices.gitHubApiHelper.fetchTeamMembers.mockRejectedValue(
          new Error('GitHub API Error'),
        );

        await expect(handler.handleReviewRequestEvent(payload)).rejects.toThrow('GitHub API Error');
      });
    });

    describe('neither reviewer nor team', () => {
      it('should log warning when neither requested_reviewer nor requested_team exists', async () => {
        const payload = {
          repository: { name: 'test-repo' },
          pull_request: {
            number: 1,
            html_url: 'https://github.com/org/test-repo/pull/1',
            title: 'Test PR',
            user: { login: 'pr-author' },
          },
          action: 'review_requested',
        };

        await handler.handleReviewRequestEvent(payload);

        expect(mockServices.slackMessageService.sendReviewRequestMessage).not.toHaveBeenCalled();
      });
    });
  });

  describe('handleScheduledReview', () => {
    it('should send scheduled review notifications with all reviewer types', async () => {
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
      ]);

      // PR 상세 정보 (개별 리뷰어 + 팀 리뷰어 포함)
      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        user: { login: 'author1' },
        requested_reviewers: [{ login: 'individual-reviewer1' }],
        requested_teams: [{ slug: 'backend-team' }],
      });

      // 실제 리뷰한 사람들
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([
        { user: { login: 'actual-reviewer1' }, state: REVIEW_STATES.APPROVED },
      ]);

      // 팀 멤버 조회
      mockServices.gitHubApiHelper.fetchTeamMembers.mockResolvedValue([
        { login: 'team-member1' },
        { login: 'team-member2' },
      ]);

      // Slack ID 매핑 (모든 리뷰어 타입 포함)
      mockServices.slackUserService.getSlackProperties.mockResolvedValue(
        new Map([
          ['individual-reviewer1', 'U_INDIV1'],
          ['team-member1', 'U_TEAM1'],
          ['team-member2', 'U_TEAM2'],
          ['actual-reviewer1', 'U_ACTUAL1'],
        ]),
      );

      await handler.handleScheduledReview(payload);

      expect(mockServices.gitHubApiHelper.fetchOpenPullRequests).toHaveBeenCalledWith('test-repo');
      expect(mockServices.gitHubApiHelper.fetchPullRequestReviews).toHaveBeenCalled();
      expect(mockServices.gitHubApiHelper.fetchTeamMembers).toHaveBeenCalledWith('backend-team');
      expect(mockServices.slackMessageService.sendScheduledReviewMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('U_INDIV1'),
        }),
        expect.any(String),
      );
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

    it('should include all reviewer types in notification', async () => {
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

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        user: { login: 'author' },
        requested_reviewers: [{ login: 'reviewer1' }],
        requested_teams: [{ slug: 'team1' }],
      });

      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([
        { user: { login: 'actual-reviewer' }, state: REVIEW_STATES.APPROVED },
      ]);

      mockServices.gitHubApiHelper.fetchTeamMembers.mockResolvedValue([
        { login: 'team-member1' },
      ]);

      mockServices.slackUserService.getSlackProperties.mockResolvedValue(
        new Map([
          ['reviewer1', 'U_REV1'],
          ['team-member1', 'U_TEAM1'],
          ['actual-reviewer', 'U_ACTUAL'],
        ]),
      );

      await handler.handleScheduledReview(payload);

      const messageCall = mockServices.slackMessageService.sendScheduledReviewMessage.mock.calls[0][0];
      const bodyText = messageCall.body;

      // 모든 리뷰어가 포함되어야 함
      expect(bodyText).toContain('U_REV1');
      expect(bodyText).toContain('U_TEAM1');
      expect(bodyText).toContain('U_ACTUAL');
    });

    it('should handle team fetch failure gracefully', async () => {
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

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        user: { login: 'author' },
        requested_reviewers: [{ login: 'reviewer1' }],
        requested_teams: [{ slug: 'error-team' }],
      });

      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);

      // 팀 조회 실패
      mockServices.gitHubApiHelper.fetchTeamMembers.mockRejectedValue(
        new Error('GitHub API Error'),
      );

      mockServices.slackUserService.getSlackProperties.mockResolvedValue(
        new Map([['reviewer1', 'U_REV1']]),
      );

      // 팀 조회 실패해도 개별 리뷰어는 처리됨
      await handler.handleScheduledReview(payload);

      expect(mockServices.slackMessageService.sendScheduledReviewMessage).toHaveBeenCalled();
    });

    it('should throw error when payload is invalid', async () => {
      await expect(handler.handleScheduledReview(null)).rejects.toThrow(PayloadValidationError);
    });
  });
});
