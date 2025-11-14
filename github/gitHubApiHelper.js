const { GITHUB_CONFIG } = require('../constants');
const Logger = require('../utils/logger');
const { GitHubAPIError } = require('../utils/errors');

/**
 * GitHub API 헬퍼 클래스
 * Octokit을 래핑하여 프로젝트에 필요한 GitHub API 호출을 제공
 */
class GitHubApiHelper {
  /**
   * @param {import('@octokit/rest').Octokit} octokit
   */
  constructor(octokit) {
    this.octokit = octokit;
  }

  /**
   * GitHub 팀 멤버 목록 조회
   * @param {string} teamSlug
   * @returns {Promise<GitHubUser[]>}
   * @throws {GitHubAPIError}
   */
  async fetchTeamMembers(teamSlug) {
    try {
      Logger.debug(`팀 멤버 조회 시작: ${teamSlug}`);

      const response = await this.octokit.teams.listMembersInOrg({
        org: GITHUB_CONFIG.ORGANIZATION,
        team_slug: teamSlug,
      });

      Logger.debug(`팀 멤버 조회 완료: ${teamSlug} (${response.data.length}명)`);
      return response.data;
    } catch (error) {
      Logger.error(`팀 멤버 조회 실패 (${teamSlug})`, error);
      throw new GitHubAPIError(
        `팀 멤버 조회 실패: ${teamSlug}`,
        { teamSlug, originalError: error.message },
        { cause: error },
      );
    }
  }

  /**
   * 코멘트 작성자 조회 (코멘트 타입에 따라 적절한 API 호출)
   * @param {string} repoName
   * @param {number} commentId
   * @param {boolean} [isReviewComment=true] - 리뷰 코멘트 여부
   * @returns {Promise<string>}
   * @throws {GitHubAPIError}
   */
  async fetchCommentAuthor(repoName, commentId, isReviewComment = true) {
    try {
      Logger.debug(`코멘트 작성자 조회: ${repoName}#${commentId} (리뷰코멘트: ${isReviewComment})`);

      let response;
      if (isReviewComment) {
        response = await this.octokit.rest.pulls.getReviewComment({
          owner: GITHUB_CONFIG.ORGANIZATION,
          repo: repoName,
          comment_id: commentId,
        });
      } else {
        response = await this.octokit.rest.issues.getComment({
          owner: GITHUB_CONFIG.ORGANIZATION,
          repo: repoName,
          comment_id: commentId,
        });
      }

      const authorLogin = response.data.user.login;
      Logger.debug(`코멘트 작성자 조회 완료: ${authorLogin}`);
      return authorLogin;
    } catch (error) {
      Logger.error(`코멘트 작성자 조회 실패 (ID: ${commentId})`, error);
      throw new GitHubAPIError(
        `코멘트 작성자 조회 실패: ${commentId}`,
        {
          repoName, commentId, isReviewComment, originalError: error.message,
        },
        { cause: error },
      );
    }
  }

  /**
   * 코멘트 스레드 참여자 조회
   * @param {string} repoName
   * @param {number} prNumber
   * @param {number} currentCommentId
   * @param {boolean} [isReviewComment=true] - 리뷰 코멘트 여부
   * @returns {Promise<string[]>}
   * @throws {GitHubAPIError}
   */
  async fetchCommentThreadParticipants(repoName, prNumber, currentCommentId, isReviewComment = true) {
    try {
      Logger.debug(`코멘트 스레드 참여자 조회: ${repoName}#${prNumber}, 코멘트 ID: ${currentCommentId}, 리뷰코멘트: ${isReviewComment}`);

      const allComments = await this.#fetchAllComments(repoName, prNumber, isReviewComment);
      const currentComment = this.#findCommentById(allComments, currentCommentId);

      if (!currentComment) {
        Logger.error('코멘트를 찾을 수 없습니다', {
          repoName,
          prNumber,
          currentCommentId,
          isReviewComment,
          totalComments: allComments.length,
          commentIds: allComments.map((c) => c.id),
          searchedId: currentCommentId,
          searchedIdType: typeof currentCommentId,
        });

        throw new GitHubAPIError(
          `코멘트를 찾을 수 없습니다: ${currentCommentId}`,
          {
            repoName,
            prNumber,
            currentCommentId,
            isReviewComment,
            totalComments: allComments.length,
            commentIds: allComments.map((c) => c.id),
          },
        );
      }

      const threadRootId = this.#findThreadRoot(allComments, currentComment);
      const threadComments = this.#collectThreadComments(allComments, threadRootId);
      const participants = [...new Set(threadComments.map((comment) => comment.user.login))];

      Logger.debug(`스레드 참여자 조회 완료: ${participants.length}명`);
      return participants;
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }

      Logger.error(`코멘트 스레드 참여자 조회 실패 (PR #${prNumber})`, error);
      throw new GitHubAPIError(
        `코멘트 스레드 참여자 조회 실패: PR #${prNumber}`,
        {
          repoName,
          prNumber,
          currentCommentId,
          isReviewComment,
          originalError: error.message,
        },
        { cause: error },
      );
    }
  }

  /**
   * 모든 코멘트 조회 (타입에 따라 적절한 API 호출)
   * @private
   * @param {string} repoName
   * @param {number} prNumber
   * @param {boolean} isReviewComment
   * @returns {Promise<GitHubComment[]>}
   */
  async #fetchAllComments(repoName, prNumber, isReviewComment) {
    const commonOpts = {
      owner: GITHUB_CONFIG.ORGANIZATION,
      repo: repoName,
      per_page: 100, // 최댓값
    };

    if (isReviewComment) {
      return this.octokit.paginate(
        this.octokit.rest.pulls.listReviewComments,
        { ...commonOpts, pull_number: prNumber },
      );
    }

    return this.octokit.paginate(
      this.octokit.rest.issues.listComments,
      { ...commonOpts, issue_number: prNumber },
    );
  }

  /**
   * ID로 코멘트 찾기
   * @private
   * @param {GitHubComment[]} comments
   * @param {number} commentId
   * @returns {GitHubComment|undefined}
   */
  #findCommentById(comments, commentId) {
    // 숫자와 문자열 모두 비교하여 타입 변환 문제 해결
    const targetId = String(commentId);
    return comments.find((comment) => {
      const commentIdStr = String(comment.id);
      const commentIdNum = Number(comment.id);
      const targetIdNum = Number(commentId);

      // 문자열 비교와 숫자 비교 모두 시도
      return commentIdStr === targetId ||
        commentIdNum === targetIdNum ||
        comment.id === commentId;
    });
  }

  /**
   * 스레드의 루트 코멘트 찾기 (개선된 타입 비교)
   * @private
   * @param {GitHubComment[]} allComments
   * @param {GitHubComment} comment
   * @returns {number}
   */
  #findThreadRoot(allComments, comment) {
    let current = comment;

    while (current.in_reply_to_id) {
      const replyToId = current.in_reply_to_id;
      const parent = allComments.find((c) => {
        const cIdStr = String(c.id);
        const replyToIdStr = String(replyToId);
        const cIdNum = Number(c.id);
        const replyToIdNum = Number(replyToId);

        return cIdStr === replyToIdStr ||
          cIdNum === replyToIdNum ||
          c.id === replyToId;
      });

      if (!parent) break;
      current = parent;
    }

    return current.id;
  }

  /**
   * 스레드의 모든 코멘트 수집 (개선된 타입 비교)
   * @private
   * @param {GitHubComment[]} allComments
   * @param {number} threadRootId
   * @returns {GitHubComment[]}
   */
  #collectThreadComments(allComments, threadRootId) {
    const threadComments = [];
    const visited = new Set();

    const root = allComments.find((c) => {
      const cIdStr = String(c.id);
      const rootIdStr = String(threadRootId);
      const cIdNum = Number(c.id);
      const rootIdNum = Number(threadRootId);

      return cIdStr === rootIdStr ||
        cIdNum === rootIdNum ||
        c.id === threadRootId;
    });

    if (root) {
      threadComments.push(root);
      visited.add(String(root.id));
    }

    const findReplies = (parentId) => {
      const parentIdStr = String(parentId);
      const parentIdNum = Number(parentId);

      const replies = allComments.filter((comment) => {
        const replyToIdStr = String(comment.in_reply_to_id);
        const replyToIdNum = Number(comment.in_reply_to_id);
        const commentIdStr = String(comment.id);

        const isReplyToParent = replyToIdStr === parentIdStr ||
          replyToIdNum === parentIdNum ||
          comment.in_reply_to_id === parentId;

        return isReplyToParent && !visited.has(commentIdStr);
      });

      replies.forEach((reply) => {
        threadComments.push(reply);
        visited.add(String(reply.id));
        findReplies(reply.id);
      });
    };

    findReplies(threadRootId);
    return threadComments;
  }

  /**
   * GitHub 사용자의 실제 이름 조회
   * @param {string} username
   * @returns {Promise<string>}
   * @throws {GitHubAPIError}
   */
  async fetchUserRealName(username) {
    try {
      Logger.debug(`사용자 실명 조회: ${username}`);

      const response = await this.octokit.rest.users.getByUsername({ username });
      const realName = response.data.name || username;

      Logger.debug(`사용자 실명 조회 완료: ${username} → ${realName}`);
      return realName;
    } catch (error) {
      Logger.error(`사용자 정보 조회 실패 (${username})`, error);
      throw new GitHubAPIError(
        `사용자 정보 조회 실패: ${username}`,
        { username, originalError: error.message },
        { cause: error },
      );
    }
  }

  /**
   * PR 리뷰 목록 조회
   * @param {string} repoName
   * @param {number} prNumber
   * @returns {Promise<GitHubReview[]>}
   * @throws {GitHubAPIError}
   */
  async fetchPullRequestReviews(repoName, prNumber) {
    try {
      Logger.debug(`PR 리뷰 목록 조회: ${repoName}#${prNumber}`);

      const response = await this.octokit.rest.pulls.listReviews({
        owner: GITHUB_CONFIG.ORGANIZATION,
        repo: repoName,
        pull_number: prNumber,
      });

      Logger.debug(`PR 리뷰 조회 완료: ${response.data.length}개`);
      return response.data;
    } catch (error) {
      Logger.error(`PR 리뷰 조회 실패 (PR #${prNumber})`, error);
      throw new GitHubAPIError(
        `PR 리뷰 조회 실패: PR #${prNumber}`,
        { repoName, prNumber, originalError: error.message },
        { cause: error },
      );
    }
  }

  /**
   * PR 상세 정보 조회
   * @param {string} repoName
   * @param {number} prNumber
   * @returns {Promise<import('../types').GitHubPullRequest>}
   * @throws {GitHubAPIError}
   */
  async fetchPullRequestDetails(repoName, prNumber) {
    try {
      Logger.debug(`PR 상세 정보 조회: ${repoName}#${prNumber}`);

      const response = await this.octokit.rest.pulls.get({
        owner: GITHUB_CONFIG.ORGANIZATION,
        repo: repoName,
        pull_number: prNumber,
      });

      Logger.debug(`PR 상세 정보 조회 완료: ${response.data.title}`);
      return response.data;
    } catch (error) {
      Logger.error(`PR 상세 조회 실패 (PR #${prNumber})`, error);
      throw new GitHubAPIError(
        `PR 상세 조회 실패: PR #${prNumber}`,
        { repoName, prNumber, originalError: error.message },
        { cause: error },
      );
    }
  }

  /**
   * 열린 PR 목록 조회
   * @param {string} repoName
   * @returns {Promise<import('../types').GitHubPullRequest[]>}
   * @throws {GitHubAPIError}
   */
  async fetchOpenPullRequests(repoName) {
    try {
      Logger.debug(`열린 PR 목록 조회: ${repoName}`);

      const response = await this.octokit.rest.pulls.list({
        owner: GITHUB_CONFIG.ORGANIZATION,
        repo: repoName,
        state: 'open',
      });

      Logger.debug(`열린 PR 조회 완료: ${response.data.length}개`);
      return response.data;
    } catch (error) {
      Logger.error(`열린 PR 조회 실패 (${repoName})`, error);
      throw new GitHubAPIError(
        `열린 PR 조회 실패: ${repoName}`,
        { repoName, originalError: error.message },
        { cause: error },
      );
    }
  }

  /**
   * 워크플로우 실행 정보 조회
   * @param {string} repoName
   * @param {string} runId
   * @returns {Promise<import('../types').GitHubWorkflowRun>}
   * @throws {GitHubAPIError}
   */
  async fetchWorkflowRunData(repoName, runId) {
    try {
      Logger.debug(`워크플로우 실행 정보 조회: ${repoName}, Run ID: ${runId}`);

      const response = await this.octokit.actions.getWorkflowRun({
        owner: GITHUB_CONFIG.ORGANIZATION,
        repo: repoName,
        run_id: runId,
      });

      Logger.debug(`워크플로우 실행 정보 조회 완료: ${response.data.name}`);
      return response.data;
    } catch (error) {
      Logger.error(`워크플로우 실행 조회 실패 (ID: ${runId})`, error);
      throw new GitHubAPIError(
        `워크플로우 실행 조회 실패: ${runId}`,
        { repoName, runId, originalError: error.message },
        { cause: error },
      );
    }
  }
}

module.exports = GitHubApiHelper;
