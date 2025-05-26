const BaseEventHandler = require('./baseEventHandler');
const Logger = require('../utils/logger');

/**
 * @typedef {Object} CommentPayload
 * @property {Object} comment
 * @property {string} comment.html_url
 * @property {string} comment.body
 * @property {Object} comment.user
 * @property {string} comment.user.login
 * @property {number} comment.id
 * @property {number} [comment.in_reply_to_id]
 * @property {string} [comment.diff_hunk]
 * @property {string} [comment.issue_url] - PR 페이지 코멘트인 경우 존재
 * @property {string} [comment.pull_request_url] - 코드 리뷰 코멘트인 경우 존재
 * @property {Object} repository
 * @property {string} repository.name
 * @property {string} repository.full_name
 * @property {Object} [pull_request] - 코드 코멘트인 경우 존재
 * @property {Object} pull_request.user
 * @property {string} pull_request.user.login
 * @property {string} pull_request.html_url
 * @property {string} pull_request.title
 * @property {number} pull_request.number
 * @property {Object} [issue] - PR 페이지 코멘트인 경우 존재
 * @property {number} issue.number
 */

/**
 * @typedef {Object} NotificationRecipient
 * @property {string} githubUsername
 * @property {string} slackId
 */

/**
 * @typedef {Object} CommentTypeInfo
 * @property {boolean} isCodeComment
 * @property {number} prNumber
 * @property {string} commentType - 'code_review' | 'pr_page'
 */

/**
 * GitHub 코멘트 이벤트 처리
 */
class CommentEventHandler extends BaseEventHandler {
  /**
   * 코멘트 이벤트 처리
   * @param {CommentPayload} payload
   */
  async handle(payload) {
    BaseEventHandler.validatePayload(payload);

    await this.initialize();

    const commentType = this.#determineCommentType(payload);

    Logger.info(`코멘트 이벤트 처리: ${commentType.commentType}`, {
      commentId: payload.comment.id,
      prNumber: commentType.prNumber,
      isCodeComment: commentType.isCodeComment,
    });

    if (commentType.isCodeComment) {
      await this.#handleCodeComment(payload, commentType);
    } else {
      await this.#handlePullRequestComment(payload, commentType);
    }
  }

  /**
   * 코멘트 타입 결정 (개선된 로직)
   * @private
   * @param {CommentPayload} payload
   * @returns {CommentTypeInfo}
   */
  #determineCommentType(payload) {
    // GitHub webhook 이벤트 구조를 더 정확하게 분석
    const hasIssue = Boolean(payload.issue);
    const hasPullRequest = Boolean(payload.pull_request);
    const hasIssueUrl = Boolean(payload.comment.issue_url);
    const hasPullRequestUrl = Boolean(payload.comment.pull_request_url);
    const hasDiffHunk = Boolean(payload.comment.diff_hunk);

    Logger.debug('코멘트 타입 판단 정보', {
      hasIssue,
      hasPullRequest,
      hasIssueUrl,
      hasPullRequestUrl,
      hasDiffHunk,
      commentId: payload.comment.id,
    });

    // 더 정확한 판단 로직
    let isCodeComment = false;
    let commentType = 'pr_page';

    // 1. issue 객체가 있으면 무조건 PR 페이지 코멘트
    if (hasIssue) {
      isCodeComment = false;
      commentType = 'pr_page';
    }
    // 2. pull_request 객체가 있고 diff_hunk가 있으면 코드 리뷰 코멘트
    else if (hasPullRequest && hasDiffHunk) {
      isCodeComment = true;
      commentType = 'code_review';
    }
    // 3. pull_request_url이 있고 diff_hunk가 있으면 코드 리뷰 코멘트
    else if (hasPullRequestUrl && hasDiffHunk) {
      isCodeComment = true;
      commentType = 'code_review';
    }
    // 4. issue_url이 있으면 PR 페이지 코멘트
    else if (hasIssueUrl) {
      isCodeComment = false;
      commentType = 'pr_page';
    }

    const prNumber = payload.pull_request?.number || payload.issue?.number;

    if (!prNumber) {
      Logger.warn('PR 번호를 찾을 수 없습니다', { payload });
      throw new Error('PR 번호를 찾을 수 없습니다');
    }

    return { isCodeComment, prNumber, commentType };
  }

  /**
   * 코드 리뷰 코멘트 처리
   * @private
   * @param {CommentPayload} payload
   * @param {CommentTypeInfo} commentType
   */
  async #handleCodeComment(payload, commentType) {
    try {
      const recipients = await this.#determineCodeCommentRecipients(payload, commentType);

      if (recipients.length === 0) {
        Logger.info('코드 코멘트 알림 수신자 없음');
        return;
      }

      const isFirstTimeComment = this.#isFirstTimeComment(
        recipients,
        payload.pull_request.user.login,
      );

      if (isFirstTimeComment) {
        await this.#sendSingleRecipientNotification(payload, recipients[0], 'code');
      } else {
        await this.#sendMultipleRecipientsNotification(payload, recipients, 'code');
      }
    } catch (error) {
      Logger.error('코드 리뷰 코멘트 처리 실패', error);
      // 코드 리뷰 코멘트로 판단했지만 실제로는 PR 페이지 코멘트일 수 있음
      Logger.warn('코드 리뷰 코멘트로 재시도하지 않고 PR 페이지 코멘트로 처리');
      await this.#handlePullRequestComment(payload, {
        ...commentType,
        isCodeComment: false,
        commentType: 'pr_page',
      });
    }
  }

  /**
   * PR 페이지 코멘트 처리
   * @private
   * @param {CommentPayload} payload
   * @param {CommentTypeInfo} commentType
   */
  async #handlePullRequestComment(payload, commentType) {
    const recipients = await this.#determinePRCommentRecipients(payload, commentType);

    if (recipients.length === 0) {
      Logger.info('PR 페이지 코멘트 알림 수신자 없음');
      return;
    }

    await this.#sendMultipleRecipientsNotification(payload, recipients, 'pr');
  }

  /**
   * 첫 번째 코멘트인지 확인 (PR 작성자 1명만 수신자인 경우)
   * @private
   * @param {NotificationRecipient[]} recipients
   * @param {string} prAuthorLogin
   * @returns {boolean}
   */
  #isFirstTimeComment(recipients, prAuthorLogin) {
    return recipients.length === 1 && recipients[0].githubUsername === prAuthorLogin;
  }

  /**
   * 코드 코멘트 수신자 결정 (개선된 에러 처리)
   * @private
   * @param {CommentPayload} payload
   * @param {CommentTypeInfo} commentType
   * @returns {Promise<NotificationRecipient[]>}
   */
  async #determineCodeCommentRecipients(payload, commentType) {
    const { repository, pull_request: pullRequest, comment } = payload;
    const commentAuthor = comment.user.login;

    try {
      // 코멘트 존재 여부를 먼저 확인
      const commentExists = await this.#verifyCommentExists(
        repository.name,
        comment.id,
        commentType.isCodeComment,
      );

      if (!commentExists) {
        Logger.warn('코멘트가 존재하지 않음. 타입 판단 오류일 가능성', {
          commentId: comment.id,
          isCodeComment: commentType.isCodeComment,
        });
        throw new Error(`코멘트 타입 판단 오류: ${comment.id}`);
      }

      const threadParticipants = await this.gitHubApiHelper.fetchCommentThreadParticipants(
        repository.name,
        commentType.prNumber,
        comment.id,
        commentType.isCodeComment,
      );

      // 스레드 참여자가 없거나 본인뿐인 경우 PR 작성자에게 알림
      if (threadParticipants.length <= 1) {
        const prAuthor = pullRequest.user.login;
        return commentAuthor !== prAuthor
          ? [{ githubUsername: prAuthor }]
          : [];
      }

      const recipients = threadParticipants
        .filter((username) => username !== commentAuthor)
        .map((username) => ({ githubUsername: username }));

      return this.slackUserService.addSlackIdsToRecipients(recipients);
    } catch (error) {
      Logger.error('코드 코멘트 수신자 결정 실패', error);
      throw error;
    }
  }

  /**
   * 코멘트 존재 여부 확인
   * @private
   * @param {string} repoName
   * @param {number} commentId
   * @param {boolean} isReviewComment
   * @returns {Promise<boolean>}
   */
  async #verifyCommentExists(repoName, commentId, isReviewComment) {
    try {
      await this.gitHubApiHelper.fetchCommentAuthor(repoName, commentId, isReviewComment);
      return true;
    } catch (error) {
      Logger.debug(`코멘트 존재 확인 실패: ${commentId}`, error);
      return false;
    }
  }

  /**
   * PR 페이지 코멘트 수신자 결정
   * @private
   * @param {CommentPayload} payload
   * @param {CommentTypeInfo} commentType
   * @returns {Promise<NotificationRecipient[]>}
   */
  async #determinePRCommentRecipients(payload, commentType) {
    const { repository, comment } = payload;
    const commentAuthor = comment.user.login;

    const [prDetails, allReviewers] = await Promise.all([
      this.gitHubApiHelper.fetchPullRequestDetails(repository.name, commentType.prNumber),
      this.#getAllReviewers(repository.name, commentType.prNumber),
    ]);

    const prAuthor = prDetails.user.login;

    if (commentAuthor === prAuthor) {
      // PR 작성자가 코멘트 → 모든 리뷰어에게 알림
      return allReviewers.filter((reviewer) => reviewer.githubUsername !== commentAuthor);
    }

    // 리뷰어가 코멘트 → PR 작성자 + 다른 리뷰어들에게 알림
    const recipients = await this.#getRecipientsForReviewerComment(allReviewers, commentAuthor, prAuthor);
    return this.#removeDuplicateRecipients(recipients);
  }

  /**
   * 단일 수신자 알림 전송
   * @private
   * @param {CommentPayload} payload
   * @param {NotificationRecipient} recipient
   * @param {'code'|'pr'} commentType
   */
  async #sendSingleRecipientNotification(payload, recipient, commentType) {
    const notificationData = await this.#buildNotificationData(payload, recipient.githubUsername);
    const channelId = await this.slackChannelService.selectChannel(recipient.githubUsername);

    const messageMethod = commentType === 'code'
      ? 'sendCodeCommentMessage'
      : 'sendPRPageCommentMessage';

    await this.slackMessageService[messageMethod](notificationData, channelId);
    Logger.info(`${commentType} 코멘트 알림 전송: ${recipient.githubUsername}`);
  }

  /**
   * 다중 수신자 알림 전송
   * @private
   * @param {CommentPayload} payload
   * @param {NotificationRecipient[]} recipients
   * @param {'code'|'pr'} commentType
   */
  async #sendMultipleRecipientsNotification(payload, recipients, commentType) {
    const recipientsByChannel = await this.#groupRecipientsByChannel(recipients);
    const baseNotificationData = await this.#buildNotificationData(payload);

    const messageMethod = commentType === 'code'
      ? 'sendCodeCommentMessage'
      : 'sendPRPageCommentMessage';

    await Promise.all(
      Object.entries(recipientsByChannel).map(async ([channelId, channelRecipients]) => {
        const mentions = channelRecipients.map((r) => `<@${r.slackId}>`).join(', ');
        const notificationData = { ...baseNotificationData, mentionsString: mentions };

        await this.slackMessageService[messageMethod](notificationData, channelId);
        Logger.info(`${commentType} 코멘트 알림 전송 (채널: ${channelId}, 수신자: ${channelRecipients.length}명)`);
      }),
    );
  }

  /**
   * 알림 데이터 생성
   * @private
   * @param {CommentPayload} payload
   * @param {string} [targetUsername] - 특정 대상자 (단일 알림인 경우)
   * @returns {Promise<Object>}
   */
  async #buildNotificationData(payload, targetUsername) {
    const {
      comment, pull_request: pullRequest, repository,
    } = payload;
    const authorUsername = comment.user.login;

    const commentType = this.#determineCommentType(payload);

    // 실제 대상자 결정
    let actualTargetUsername = targetUsername;

    // 답글인 경우 원본 코멘트 작성자를 대상으로 설정
    if (comment.in_reply_to_id && !actualTargetUsername) {
      try {
        const originalAuthor = await this.gitHubApiHelper.fetchCommentAuthor(
          repository.name,
          comment.in_reply_to_id,
          commentType.isCodeComment,
        );
        if (originalAuthor !== authorUsername) {
          actualTargetUsername = originalAuthor;
        }
      } catch (error) {
        Logger.warn('원본 코멘트 작성자 조회 실패', error);
      }
    }

    // PR 데이터 처리 (코드 코멘트 vs PR 페이지 코멘트)
    const prData = pullRequest || await this.gitHubApiHelper.fetchPullRequestDetails(
      repository.name,
      commentType.prNumber,
    );

    if (!actualTargetUsername) {
      actualTargetUsername = prData.user.login;
    }

    const [authorSlackInfo, targetSlackId] = await Promise.all([
      this.slackUserService.getSlackProperty(authorUsername, 'realName'),
      this.slackUserService.getSlackProperty(actualTargetUsername, 'id'),
    ]);

    return {
      prUrl: prData.html_url || `https://github.com/${repository.full_name}/pull/${commentType.prNumber}`,
      prTitle: prData.title,
      commentUrl: comment.html_url,
      commentBody: comment.body,
      codeSnippet: comment.diff_hunk,
      authorUsername,
      authorSlackName: authorSlackInfo,
      targetUsername: actualTargetUsername,
      targetSlackId,
    };
  }

  /**
   * PR의 모든 리뷰어 조회
   * @private
   * @param {string} repoName
   * @param {number} prNumber
   * @returns {Promise<NotificationRecipient[]>}
   */
  async #getAllReviewers(repoName, prNumber) {
    const [prDetails, reviews] = await Promise.all([
      this.gitHubApiHelper.fetchPullRequestDetails(repoName, prNumber),
      this.gitHubApiHelper.fetchPullRequestReviews(repoName, prNumber),
    ]);

    const requestedReviewers = (prDetails.requested_reviewers || []).map((r) => r.login);
    const actualReviewers = reviews.map((review) => review.user.login);
    const allReviewerUsernames = [...new Set([...requestedReviewers, ...actualReviewers])];

    const reviewerObjects = allReviewerUsernames.map((username) => ({ githubUsername: username }));
    return this.slackUserService.addSlackIdsToRecipients(reviewerObjects);
  }

  /**
   * 리뷰어 코멘트에 대한 수신자 결정
   * @private
   * @param {NotificationRecipient[]} allReviewers
   * @param {string} commentAuthor
   * @param {string} prAuthor
   * @returns {Promise<NotificationRecipient[]>}
   */
  async #getRecipientsForReviewerComment(allReviewers, commentAuthor, prAuthor) {
    const otherReviewers = allReviewers.filter((r) => r.githubUsername !== commentAuthor);
    const prAuthorIsReviewer = allReviewers.some((r) => r.githubUsername === prAuthor);

    if (prAuthorIsReviewer) {
      return otherReviewers;
    }

    const prAuthorWithSlackId = await this.slackUserService.addSlackIdsToRecipients([
      { githubUsername: prAuthor },
    ]);

    return [...prAuthorWithSlackId, ...otherReviewers];
  }

  /**
   * 수신자를 채널별로 그룹화
   * @private
   * @param {NotificationRecipient[]} recipients
   * @returns {Promise<Object<string, NotificationRecipient[]>>}
   */
  async #groupRecipientsByChannel(recipients) {
    const groups = {};

    await Promise.all(
      recipients.map(async (recipient) => {
        const channelId = await this.slackChannelService.selectChannel(recipient.githubUsername);

        if (!groups[channelId]) {
          groups[channelId] = [];
        }
        groups[channelId].push(recipient);
      }),
    );

    return groups;
  }

  /**
   * 중복 수신자 제거
   * @private
   * @param {NotificationRecipient[]} recipients
   * @returns {NotificationRecipient[]}
   */
  #removeDuplicateRecipients(recipients) {
    const seen = new Set();
    return recipients.filter((recipient) => {
      if (seen.has(recipient.githubUsername)) {
        return false;
      }
      seen.add(recipient.githubUsername);
      return true;
    });
  }
}

module.exports = CommentEventHandler;
