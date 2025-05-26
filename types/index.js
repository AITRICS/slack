/**
 * @typedef {Object} GitHubUser
 * @property {string} login - GitHub 사용자명
 * @property {number} id - GitHub 사용자 ID
 * @property {string} html_url - GitHub 프로필 URL
 * @property {string} [name] - 실제 이름
 */

/**
 * @typedef {Object} Repository
 * @property {string} name - 저장소 이름
 * @property {string} full_name - 전체 저장소 이름 (owner/repo)
 * @property {string} html_url - 저장소 URL
 */

/**
 * @typedef {Object} PullRequest
 * @property {number} number - PR 번호
 * @property {string} title - PR 제목
 * @property {string} html_url - PR URL
 * @property {GitHubUser} user - PR 작성자
 * @property {boolean} draft - 드래프트 여부
 * @property {GitHubUser[]} [requested_reviewers] - 리뷰 요청 받은 사용자들
 */

/**
 * @typedef {Object} Comment
 * @property {number} id - 코멘트 ID
 * @property {string} body - 코멘트 내용
 * @property {string} html_url - 코멘트 URL
 * @property {GitHubUser} user - 코멘트 작성자
 * @property {string} [diff_hunk] - 코드 diff (코드 코멘트인 경우)
 * @property {number} [in_reply_to_id] - 답글인 경우 원본 코멘트 ID
 * @property {string} [issue_url] - 이슈 URL (PR 페이지 코멘트인 경우)
 */

/**
 * @typedef {Object} Review
 * @property {number} id - 리뷰 ID
 * @property {string} state - 리뷰 상태 (approved, changes_requested, commented)
 * @property {string} body - 리뷰 내용
 * @property {string} html_url - 리뷰 URL
 * @property {GitHubUser} user - 리뷰어
 */

/**
 * @typedef {Object} CommentEventPayload
 * @property {'created'} action - 이벤트 액션
 * @property {Comment} comment - 코멘트 정보
 * @property {PullRequest} [pull_request] - PR 정보 (코드 코멘트인 경우)
 * @property {Object} [issue] - 이슈 정보 (PR 페이지 코멘트인 경우)
 * @property {number} issue.number - 이슈/PR 번호
 * @property {Repository} repository - 저장소 정보
 * @property {GitHubUser} sender - 이벤트 발생시킨 사용자
 */

/**
 * @typedef {Object} ReviewEventPayload
 * @property {'submitted'} action - 이벤트 액션
 * @property {Review} review - 리뷰 정보
 * @property {PullRequest} pull_request - PR 정보
 * @property {Repository} repository - 저장소 정보
 * @property {GitHubUser} sender - 이벤트 발생시킨 사용자
 */

/**
 * @typedef {Object} ReviewRequestedPayload
 * @property {'review_requested'} action - 이벤트 액션
 * @property {PullRequest} pull_request - PR 정보
 * @property {GitHubUser} requested_reviewer - 리뷰 요청 받은 사용자
 * @property {Repository} repository - 저장소 정보
 * @property {GitHubUser} sender - 이벤트 발생시킨 사용자
 */

/**
 * @typedef {Object} GitHubContext
 * @property {Object} payload - GitHub 이벤트 페이로드
 * @property {Repository} payload.repository - 저장소 정보
 * @property {string} runId - 워크플로우 실행 ID
 * @property {string} ref - Git ref (브랜치/태그)
 * @property {string} sha - 커밋 SHA
 */

/**
 * @typedef {Object} SlackUser
 * @property {string} id - Slack 사용자 ID
 * @property {string} real_name - 실제 이름
 * @property {boolean} deleted - 삭제된 사용자 여부
 * @property {Object} profile - 프로필 정보
 * @property {string} profile.display_name - 표시 이름
 */

/**
 * @typedef {Object} SlackMessage
 * @property {string} channel - 채널 ID
 * @property {string} text - 메시지 텍스트
 * @property {SlackAttachment[]} [attachments] - 첨부 내용
 * @property {boolean} [mrkdwn] - 마크다운 사용 여부
 */

/**
 * @typedef {Object} SlackAttachment
 * @property {string} color - 색상 (good, danger, warning 등)
 * @property {string} [text] - 첨부 텍스트
 * @property {SlackField[]} [fields] - 필드 목록
 */

/**
 * @typedef {Object} SlackField
 * @property {string} title - 필드 제목
 * @property {string} value - 필드 값
 * @property {boolean} [short] - 짧은 필드 여부
 */

/**
 * @typedef {Object} NotificationData
 * @property {string} prUrl - PR URL
 * @property {string} prTitle - PR 제목
 * @property {string} commentUrl - 코멘트 URL
 * @property {string} commentBody - 코멘트 내용
 * @property {string} authorUsername - 작성자 GitHub 사용자명
 * @property {string} authorSlackName - 작성자 Slack 표시 이름
 * @property {string} [targetUsername] - 대상자 GitHub 사용자명
 * @property {string} [targetSlackId] - 대상자 Slack ID
 * @property {string} [mentionsString] - 멘션 문자열 (다중 사용자)
 * @property {string} [codeSnippet] - 코드 스니펫 (코드 코멘트인 경우)
 */

/**
 * @typedef {Object} DeploymentData
 * @property {string} ec2Name - EC2 인스턴스 이름
 * @property {string} imageTag - Docker 이미지 태그
 * @property {string} status - 배포 상태 (success/failure)
 * @property {string} repoName - 저장소 이름
 * @property {string} repoUrl - 저장소 URL
 * @property {string} sha - 커밋 SHA
 * @property {string} ref - Git ref
 * @property {string} triggerUsername - 실행한 사용자명
 * @property {string} workflowName - 워크플로우 이름
 * @property {string} workflowUrl - 워크플로우 URL
 * @property {string} duration - 실행 시간
 */

module.exports = {}; // TypeScript처럼 타입만 정의
