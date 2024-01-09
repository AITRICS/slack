const { Octokit } = require('@octokit/rest');

async function getPRReviewersWithStatus(octokit, owner, repo, pr) {
  const prNumber = pr.number;
  const reviewsResponse = await octokit.rest.pulls.listReviews({
    owner,
    repo,
    pull_number: prNumber,
  });

  const prDetails = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  // 리뷰를 제출한 리뷰어와 그들의 상태를 가져옵니다.
  const submittedReviewers = reviewsResponse.data.reduce((acc, review) => {
    acc[review.user.login] = review.state;
    return acc;
  }, {});

  // 리뷰를 요청받은 리뷰어 목록을 가져옵니다.
  const requestedReviewers = prDetails.data.requested_reviewers.map((reviewer) => reviewer.login);

  // 리뷰를 요청받았지만 아직 리뷰를 제출하지 않은 리뷰어를 찾습니다.
  requestedReviewers.forEach((reviewer) => {
    if (!(reviewer in submittedReviewers)) {
      submittedReviewers[reviewer] = 'AWAITING'; // 'AWAITING' 상태로 표시
    }
  });

  return submittedReviewers;
}

async function getPendingReviewPRs(owner, repo) {
  const octokit = new Octokit({ auth: '' });

  try {
    const response = await octokit.rest.pulls.list({
      owner,
      repo,
      state: 'open',
    });

    // draft 상태가 아닌 PR만 필터링
    const nonDraftPRs = response.data.filter((pr) => !pr.draft);

    const prsDetails = await Promise.all(nonDraftPRs.map(async (pr) => {
      const reviewersStatus = await getPRReviewersWithStatus(octokit, owner, repo, pr);
      return { ...pr, reviewersStatus };
    }));

    return prsDetails;
  } catch (error) {
    console.error('Error fetching PRs:', error);
    throw error;
  }
}

getPendingReviewPRs('aitrics', 'vc-monorepo').then((prsDetails) => {
  prsDetails.forEach((pr) => {
    const reviewers = Object.entries(pr.reviewersStatus)
      .map(([reviewer, status]) => `${reviewer} (${status})`)
      .join(', ');

    console.log(`${pr.title} - Reviewers: ${reviewers}`);
  });
}).catch((error) => {
  console.error('Error:', error);
});
