const fetchSlackUserList = require('../../slack/fetchSlackUserList');

describe('fetchSlackUserList', () => {
  let mockWeb;

  beforeEach(() => {
    mockWeb = {
      users: { list: jest.fn() },
    };
  });

  it('Slack 사용자 목록 조회 성공', async () => {
    const mockMembers = [
      { id: 'U123', real_name: '사용자1' },
      { id: 'U456', real_name: '사용자2' },
    ];
    mockWeb.users.list.mockResolvedValue({ members: mockMembers });

    const result = await fetchSlackUserList(mockWeb);

    expect(mockWeb.users.list).toHaveBeenCalled();
    expect(result).toEqual(mockMembers);
  });

  it('Slack API 오류 처리', async () => {
    const error = new Error('Slack API Error');
    mockWeb.users.list.mockRejectedValue(error);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await expect(fetchSlackUserList(mockWeb)).rejects.toThrow('Slack API Error');
    expect(consoleSpy).toHaveBeenCalledWith('Error fetching Slack user list:', error);

    consoleSpy.mockRestore();
  });
});
