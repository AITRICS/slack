const SlackMessages = require('../../slack/slackMessages');

describe('SlackMessages', () => {
  let slackMessages;
  let mockPostMessage;
  let mockWeb;

  beforeEach(() => {
    mockPostMessage = jest.fn().mockImplementation(() => Promise.resolve({ ok: true }));
    mockWeb = { chat: { postMessage: mockPostMessage } };
    slackMessages = new SlackMessages(mockWeb);
  });

  describe('메시지 포맷팅 테스트', () => {
    it('코멘트 메시지 - 코드 내용 포함', async () => {
      const notificationData = {
        commentContent: 'console.log("test")',
        commentBody: '이 부분을 수정해주세요',
        commentUrl: 'https://github.com/test/repo/pull/1#comment-1',
        prUrl: 'https://github.com/test/repo/pull/1',
        prTitle: '새로운 기능 추가',
        commentAuthorSlackRealName: '홍길동',
        mentionedSlackId: 'U12345',
      };

      await slackMessages.sendCodeCommentMessage(notificationData, 'C12345');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('```console.log("test")```'),
          }),
        ]),
      }));
    });

    it('코멘트 메시지 - 코드 내용 없음', async () => {
      const notificationData = {
        commentBody: '좋은 변경사항입니다!',
        commentUrl: 'https://github.com/test/repo/pull/1#comment-1',
        prUrl: 'https://github.com/test/repo/pull/1',
        prTitle: '버그 수정',
        commentAuthorSlackRealName: '김철수',
        mentionedSlackId: 'U67890',
      };

      await slackMessages.sendCodeCommentMessage(notificationData, 'C67890');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({
            text: expect.not.stringContaining('```'),
          }),
        ]),
      }));
    });

    it('PR 페이지 코멘트 메시지 - 여러 멘션', async () => {
      const notificationData = {
        commentUrl: 'https://github.com/test/repo/pull/1#comment-1',
        prUrl: 'https://github.com/test/repo/pull/1',
        commentAuthorGitName: 'author',
        commentBody: '좋은 변경사항입니다',
        prTitle: 'Feature Update',
        commentAuthorSlackRealName: '작성자',
        mentionsString: '<@U12345>, <@U67890>',
      };

      await slackMessages.sendPRPageCommentMessage(notificationData, 'C12345');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('<@U12345>, <@U67890>'),
        text: expect.stringContaining(':speech_balloon:'),
      }));
    });

    it('Approve 메시지', async () => {
      const notificationData = {
        commentBody: 'LGTM!',
        commentUrl: 'https://github.com/test/repo/pull/1#pullrequestreview-1',
        prUrl: 'https://github.com/test/repo/pull/1',
        prTitle: 'Feature: 사용자 인증 개선',
        commentAuthorSlackRealName: '박지민',
        mentionedSlackId: 'U54321',
      };

      await slackMessages.sendApprovalMessage(notificationData, 'C54321');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining(':white_check_mark:'),
        attachments: expect.arrayContaining([
          expect.objectContaining({ color: 'good' }),
        ]),
      }));
    });

    it('Review Request 메시지', async () => {
      const notificationData = {
        prUrl: 'https://github.com/test/repo/pull/1',
        prTitle: 'Feature Update',
        commentAuthorSlackRealName: '요청자',
        mentionedSlackId: 'U12345',
      };

      await slackMessages.sendReviewRequestMessage(notificationData, 'C12345');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining(':eyes:'),
        text: expect.stringContaining('Review를 요청했습니다'),
      }));
    });

    it('Schedule 메시지', async () => {
      const notificationData = {
        prUrl: 'https://github.com/test/repo/pull/1',
        prTitle: 'Pending Review',
        body: '<@U12345> (AWAITING), <@U67890> (APPROVED)',
      };

      await slackMessages.sendScheduledReviewMessage(notificationData, 'C12345');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('리뷰를 기다리고 있습니다'),
      }));
    });

    it('Deploy 성공 메시지', async () => {
      const notificationData = {
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

      await slackMessages.sendDeploymentMessage(notificationData, 'C12345');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining(':white_check_mark:*Succeeded*'),
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

    it('빌드 실패 메시지 - job 목록 포함', async () => {
      const notificationData = {
        slackBuildResult: ':x:*Failed*',
        slackStatus: 'danger',
        repoUrl: 'https://github.com/test/repo',
        repoName: 'test-repo',
        branchName: 'feature-branch',
        triggerUser: 'U12345',
        commitUrl: 'https://github.com/test/repo/commit/abc123',
        sha: 'abc123def456',
        totalRunTime: '5분 30초',
        actionUrl: 'https://github.com/test/repo/actions/runs/123',
        workflowName: 'CI',
        jobNames: ['lint', 'test', 'build'],
      };

      await slackMessages.sendBuildMessage(notificationData, 'C12345');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({
            color: 'danger',
            fields: expect.arrayContaining([
              expect.objectContaining({
                title: 'Failed Jobs',
                value: '`lint`\n`test`\n`build`',
              }),
            ]),
          }),
        ]),
      }));
    });

    it('빌드 성공 메시지 - job 목록 없음', async () => {
      const notificationData = {
        slackBuildResult: ':white_check_mark:*Succeeded*',
        slackStatus: 'good',
        repoUrl: 'https://github.com/test/repo',
        repoName: 'test-repo',
        branchName: 'main',
        triggerUser: 'U12345',
        commitUrl: 'https://github.com/test/repo/commit/abc123',
        sha: 'abc123def456',
        totalRunTime: '3분 15초',
        actionUrl: 'https://github.com/test/repo/actions/runs/123',
        workflowName: 'CI',
      };

      await slackMessages.sendBuildMessage(notificationData, 'C12345');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({
            color: 'good',
            fields: expect.not.arrayContaining([
              expect.objectContaining({ title: 'Failed Jobs' }),
            ]),
          }),
        ]),
      }));
    });
  });

  describe('에러 처리', () => {
    it('Slack API 오류 처리', async () => {
      const errorMockPostMessage = jest.fn().mockRejectedValue(new Error('Slack API Error'));
      const errorMockWeb = { chat: { postMessage: errorMockPostMessage } };
      const errorSlackMessages = new SlackMessages(errorMockWeb);

      const notificationData = {
        commentBody: 'Test comment',
        commentUrl: 'https://github.com/test/repo/pull/1#comment-1',
        prUrl: 'https://github.com/test/repo/pull/1',
        prTitle: 'Test PR',
        commentAuthorSlackRealName: 'Tester',
        mentionedSlackId: 'U12345',
      };

      await expect(
        errorSlackMessages.sendCodeCommentMessage(notificationData, 'C12345'),
      ).rejects.toThrow('Slack API Error');
    });
  });
});
