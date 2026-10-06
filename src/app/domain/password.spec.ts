import { isStrongPassword } from './password';

describe('isStrongPassword', () => {
  it.each(['abcd1234', 'Secreta99', 'a1'.repeat(10)])('accepts %s', p => expect(isStrongPassword(p)).toBe(true));
  it.each(['abc1', 'abcdefgh', '12345678', '', 'a1'.repeat(40)])('rejects %s', p => expect(isStrongPassword(p)).toBe(false));
});
