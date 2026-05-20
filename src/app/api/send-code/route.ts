import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { setCode } from '@/lib/verify-code';

// 生成6位数字验证码
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 发送邮件
async function sendEmail(to: string, code: string) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: '账号验证验证码',
    text: `您的验证码是：${code}，5分钟内有效，请勿泄露给他人。`,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { email, type } = await req.json();

    if (!email || !/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
    }

    const code = generateCode();
    // 存入全局验证码
    setCode(email, type, code);
    await sendEmail(email, code);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('❌ 发送邮件失败', err);
    return NextResponse.json({ error: '发送失败' }, { status: 500 });
  }
}