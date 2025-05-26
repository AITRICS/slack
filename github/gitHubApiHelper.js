const { GITHUB_CONFIG } = require('../constants');

/**
 * @typedef {import('@octokit/rest').Octokit} Octokit
 * @typedef {Object} GitHubUser
 * @property {string} login
 * @property {number} id
 * @property {string} html_url
 * @property {string} [name]
 */

/**
 * @typedef {Object} PullRequest
 * @property {number} number
 * @property {string} title
 * @property {string} html_url
 * @property {GitHubUser} user
 * @property {boolean} draft
 * @property {GitHubUser[]} [requested_reviewers]
 */

/**
 * @typedef {Object} Review
 * @property {number} id
 * @property {string} state
 * @property {string} body
 * @property {string} html_url
 * @property {GitHubUser} user
 */

/**
 * GitHub API 헬퍼 클래스
 * Octokit을 래핑하여 프로젝트에 필요한 GitHub API 호출을 제공
 */
class GitHubApiHelper {
  /**
   * @param {Octokit} octokit
   */
  constructor(octokit) {
    this.octokit = octokit;
  }

  /**
   * GitHub 팀 멤버 목록 조회
   * @param {string} teamSlug
   * @returns {Promise<GitHubUser[]>}
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
   * @param {string} repoName
   * @param {number} commentId
   * @returns {Promise<string>}
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
   * @param {string} repoName
   * @param {number} prNumber
   * @param {number} currentCommentId
   * @returns {Promise<string[]>}
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

      const threadRootId = this.#findThreadRoot(allComments, currentComment);
      const threadComments = this.#collectThreadComments(allComments, threadRootId);
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
   * @param {Array} allComments
   * @param {Object} comment
   * @returns {number}
   */
  #findThreadRoot(allComments, comment) {
    let current = comment;

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
   * @param {Array} allComments
   * @param {number} threadRootId
   * @returns {Array}
   */
  #collectThreadComments(allComments, threadRootId) {
    const threadComments = [];
    const visited = new Set();

    const root = allComments.find((c) => c.id === threadRootId);
    if (root) {
      threadComments.push(root);
      visited.add(root.id);
    }

    const findReplies = (parentId) => {
      const replies = allComments.filter(
        (comment) => comment.in_reply_to_id === parentId && !visited.has(comment.id),
      );

      replies.forEach((reply) => {
        threadComments.push(reply);
        visited.add(reply.id);
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
   * @param {string} repoName
   * @param {number} prNumber
   * @returns {Promise<Review[]>}
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
   * @param {string} repoName
   * @param {number} prNumber
   * @returns {Promise<PullRequest>}
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
   * @param {string} repoName
   * @returns {Promise<PullRequest[]>}
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
   * @param {string} repoName
   * @param {string} runId
   * @returns {Promise<Object>}
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
