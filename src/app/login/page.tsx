/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';


function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { siteName } = useSite();

  // 倒计时（无修改）
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 发送验证码（无修改）
  const sendCode = async (type: 'register' | 'reset') => {
    if (!username || !/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(username)) {
      setError('请输入正确邮箱格式');
      return;
    }
    try {
      setCodeLoading(true);
      const res = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, type })
      });
      const data = await res.json();
      if (res.ok) {
        setCountdown(60);
        setError(null);
      } else {
        setError(data.error);
      }
    } catch {
      setError('网络异常');
    } finally {
      setCodeLoading(false);
    }
  };

  // 切换模式（无修改）
  const switchMode = (newMode: 'login' | 'register' | 'reset') => {
    setMode(newMode);
    setError(null);
    setUsername('');
    setPassword('');
    setConfirmPwd('');
    setCode('');
  };

  // 🔥 核心修复：表单提交逻辑
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 前置校验，避免无效请求
    if (mode === 'register' && password !== confirmPwd) {
      setError('两次密码不一致');
      return;
    }
    if ((mode === 'register' || mode === 'reset') && !code) {
      setError('验证码不能为空');
      return;
    }
    if (!username || !password) {
      setError('账号和密码不能为空');
      return;
    }

    try {
      setLoading(true); // 开始加载
      let res;

      if (mode === 'login') {
        res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
      } else if (mode === 'register') {
        res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, code })
        });
      } else { // reset模式
        res = await fetch('/api/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: username, code, newPassword: password })
        });
      }

      const data = await res.json();
      if (res.ok) {
        if (mode === 'reset') {
          // 🔥 重置成功后关键操作：清空表单+切换到登录页+提示成功
          setError('密码重置成功，请登录');
          setUsername('');
          setPassword('');
          setCode('');
          setTimeout(() => {
            switchMode('login'); // 延迟切换，让用户看到提示
          }, 1500);
        } else {
          // 登录/注册成功，跳转
          router.replace(searchParams.get('redirect') || '/');
        }
      } else {
        // 服务器返回错误
        setError(data.error || '操作失败，请重试');
      }
    } catch (err: any) {
      // 网络或其他异常
      setError(err.message || '网络异常，请稍后重试');
    } finally {
      // 🔥 关键：无论成功失败，必须重置loading状态
      setLoading(false);
    }
  };

  return (
    <div className='relative min-h-screen flex items-center justify-center px-4 overflow-hidden'>
      <div className='absolute top-4 right-4'><ThemeToggle /></div>
      <div className='relative z-10 w-full max-w-md rounded-3xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl shadow-2xl p-10'>
        <h1 className='text-green-600 text-center text-3xl font-extrabold mb-6'>
          {siteName} {mode === 'login' ? '登录' : mode === 'register' ? '注册' : '找回密码'}
        </h1>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* 唯一输入框：用户名=邮箱 */}
          <input
            className='w-full rounded-lg p-3 bg-white/60 dark:bg-zinc-800/60'
            placeholder='请输入邮箱账号'
            value={username}
            onChange={e => setUsername(e.target.value)}
            disabled={loading} // 加载中禁用输入
          />

          {/* 密码框 */}
          <input
            type='password'
            className='w-full rounded-lg p-3 bg-white/60 dark:bg-zinc-800/60'
            placeholder={mode === 'login' ? '登录密码' : mode === 'register' ? '设置密码' : '新密码'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={loading} // 加载中禁用输入
          />

          {/* 注册确认密码 */}
          {mode === 'register' && (
            <input
              type='password'
              className='w-full rounded-lg p-3 bg-white/60 dark:bg-zinc-800/60'
              placeholder='确认密码'
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              disabled={loading} // 加载中禁用输入
            />
          )}

          {/* 验证码区域 */}
          {(mode === 'register' || mode === 'reset') && (
            <div className='flex gap-2'>
              <input
                className='flex-1 rounded-lg p-3 bg-white/60 dark:bg-zinc-800/60'
                placeholder='填写验证码'
                value={code}
                onChange={e => setCode(e.target.value)}
                disabled={loading || codeLoading} // 加载中禁用输入
              />
              <button
                type='button'
                disabled={codeLoading || countdown > 0 || loading}
                onClick={() => sendCode(mode)}
                className='w-28 bg-green-600 text-white rounded-lg disabled:opacity-50'
              >
                {countdown > 0 ? `${countdown}s` : '发送验证码'}
              </button>
            </div>
          )}

          {error && <p className={`text-sm text-center ${error.includes('成功') ? 'text-green-500' : 'text-red-500'}`}>{error}</p>}

          <button
            type='submit'
            disabled={loading}
            className='w-full bg-green-600 text-white p-3 rounded-lg font-semibold disabled:opacity-50'
          >
            {loading ? '处理中...' : mode === 'login' ? '登录' : mode === 'register' ? '注册' : '重置密码'}
          </button>
        </form>

        <div className='mt-4 text-center text-sm space-x-3'>
          {mode !== 'login' && <button onClick={() => switchMode('login')} disabled={loading} className='text-green-600'>返回登录</button>}
          {mode === 'login' && <button onClick={() => switchMode('register')} disabled={loading} className='text-green-600'>注册账号</button>}
          {mode === 'login' && <button onClick={() => switchMode('reset')} disabled={loading} className='text-green-600'>找回密码</button>}
        </div>
      </div>

    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<div>Loading...</div>}><LoginPageClient /></Suspense>;
}