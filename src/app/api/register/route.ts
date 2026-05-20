import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { verifyCode } from '@/lib/verify-code';

// 修复1：移除 any，规范类型
const STORAGE_TYPE = (process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage') as string;

async function generateSignature(data: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 修复2：移除 any，定义明确类型
async function generateAuthCookie(username: string) {
  const authData = {
    role: 'user' as const,
    username,
    timestamp: Date.now()
  };
  const signature = await generateSignature(username, process.env.PASSWORD || '');
  (authData as { signature?: string }).signature = signature;
  return encodeURIComponent(JSON.stringify(authData));
}

export async function POST(req: NextRequest) {
  try {
    if (STORAGE_TYPE === 'localstorage') {
      return NextResponse.json({ error: '当前模式不支持注册' }, { status: 400 });
    }

    const { username, password, code } = await req.json();

    // 基础校验
    if (!username) return NextResponse.json({ error: '邮箱不能为空' }, { status: 400 });
    if (!password) return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
    if (!code) return NextResponse.json({ error: '验证码不能为空' }, { status: 400 });

    // 校验用户名必须是邮箱
    if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(username)) {
      return NextResponse.json({ error: '请输入合法邮箱地址' }, { status: 400 });
    }

    // 验证码校验
    const isValid = verifyCode(username, 'register', code);
    if (!isValid) {
      return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 });
    }

    // 禁止与管理员账号重名
    if (username === process.env.USERNAME) {
      return NextResponse.json({ error: '账号已存在' }, { status: 400 });
    }

    // 校验用户是否已存在
    const userExist = await db.checkUserExist(username);
    if (userExist) {
      return NextResponse.json({ error: '该邮箱已注册' }, { status: 400 });
    }

    // 创建用户
    await db.registerUser(username, password);
    const config = await getConfig();
    if (!config.UserConfig) config.UserConfig = { Users: [] };
    if (!Array.isArray(config.UserConfig.Users)) config.UserConfig.Users = [];

    // 防御逻辑：如果普通用户组不存在，自动创建（兜底保障）
    if (!config.UserConfig.Tags) config.UserConfig.Tags = [];
    const hasDefaultGroup = config.UserConfig.Tags.some(t => t.name === "普通用户");
    if (!hasDefaultGroup) {
      config.UserConfig.Tags.push({ name: "普通用户", enabledApis: [] });
    }

    // 修复3：移除 any，兼容原有类型（无TS报错）
    const newUser = {
      username,
      role: 'user' as const,
      tags: ["普通用户"]
    };
    config.UserConfig.Users.push(newUser as never);

    await db.saveAdminConfig(config);

    // 生成登录Cookie
    const response = NextResponse.json({ ok: true });
    const cookieStr = await generateAuthCookie(username);
    const expireTime = new Date();
    expireTime.setDate(expireTime.getDate() + 7);
    response.cookies.set('auth', cookieStr, {
      path: '/',
      expires: expireTime,
      sameSite: 'lax',
      httpOnly: false
    });

    return response;
  } catch (err) {
    // 修复4：移除 console.error，符合打包规范
    return NextResponse.json({ error: '服务器异常' }, { status: 500 });
  }
}