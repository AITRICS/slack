const CommentEventHandler = require('../../handler/commentEventHandler');
const { PayloadValidationError } = require('../../utils/errors');

describe('CommentEventHandler', () => {
  let handler;
  let mockServices;

  beforeEach(() => {
    mockServices = {
      gitHubApiHelper: {
        fetchTeamMembers: jest.fn(),
        fetchCommentAuthor: jest.fn(),
        fetchCommentThreadParticipants: jest.fn(),
        fetchPullRequestDetails: jest.fn(),
        fetchPullRequestReviews: jest.fn(),
      },
      slackUserService: {
        getSlackProperty: jest.fn(),
        getSlackProperties: jest.fn(),
        addSlackIdsToRecipients: jest.fn((recipients) => recipients.map((r) => ({
          ...r,
          slackId: `SLACK_${r.githubUsername}`,
        }))),
      },
      slackChannelService: {
        selectChannel: jest.fn().mockResolvedValue('C12345'),
      },
      slackMessageService: {
        sendCodeCommentMessage: jest.fn().mockResolvedValue(true),
        sendPRPageCommentMessage: jest.fn().mockResolvedValue(true),
      },
    };

    handler = new CommentEventHandler(mockServices);
  });

  describe('handleCommentEvent', () => {
    it('should handle code review comment', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        pull_request: {
          number: 1,
          title: 'Test PR',
          html_url: 'https://github.com/org/test-repo/pull/1',
          user: { login: 'pr-author' },
        },
        comment: {
          id: 123,
          body: 'Test comment',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          diff_hunk: '@@ -1,3 +1,3 @@',
          user: { login: 'reviewer' },
        },
      };

      mockServices.gitHubApiHelper.fetchCommentAuthor.mockResolvedValue('reviewer');
      mockServices.gitHubApiHelper.fetchCommentThreadParticipants.mockResolvedValue([
        'pr-author',
        'reviewer',
      ]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Reviewer Name');

      await handler.handleCommentEvent(payload);

      expect(mockServices.slackMessageService.sendCodeCommentMessage).toHaveBeenCalled();
    });

    it('should handle PR page comment', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        issue: { number: 1 },
        comment: {
          id: 123,
          body: 'Test comment',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          user: { login: 'commenter' },
          issue_url: 'https://github.com/org/test-repo/issues/1',
        },
      };

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Commenter Name');

      await handler.handleCommentEvent(payload);

      expect(mockServices.slackMessageService.sendPRPageCommentMessage).toHaveBeenCalled();
    });

    it('should throw error when payload is invalid', async () => {
      await expect(handler.handleCommentEvent(null)).rejects.toThrow(PayloadValidationError);
    });

    it('should throw error when comment object is missing', async () => {
      const payload = {
        repository: { name: 'test-repo' },
        pull_request: { number: 1 },
      };

      await expect(handler.handleCommentEvent(payload)).rejects.toThrow(PayloadValidationError);
      await expect(handler.handleCommentEvent(payload)).rejects.toThrow(
        '코멘트 이벤트에 comment 객체가 필요합니다',
      );
    });

    it('should throw error when PR number is missing', async () => {
      const payload = {
        repository: { name: 'test-repo' },
        comment: {
          id: 123,
          body: 'Test',
          user: { login: 'user' },
        },
      };

      await expect(handler.handleCommentEvent(payload)).rejects.toThrow('PR 번호를 찾을 수 없습니다');
    });

    it('should extract PR number from pull_request_url when pull_request object is missing', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        comment: {
          id: 123,
          body: 'Test comment',
          html_url: 'https://github.com/org/test-repo/pull/28#comment-123',
          diff_hunk: '@@ -1,3 +1,3 @@',
          user: { login: 'reviewer' },
          pull_request_url: 'https://api.github.com/repos/org/test-repo/pulls/28',
        },
      };

      mockServices.gitHubApiHelper.fetchCommentAuthor.mockResolvedValue('reviewer');
      mockServices.gitHubApiHelper.fetchCommentThreadParticipants.mockResolvedValue(['reviewer']);
      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 28,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/28',
        user: { login: 'pr-author' },
      });
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      expect(mockServices.gitHubApiHelper.fetchPullRequestDetails).toHaveBeenCalledWith('test-repo', 28);
      expect(mockServices.slackMessageService.sendCodeCommentMessage).toHaveBeenCalled();
    });
  });

  describe('comment type determination', () => {
    it('should identify code review comment', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        pull_request: {
          number: 1,
          user: { login: 'pr-author' },
          title: 'Test PR',
          html_url: 'https://github.com/org/test-repo/pull/1',
        },
        comment: {
          id: 123,
          body: 'Code review',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          diff_hunk: '@@ -1,3 +1,3 @@',
          user: { login: 'reviewer' },
          pull_request_url: 'https://api.github.com/repos/org/test-repo/pulls/1',
        },
      };

      mockServices.gitHubApiHelper.fetchCommentAuthor.mockResolvedValue('reviewer');
      mockServices.gitHubApiHelper.fetchCommentThreadParticipants.mockResolvedValue(['pr-author']);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      expect(mockServices.slackMessageService.sendCodeCommentMessage).toHaveBeenCalled();
    });

    it('should identify PR page comment', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        issue: { number: 1 },
        comment: {
          id: 123,
          body: 'PR page comment',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          user: { login: 'commenter' },
          issue_url: 'https://api.github.com/repos/org/test-repo/issues/1',
        },
      };

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      expect(mockServices.slackMessageService.sendPRPageCommentMessage).toHaveBeenCalled();
    });
  });

  describe('recipient determination', () => {
    it('should send to PR author for first time code comment from another user', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        pull_request: {
          number: 1,
          title: 'Test PR',
          html_url: 'https://github.com/org/test-repo/pull/1',
          user: { login: 'pr-author' },
        },
        comment: {
          id: 123,
          body: 'First comment',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          diff_hunk: '@@ -1,3 +1,3 @@',
          user: { login: 'reviewer' },
        },
      };

      mockServices.gitHubApiHelper.fetchCommentAuthor.mockResolvedValue('reviewer');
      mockServices.gitHubApiHelper.fetchCommentThreadParticipants.mockResolvedValue(['reviewer']);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      expect(mockServices.slackChannelService.selectChannel).toHaveBeenCalledWith('pr-author');
    });

    it('should send to reviewers when PR author comments on own PR', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        pull_request: {
          number: 1,
          title: 'Test PR',
          html_url: 'https://github.com/org/test-repo/pull/1',
          user: { login: 'pr-author' },
        },
        comment: {
          id: 123,
          body: 'Self comment on own PR',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          diff_hunk: '@@ -1,3 +1,3 @@',
          user: { login: 'pr-author' },
        },
      };

      mockServices.gitHubApiHelper.fetchCommentAuthor.mockResolvedValue('pr-author');
      mockServices.gitHubApiHelper.fetchCommentThreadParticipants.mockResolvedValue(['pr-author']);
      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [{ login: 'reviewer1' }, { login: 'reviewer2' }],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([
        { user: { login: 'reviewer3' } },
      ]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      // 실제 메시지 전송 호출 확인
      expect(mockServices.slackMessageService.sendCodeCommentMessage).toHaveBeenCalled();

      // selectChannel이 리뷰어들로 호출되었는지 확인 (pr-author는 제외)
      const channelCalls = mockServices.slackChannelService.selectChannel.mock.calls;
      const calledUsernames = channelCalls.map((call) => call[0]);

      // pr-author는 호출되지 않아야 함
      expect(calledUsernames).not.toContain('pr-author');
      // 리뷰어들은 호출되어야 함
      expect(calledUsernames.some((u) => ['reviewer1', 'reviewer2', 'reviewer3'].includes(u))).toBe(true);
    });

    it('should fetch PR details when pull_request object is not in payload', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        comment: {
          id: 123,
          body: 'Comment without PR object',
          html_url: 'https://github.com/org/test-repo/pull/28#comment-123',
          diff_hunk: '@@ -1,3 +1,3 @@',
          user: { login: 'pr-author' },
          pull_request_url: 'https://api.github.com/repos/org/test-repo/pulls/28',
        },
      };

      mockServices.gitHubApiHelper.fetchCommentAuthor.mockResolvedValue('pr-author');
      mockServices.gitHubApiHelper.fetchCommentThreadParticipants.mockResolvedValue(['pr-author']);

      // PR 정보를 여러 번 조회하므로 계속 같은 값 반환하도록 설정
      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 28,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/28',
        user: { login: 'pr-author' },
        requested_reviewers: [{ login: 'reviewer1' }],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      // PR 정보가 API로 조회되어야 함 (최소 2번)
      expect(mockServices.gitHubApiHelper.fetchPullRequestDetails).toHaveBeenCalledWith('test-repo', 28);
      expect(mockServices.gitHubApiHelper.fetchPullRequestDetails.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should send to thread participants for subsequent comments', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        pull_request: {
          number: 1,
          title: 'Test PR',
          html_url: 'https://github.com/org/test-repo/pull/1',
          user: { login: 'pr-author' },
        },
        comment: {
          id: 123,
          body: 'Reply comment',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          diff_hunk: '@@ -1,3 +1,3 @@',
          user: { login: 'reviewer2' },
        },
      };

      mockServices.gitHubApiHelper.fetchCommentAuthor.mockResolvedValue('reviewer2');
      mockServices.gitHubApiHelper.fetchCommentThreadParticipants.mockResolvedValue([
        'pr-author',
        'reviewer1',
        'reviewer2',
      ]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      // selectChannel 호출로 실제 수신자 확인
      const channelCalls = mockServices.slackChannelService.selectChannel.mock.calls;
      const calledUsernames = channelCalls.map((call) => call[0]);

      // 스레드 참여자들 (본인 제외)
      expect(calledUsernames).toContain('pr-author');
      expect(calledUsernames).toContain('reviewer1');
      expect(calledUsernames).not.toContain('reviewer2'); // 본인은 제외
    });

    it('should send to all reviewers when PR author comments', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        issue: { number: 1 },
        comment: {
          id: 123,
          body: 'PR author comment',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          user: { login: 'pr-author' },
        },
      };

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [{ login: 'reviewer1' }],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([
        { user: { login: 'reviewer2' } },
      ]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      // selectChannel 호출로 실제 수신자 확인
      const channelCalls = mockServices.slackChannelService.selectChannel.mock.calls;
      const calledUsernames = channelCalls.map((call) => call[0]);

      expect(calledUsernames).toContain('reviewer1');
      expect(calledUsernames).toContain('reviewer2');
      expect(calledUsernames).not.toContain('pr-author');
    });

    it('should send to PR author and other reviewers when reviewer comments', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        issue: { number: 1 },
        comment: {
          id: 123,
          body: 'Reviewer comment',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          user: { login: 'reviewer1' },
        },
      };

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [{ login: 'reviewer1' }, { login: 'reviewer2' }],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      // selectChannel 호출로 실제 수신자 확인 (최종 결과)
      const channelCalls = mockServices.slackChannelService.selectChannel.mock.calls;
      const calledUsernames = channelCalls.map((call) => call[0]);

      // PR 작성자와 다른 리뷰어들
      expect(calledUsernames).toContain('pr-author');
      expect(calledUsernames).toContain('reviewer2');
      expect(calledUsernames).not.toContain('reviewer1'); // 코멘트 작성자는 제외
    });

    it('should handle duplicate reviewers', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        issue: { number: 1 },
        comment: {
          id: 123,
          body: 'Comment with duplicates',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          user: { login: 'commenter' },
        },
      };

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [{ login: 'duplicate-user' }],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([
        { user: { login: 'duplicate-user' } },
      ]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      // selectChannel 호출로 실제 수신자 확인
      const channelCalls = mockServices.slackChannelService.selectChannel.mock.calls;
      const calledUsernames = channelCalls.map((call) => call[0]);

      // duplicate-user는 한 번만 나타나야 함
      const duplicateCount = calledUsernames.filter((u) => u === 'duplicate-user').length;
      expect(duplicateCount).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should fallback to PR page comment when code comment fails', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        pull_request: {
          number: 1,
          title: 'Test PR',
          html_url: 'https://github.com/org/test-repo/pull/1',
          user: { login: 'pr-author' },
        },
        comment: {
          id: 123,
          body: 'Comment',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          diff_hunk: '@@ -1,3 +1,3 @@',
          user: { login: 'reviewer' },
        },
      };

      mockServices.gitHubApiHelper.fetchCommentAuthor.mockRejectedValueOnce(
        new Error('Comment not found'),
      );

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      expect(mockServices.slackMessageService.sendPRPageCommentMessage).toHaveBeenCalled();
    });

    it('should skip notification when no recipients for reviewer comment', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        issue: { number: 1 },
        comment: {
          id: 123,
          body: 'Comment with no recipients',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          user: { login: 'reviewer1' },
        },
      };

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'reviewer1' }, // 코멘트 작성자가 PR 작성자이면서 유일한 리뷰어
        requested_reviewers: [],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);

      await handler.handleCommentEvent(payload);

      expect(mockServices.slackMessageService.sendPRPageCommentMessage).not.toHaveBeenCalled();
    });
  });

  describe('channel grouping', () => {
    it('should group recipients by channel', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        issue: { number: 1 },
        comment: {
          id: 123,
          body: 'Comment',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          user: { login: 'commenter' },
        },
      };

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [
          { login: 'reviewer1' },
          { login: 'reviewer2' },
        ],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      mockServices.slackChannelService.selectChannel
        .mockResolvedValueOnce('C11111')
        .mockResolvedValueOnce('C22222');

      await handler.handleCommentEvent(payload);

      expect(mockServices.slackChannelService.selectChannel).toHaveBeenCalledTimes(3);
    });
  });
});
