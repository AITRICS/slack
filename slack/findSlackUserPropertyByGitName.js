async function findSlackUserPropertyByGitName(web, searchName, property) {
  const slackUserList = await web.users.list();
  const lowerCaseSearchName = searchName.toLowerCase();

  const user = slackUserList.members.find(({ real_name: realName, profile }) => {
    const nameToCheck = [realName, profile.display_name].map((name) => name?.toLowerCase());
    return nameToCheck.some((name) => name?.includes(lowerCaseSearchName));
  });

  if (user) {
    if (property === 'id') {
      return user.id;
    }
    if (property === 'realName') {
      return user.profile.display_name;
    }
  }

  return searchName;
}

module.exports = findSlackUserPropertyByGitName;
