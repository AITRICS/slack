const { GITHUB_CONFIG } = require('../constants');

/**
 * @typedef {import('@octokit/rest').Octokit} Octokit
 * @typedef {import('../types').GitHubUser} GitHubUser
 * @typedef {import('../types').PullRequest} PullRequest
 * @typedef {import('../types').Review} Review
 */

/**
 * GitHub API 헬퍼 클래스
 * Octokit을 래핑하여 프로젝트에 필요한 GitHub API 호출을 제공
 */
class GitHubApiHelper {
  /**
   * @param {Octokit} octokit - Octokit 인스턴스
   */
  constructor(octokit) {
    this.octokit = octokit;
  }

  /**
   * GitHub 팀 멤버 목록 조회
   * @param {string} teamSlug - 팀 슬러그
   * @returns {Promise<GitHubUser[]>} 팀 멤버 목록
   */
  async fetchTeamMembers(teamSlug) {
    try {
      const response = await this.octokit.teams.listMembersInOrg({
        org: GITHUB_CONFIG.ORGANIZATION,
        team_slug: teamSlug,
      });
      return response.data;
    } catch (error) {
      console.error(`팀 멤버 조회 실패 (${teamSlug}):`, error);
      throw error;
    }
  }

  /**
   * 리뷰 코멘트 작성자 조회
   * @param {string} repoName - 저장소 이름
   * @param {number} commentId - 코멘트 ID
   * @returns {Promise<string>} 작성자 GitHub 사용자명
   */
  async fetchCommentAuthor(repoName, commentId) {
    try {
      const response = await this.octokit.rest.pulls.getReviewComment({
        owner: GITHUB_CONFIG.ORGANIZATION,
        repo: repoName,
        comment_id: commentId,
      });
      return response.data.user.login;
    } catch (error) {
      console.error(`코멘트 작성자 조회 실패 (ID: ${commentId}):`, error);
      throw error;
    }
  }

  /**
   * 코멘트 스레드 참여자 조회
   * 특정 코멘트가 속한 스레드의 모든 참여자를 찾음
   * @param {string} repoName - 저장소 이름
   * @param {number} prNumber - PR 번호
   * @param {number} currentCommentId - 현재 코멘트 ID
   * @returns {Promise<string[]>} 스레드 참여자 사용자명 목록
   */
  async fetchCommentThreadParticipants(repoName, prNumber, currentCommentId) {
    try {
      const response = await this.octokit.rest.pulls.listReviewComments({
        owner: GITHUB_CONFIG.ORGANIZATION,
        repo: repoName,
        pull_number: prNumber,
      });

      const allComments = response.data;
      const currentComment = allComments.find((comment) => comment.id === currentCommentId);

      if (!currentComment) {
        console.warn(`코멘트를 찾을 수 없음 (ID: ${currentCommentId})`);
        return [];
      }

      // 스레드 루트 찾기
      const threadRootId = this._findThreadRoot(allComments, currentComment);

      // 스레드의 모든 코멘트 수집
      const threadComments = this._collectThreadComments(allComments, threadRootId);

      // 고유한 참여자 추출
      const participants = [...new Set(threadComments.map((comment) => comment.user.login))];
      return participants;
    } catch (error) {
      console.error(`코멘트 스레드 참여자 조회 실패 (PR #${prNumber}):`, error);
      throw error;
    }
  }

  /**
   * 스레드의 루트 코멘트 찾기
   * @private
   * @param {Array} allComments - 모든 코멘트
   * @param {Object} comment - 현재 코멘트
   * @returns {number} 루트 코멘트 ID
   */
  _findThreadRoot(allComments, comment) {
    let current = comment;

    // in_reply_to_id 체인을 따라 올라가며 루트 찾기
    while (current.in_reply_to_id) {
      const parent = allComments.find((c) => c.id === current.in_reply_to_id);
      if (!parent) break;
      current = parent;
    }

    return current.id;
  }

  /**
   * 스레드의 모든 코멘트 수집
   * @private
   * @param {Array} allComments - 모든 코멘트
   * @param {number} threadRootId - 스레드 루트 ID
   * @returns {Array} 스레드 코멘트 목록
   */
  _collectThreadComments(allComments, threadRootId) {
    const threadComments = [];
    const visited = new Set();

    // 루트 코멘트 추가
    const root = allComments.find((c) => c.id === threadRootId);
    if (root) {
      threadComments.push(root);
      visited.add(root.id);
    }

    // 재귀적으로 모든 답글 찾기
    const findReplies = (parentId) => {
      const replies = allComments.filter(
        (comment) => comment.in_reply_to_id === parentId && !visited.has(comment.id),
      );

      replies.forEach((reply) => {
        threadComments.push(reply);
        visited.add(reply.id);
        findReplies(reply.id); // 답글의 답글 찾기
      });
    };

    findReplies(threadRootId);
    return threadComments;
  }

  /**
   * GitHub 사용자의 실제 이름 조회
   * @param {string} username - GitHub 사용자명
   * @returns {Promise<string>} 실제 이름 또는 사용자명
   */
  async fetchUserRealName(username) {
    try {
      const response = await this.octokit.rest.users.getByUsername({ username });
      return response.data.name || username;
    } catch (error) {
      console.error(`사용자 정보 조회 실패 (${username}):`, error);
      throw error;
    }
  }

  /**
   * PR 리뷰 목록 조회
   * @param {string} repoName - 저장소 이름
   * @param {number} prNumber - PR 번호
   * @returns {Promise<Review[]>} 리뷰 목록
   */
  async fetchPullRequestReviews(repoName, prNumber) {
    try {
      const response = await this.octokit.rest.pulls.listReviews({
        owner: GITHUB_CONFIG.ORGANIZATION,
        repo: repoName,
        pull_number: prNumber,
      });
      return response.data;
    } catch (error) {
      console.error(`PR 리뷰 조회 실패 (PR #${prNumber}):`, error);
      throw error;
    }
  }

  /**
   * PR 상세 정보 조회
   * @param {string} repoName - 저장소 이름
   * @param {number} prNumber - PR 번호
   * @returns {Promise<PullRequest>} PR 상세 정보
   */
  async fetchPullRequestDetails(repoName, prNumber) {
    try {
      const response = await this.octokit.rest.pulls.get({
        owner: GITHUB_CONFIG.ORGANIZATION,
        repo: repoName,
        pull_number: prNumber,
      });
      return response.data;
    } catch (error) {
      console.error(`PR 상세 조회 실패 (PR #${prNumber}):`, error);
      throw error;
    }
  }

  /**
   * 열린 PR 목록 조회
   * @param {string} repoName - 저장소 이름
   * @returns {Promise<PullRequest[]>} 열린 PR 목록
   */
  async fetchOpenPullRequests(repoName) {
    try {
      const response = await this.octokit.rest.pulls.list({
        owner: GITHUB_CONFIG.ORGANIZATION,
        repo: repoName,
        state: 'open',
      });
      return response.data;
    } catch (error) {
      console.error(`열린 PR 조회 실패 (${repoName}):`, error);
      throw error;
    }
  }

  /**
   * 워크플로우 실행 정보 조회
   * @param {string} repoName - 저장소 이름
   * @param {string} runId - 실행 ID
   * @returns {Promise<Object>} 워크플로우 실행 정보
   */
  async fetchWorkflowRunData(repoName, runId) {
    try {
      const response = await this.octokit.actions.getWorkflowRun({
        owner: GITHUB_CONFIG.ORGANIZATION,
        repo: repoName,
        run_id: runId,
      });
      return response.data;
    } catch (error) {
      console.error(`워크플로우 실행 조회 실패 (ID: ${runId}):`, error);
      throw error;
    }
  }
}

module.exports = GitHubApiHelper;
