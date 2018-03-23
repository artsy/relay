jest.mock('../../util/md5');
const md5 = require('../../util/md5');
const persistQuery = require('../persistQuery');

describe('persistQuery', () => {
  const animalQuery = 'query { animal }';
  const humanQuery = 'query { human }';

  md5.mockImplementation(query => {
    if (query === animalQuery) {
      return 'animalMd5';
    } else if (query === humanQuery) {
      return 'humanMd5';
    }
    return 'unknownMd5';
  });

  test('should hash and store query correctly', async () => {
    const queryId = await persistQuery(animalQuery);
    expect(queryId).toEqual('animalMd5');
  });

  test('should hash and store all queries correctly', async () => {
    const queryId1 = await persistQuery(animalQuery);
    const queryId2 = await persistQuery(humanQuery);

    expect(queryId1).toEqual('animalMd5');
    expect(queryId2).toEqual('humanMd5');
  });
});