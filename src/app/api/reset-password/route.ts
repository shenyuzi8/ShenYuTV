import { NextRequest, NextResponse } from 'next/server';
import { verifyCode } from '@/lib/verify-code';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { email, code, newPassword } = await req.json();
    // 此处email前端传的就是用户名(邮箱账号)
    const username = email;

    if (!username || !code || !newPassword) {
      return NextResponse.json({ error: '参数不能为空' }, { status: 400 });
    }

    // 验证码校验
    const validCode = verifyCode(username, 'reset', code);
    if (!validCode) {
      return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 });
    }

    // 根据用户名查找用户
    const config = await getConfig();
    const targetUser = config.UserConfig?.Users?.find(item => item.username === username);
    if (!targetUser) {
      return NextResponse.json({ error: '该账号未注册' }, { status: 400 });
    }

    // 修改密码
    await db.changePassword(username, newPassword);
    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error('重置密码失败：', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}