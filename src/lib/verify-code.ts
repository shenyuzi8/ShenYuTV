// 解决 Next.js 开发环境热更新重置内存问题
declare global {
  // eslint-disable-next-line no-var
  var _verifyCodeStore: Map<string, { code: string; expire: number }>;
}

// 全局单例存储（热更新不会丢失）
const codeStore = globalThis._verifyCodeStore || new Map();
globalThis._verifyCodeStore = codeStore;

// ====================
// 自动清理：过期验证码（兼容 ES5，无 TS 报错）
// ====================
const cleanExpiredCodes = () => {
  const now = Date.now();
  // 用 forEach 替代 for...of，彻底解决 TS 编译错误
  codeStore.forEach((data, key) => {
    if (data.expire < now) {
      codeStore.delete(key);
    }
  });
};

// 每10分钟兜底清理一次（防止内存泄漏）
setInterval(cleanExpiredCodes, 10 * 60 * 1000);

// ====================
// 存储验证码（5分钟过期）
// ====================
export function setCode(
  email: string,
  type: 'register' | 'reset',
  code: string
) {
  cleanExpiredCodes(); // 存之前先清过期
  const key = `${email}:${type}`;
  codeStore.set(key, {
    code: code.trim(),
    expire: Date.now() + 5 * 60 * 1000, // 5分钟自动过期
  });
  // eslint-disable-next-line no-console
  console.log('✅ 验证码已存储(5分钟过期):', key, '=', code);
}

// ====================
// 校验验证码（用后即删）
// ====================
export function verifyCode(
  email: string,
  type: 'register' | 'reset',
  inputCode: string
): boolean {
  cleanExpiredCodes(); // 校验前先清过期
  const key = `${email}:${type}`;
  const data = codeStore.get(key);

  // 无数据 / 已过期
  if (!data) return false;

  // 校验成功 → 立即删除
  const isValid = data.code === inputCode.trim();
  if (isValid) {
    codeStore.delete(key);
  }

  // eslint-disable-next-line no-console
  console.log('🔍 校验:', key, '输入:', inputCode, '正确值:', data.code);
  return isValid;
}