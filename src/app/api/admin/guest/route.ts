import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = getAuthInfoFromCookie(request);
  if (!auth?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const config = await getConfig();
  if (auth.username !== process.env.USERNAME) {
    const user = config.UserConfig.Users.find(
      (item) => item.username === auth.username,
    );
    if (!user || user.role !== 'admin' || user.banned) {
      return NextResponse.json({ error: '权限不足' }, { status: 401 });
    }
  }
  const body = await request.json();
  if (
    !Array.isArray(body.enabledApis) ||
    body.enabledApis.some((key: unknown) => typeof key !== 'string')
  ) {
    return NextResponse.json({ error: '访客视频源格式错误' }, { status: 400 });
  }
  const allowed = new Set(
    config.SourceConfig.filter((source) => !source.disabled).map(
      (source) => source.key,
    ),
  );
  config.GuestConfig = {
    enabledApis: Array.from(new Set<string>(body.enabledApis)).filter((key) =>
      allowed.has(key),
    ),
  };
  await db.saveAdminConfig(config);
  return NextResponse.json({ success: true });
}
