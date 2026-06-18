import { loginAction } from "@/app/login/actions";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};

  return (
    <main className="min-h-screen bg-paper px-6 py-10 text-ink">
      <div className="mx-auto max-w-md">
        <section className="rounded-lg border border-line bg-white p-8">
          <div className="text-sm uppercase tracking-[0.18em] text-bronze">tea chain russia</div>
          <h1 className="mt-2 text-3xl font-semibold">登录</h1>
          {params.error === "invalid" ? (
            <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              账号或密码不正确。
            </div>
          ) : null}
          <form action={loginAction} className="mt-6 space-y-4">
            <div>
              <div className="text-sm font-medium text-black/70">用户名</div>
              <input
                name="username"
                required
                className="mt-2 h-11 w-full rounded-md border border-line bg-white px-4 text-sm outline-none"
                placeholder="请输入用户名"
              />
            </div>
            <div>
              <div className="text-sm font-medium text-black/70">密码</div>
              <input
                name="password"
                type="password"
                required
                className="mt-2 h-11 w-full rounded-md border border-line bg-white px-4 text-sm outline-none"
                placeholder="请输入密码"
              />
            </div>
            <button className="rounded-md bg-ink px-5 py-3 text-sm font-medium text-white">登录系统</button>
          </form>
        </section>
      </div>
    </main>
  );
}
