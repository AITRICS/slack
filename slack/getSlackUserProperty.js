async function getSlackUserProperty(octokit, web, searchName, property) {
  const githubNickName = await getGithubNickNameToGitHub(octokit, searchName);
  return findSlackUserPropertyByGitName(web, githubNickName, property);
}

module.exports = getSlackUserProperty;
