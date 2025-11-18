const MentionUtils = require('../utils/mentionUtils');
const Logger = require('../utils/logger');
const ImageUtils = require('../utils/imageUtils');
const BaseEventHandler = require('./baseEventHandler');
const { PayloadValidationError } = require('../utils/errors');

/**
 * GitHub 코멘트 이벤트 처리
 */
class CommentEventHandler extends BaseEventHandler {
  /**
   * 코멘트 이벤트 처리
   * @param {CommentPayload} payload
   */
  async handleCommentEvent(payload) {
    BaseEventHandler.validatePayload(payload);

    // 코멘트 객체 존재 여부 확인
    if (!payload.comment) {
      Logger.error('코멘트 객체가 없습니다. 잘못된 이벤트 타입일 수 있습니다.', {
        eventType: payload.action,
        hasReview: Boolean(payload.review),
        hasPullRequest: Boolean(payload.pull_request),
      });
      throw new PayloadValidationError(
        '코멘트 이벤트에 comment 객체가 필요합니다.',
        payload,
      );
    }

    await this.initialize();

    const commentTypeInfo = this.#determineCommentType(payload);

    Logger.info(`코멘트 이벤트 처리: ${commentTypeInfo.commentType}`, {
      commentId: payload.comment.id,
      prNumber: commentTypeInfo.prNumber,
      isCodeComment: commentTypeInfo.isCodeComment,
    });

    if (commentTypeInfo.isCodeComment) {
      await this.#handleCodeComment(payload, commentTypeInfo);
    } else {
      await this.#handlePullRequestComment(payload, commentTypeInfo);
    }
  }

  /**
   * 코멘트 타입 결정
   * @private
   * @param {CommentPayload} payload - 코멘트 페이로드
   * @returns {CommentTypeInfo} 코멘트 타입 정보
   * @throws {Error} PR 번호를 찾을 수 없는 경우
   */
  #determineCommentType(payload) {
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

    const isCodeComment = (
      (hasPullRequest && hasDiffHunk) ||
      (hasPullRequestUrl && hasDiffHunk)
    );
    const commentType = isCodeComment ? 'code_review' : 'pr_page';

    // PR 번호 추출 (여러 소스에서 시도)
    let prNumber;
    if (payload.pull_request?.number) {
      prNumber = payload.pull_request.number;
    } else if (payload.issue?.number) {
      prNumber = payload.issue.number;
    } else if (payload.comment.pull_request_url) {
      // URL에서 PR 번호 추출: https://api.github.com/repos/OWNER/REPO/pulls/28
      const match = payload.comment.pull_request_url.match(/\/pulls\/(\d+)$/);
      if (match) {
        prNumber = parseInt(match[1], 10);
      }
    }

    if (!prNumber) {
      Logger.warn('PR 번호를 찾을 수 없습니다', {
        payload,
        pullRequestUrl: payload.comment.pull_request_url,
      });
      throw new Error('PR 번호를 찾을 수 없습니다');
    }

    return { isCodeComment, prNumber, commentType };
  }

  /**
   * 코드 리뷰 코멘트 처리
   * @private
   * @param {CommentPayload} payload
   * @param {CommentTypeInfo} commentTypeInfo
   */
  async #handleCodeComment(payload, commentTypeInfo) {
    try {
      const recipients = await this.#determineCodeCommentRecipients(payload, commentTypeInfo);

      if (recipients.length === 0) {
        Logger.info('코드 코멘트 알림 수신자 없음');
        return;
      }

      const isFirstTimeComment = this.#isFirstTimeComment(
        recipients,
        payload.pull_request?.user?.login,
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
        ...commentTypeInfo,
        isCodeComment: false,
        commentType: 'pr_page',
      });
    }
  }

  /**
   * PR 페이지 코멘트 처리
   * @private
   * @param {CommentPayload} payload
   * @param {CommentTypeInfo} commentTypeInfo
   */
  async #handlePullRequestComment(payload, commentTypeInfo) {
    const recipients = await this.#determinePRCommentRecipients(payload, commentTypeInfo);

    if (recipients.length === 0) {
      Logger.info('PR 페이지 코멘트 알림 수신자 없음');
      return;
    }

    await this.#sendMultipleRecipientsNotification(payload, recipients, 'pr');
  }

  /**
   * 첫 번째 코멘트인지 확인 (PR 작성자 1명만 수신자인 경우)
   * @private
   * @param {UserMappingResult[]} recipients
   * @param {string} prAuthorLogin
   * @returns {boolean}
   */
  #isFirstTimeComment(recipients, prAuthorLogin) {
    return recipients.length === 1 && recipients[0].githubUsername === prAuthorLogin;
  }

  /**
   * 코드 코멘트 수신자 결정 (개선된 버전)
   * @private
   * @param {CommentPayload} payload
   * @param {CommentTypeInfo} commentTypeInfo
   * @returns {Promise<UserMappingResult[]>}
   */
  async #determineCodeCommentRecipients(payload, commentTypeInfo) {
    const { repository, pull_request: pullRequest, comment } = payload;
    const commentAuthor = comment.user.login;
    const prDetails = await this.gitHubApiHelper.fetchPullRequestDetails(
      repository.name,
      commentTypeInfo.prNumber,
    );

    try {
      // 코멘트 존재 여부를 먼저 확인
      const commentExists = await this.#verifyCommentExists(
        repository.name,
        comment.id,
        commentTypeInfo.isCodeComment,
      );

      if (!commentExists) {
        Logger.warn('코멘트가 존재하지 않음. 타입 판단 오류일 가능성', {
          commentId: comment.id,
          isCodeComment: commentTypeInfo.isCodeComment,
        });
        throw new Error(`코멘트 타입 판단 오류: ${comment.id}`);
      }

      const threadParticipants = await this.gitHubApiHelper.fetchCommentThreadParticipants(
        repository.name,
        commentTypeInfo.prNumber,
        comment.id,
        commentTypeInfo.isCodeComment,
      );

      // PR 정보 가져오기 (payload에 없을 수 있음)
      let prAuthor;
      if (pullRequest && pullRequest.user) {
        prAuthor = pullRequest.user.login;
      } else {
        Logger.debug('payload에 pull_request 없음, API로 조회 중', {
          prNumber: commentTypeInfo.prNumber,
          repoName: repository.name,
        });

        prAuthor = prDetails.user.login;
      }

      // 스레드 참여자가 없거나 본인뿐인 경우
      if (threadParticipants.length <= 1) {
        if (commentAuthor === prAuthor) {
          // 본인 PR에 본인이 코멘트 → 리뷰어들에게 알림
          Logger.debug('본인 PR에 본인이 코드 코멘트 → 리뷰어들에게 알림', {
            prAuthor,
            commentAuthor,
          });
          const reviewers = await this.#getAllReviewers(repository.name, commentTypeInfo.prNumber, prDetails);
          return reviewers.filter((r) => r.githubUsername !== commentAuthor);
        }

        // 다른 사람 PR에 처음 코멘트 → PR 작성자에게 알림
        return commentAuthor !== prAuthor ?
          [{ githubUsername: prAuthor }] :
          [];
      }

      // 스레드에 다른 참여자들이 있는 경우
      const recipients = threadParticipants
        .filter((username) => username !== commentAuthor)
        .map((username) => ({ githubUsername: username }));

      return this.slackUserService.addSlackIdsToRecipients(recipients);
    } catch (error) {
      if (error instanceof Error && error.message.includes('코멘트 타입 판단 오류')) {
        throw error;
      }

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
   * @param {CommentTypeInfo} commentTypeInfo
   * @returns {Promise<UserMappingResult[]>}
   */
  async #determinePRCommentRecipients(payload, commentTypeInfo) {
    const { repository, comment } = payload;
    const commentAuthor = comment.user.login;

    const prDetails = await this.gitHubApiHelper.fetchPullRequestDetails(
      repository.name,
      commentTypeInfo.prNumber,
    );

    const allReviewers = await this.#getAllReviewers(
      repository.name,
      commentTypeInfo.prNumber,
      prDetails,
    );

    const prAuthor = prDetails.user.login;

    if (commentAuthor === prAuthor) {
      // PR 작성자가 코멘트 → 모든 리뷰어에게 알림
      return allReviewers.filter((reviewer) => reviewer.githubUsername !== commentAuthor);
    }

    // 리뷰어가 코멘트 → PR 작성자 + 다른 리뷰어들에게 알림
    const recipients = await this.#getRecipientsForReviewerComment(
      allReviewers,
      commentAuthor,
      prAuthor,
    );
    return this.#removeDuplicateRecipients(recipients);
  }

  /**
   * 단일 수신자 알림 전송
   * @private
   * @param {CommentPayload} payload
   * @param {UserMappingResult} recipient
   * @param {'code'|'pr'} commentType
   */
  async #sendSingleRecipientNotification(payload, recipient, commentType) {
    const notificationData = await this.#buildNotificationData(
      payload,
      recipient.githubUsername,
    );
    const channelId = await this.slackChannelService.selectChannel(recipient.githubUsername);

    const messageMethod = commentType === 'code' ?
      'sendCodeCommentMessage' :
      'sendPRPageCommentMessage';

    await this.slackMessageService[messageMethod](notificationData, channelId);
    Logger.info(`${commentType} 코멘트 알림 전송: ${recipient.githubUsername}`);
  }

  /**
   * 다중 수신자 알림 전송
   * @private
   * @param {CommentPayload} payload
   * @param {UserMappingResult[]} recipients
   * @param {'code'|'pr'} commentType
   */
  async #sendMultipleRecipientsNotification(payload, recipients, commentType) {
    const recipientsByChannel = await this.#groupRecipientsByChannel(recipients);
    const baseNotificationData = await this.#buildNotificationData(payload);

    const messageMethod = commentType === 'code' ?
      'sendCodeCommentMessage' :
      'sendPRPageCommentMessage';

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
   * 알림 데이터 생성 (GitHub 멘션을 Slack 멘션으로 변환 추가)
   * @private
   * @param {CommentPayload} payload
   * @param {string} [targetUsername]
   * @returns {Promise<NotificationData>}
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

    // GitHub 멘션을 Slack 멘션으로 변환
    const slackIdResolver = (usernames, property) => this.slackUserService.getSlackProperties(
      usernames,
      property,
    );
    const convertedCommentBody = await MentionUtils.convertCommentMentions(
      comment.body,
      slackIdResolver,
    );
    const imageProcessResult = ImageUtils.processCommentImages(convertedCommentBody);

    return {
      prUrl: prData.html_url || `https://github.com/${repository.full_name}/pull/${commentType.prNumber}`,
      prTitle: prData.title,
      commentUrl: comment.html_url,
      commentBody: imageProcessResult.text,
      codeSnippet: comment.diff_hunk,
      authorUsername,
      authorSlackName: authorSlackInfo,
      targetUsername: actualTargetUsername,
      targetSlackId,
    };
  }

  /**
   * PR의 모든 리뷰어 조회 (개별 + 팀)
   * @private
   * @param {string} repoName - 저장소 이름
   * @param {number} prNumber - PR 번호
   * @param {GitHubPullRequest} prDetails - PR 상세 정보
   * @returns {Promise<UserMappingResult[]>} Slack ID가 추가된 리뷰어 목록
   */
  async #getAllReviewers(repoName, prNumber, prDetails) {
    const reviews = await this.gitHubApiHelper.fetchPullRequestReviews(repoName, prNumber);

    Logger.debug('PR 리뷰어 조회 시작', {
      repoName,
      prNumber,
      author: prDetails.user?.login,
      requestedReviewersCount: prDetails.requested_reviewers?.length || 0,
      requestedTeamsCount: prDetails.requested_teams?.length || 0,
      reviewsCount: reviews.length,
    });

    // 1. 개별 요청된 리뷰어
    const requestedReviewers = (prDetails.requested_reviewers || []).map((r) => r.login);

    // 2. 팀으로 요청된 리뷰어 처리
    const teamMembers = await this.#fetchTeamReviewers(prDetails.requested_teams || []);

    // 3. 실제 리뷰한 사람
    const actualReviewers = reviews.map((review) => review.user.login);

    // 4. 모든 리뷰어 통합 (중복 제거)
    const allReviewerUsernames = [...new Set([
      ...requestedReviewers,
      ...teamMembers,
      ...actualReviewers,
    ])];

    Logger.debug('모든 리뷰어 조회 완료', {
      repoName,
      prNumber,
      individualReviewers: requestedReviewers.length,
      teamReviewers: teamMembers.length,
      actualReviewers: actualReviewers.length,
      totalUnique: allReviewerUsernames.length,
    });

    const reviewerObjects = allReviewerUsernames.map((username) => ({ githubUsername: username }));
    return this.slackUserService.addSlackIdsToRecipients(reviewerObjects);
  }

  /**
   * 팀 리뷰어 멤버 조회
   * @private
   * @param {Array<{slug: string}>} requestedTeams - 요청된 팀 목록
   * @returns {Promise<string[]>} 팀 멤버 GitHub 사용자명 목록
   */
  async #fetchTeamReviewers(requestedTeams) {
    if (!requestedTeams || requestedTeams.length === 0) {
      return [];
    }

    const teamMemberPromises = requestedTeams.map(async (team) => {
      try {
        const members = await this.gitHubApiHelper.fetchTeamMembers(team.slug);
        Logger.debug(`팀 멤버 조회 성공: ${team.slug} (${members.length}명)`);
        return members.map((member) => member.login);
      } catch (error) {
        Logger.warn(`팀 멤버 조회 실패: ${team.slug}`, error);
        return [];
      }
    });

    const teamMembersArrays = await Promise.all(teamMemberPromises);
    return teamMembersArrays.flat();
  }

  /**
   * 리뷰어 코멘트에 대한 수신자 결정
   * @private
   * @param {UserMappingResult[]} allReviewers
   * @param {string} commentAuthor
   * @param {string} prAuthor
   * @returns {Promise<UserMappingResult[]>}
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
   * @param {UserMappingResult[]} recipients - 수신자 목록
   * @returns {Promise<ChannelGroupedRecipients>} 채널별 그룹화된 수신자
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
   * @param {UserMappingResult[]} recipients
   * @returns {UserMappingResult[]}
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
