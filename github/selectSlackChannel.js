const TEAM_SLUGS = ['SE', 'Platform-frontend', 'Platform-backend'];
const SLACK_CHANNEL = {
  SE: 'C06CS5Q4L8G',
  'Platform-frontend': 'C06B5J3KD8F',
  'Platform-backend': 'C06C8TLTURE',
  'git-any': 'C06CMAY8066',
};

async function selectSlackChannel(octokit, githubName) {
  const memberChecks = TEAM_SLUGS.map(async (teamSlug) => {
    const memberList = await octokit.teams.listMembersInOrg({
      org: 'aitrics',
      team_slug: teamSlug,
    });

    const member = memberList.data.find(({ login }) => login === githubName);
    return member ? teamSlug : null;
  });

  const results = await Promise.all(memberChecks);
  const foundTeamSlug = results.find((slug) => slug !== null);
  return foundTeamSlug ? SLACK_CHANNEL[foundTeamSlug] : SLACK_CHANNEL['git-any'];
}

module.exports = selectSlackChannel;
