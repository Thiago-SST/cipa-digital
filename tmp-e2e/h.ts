process.env.TSS_SERVER_FN_BASE = "http://localhost:8080/_serverFn/";
const { createClientRpc } = await import("@tanstack/start-client-core/client-rpc");

function b64(o: any) { return Buffer.from(JSON.stringify(o)).toString("base64url").replace(/=+$/,""); }
export function fnId(file: string, name: string) {
  return b64({ file: `/src/lib/${file}?tss-serverfn-split`, export: `${name}_createServerFn_handler` });
}

export function makeJar() {
  const jar = new Map<string,string>();
  const f: typeof fetch = async (url: any, init: any = {}) => {
    const headers = new Headers(init.headers);
    if (jar.size) headers.set("cookie", [...jar].map(([k,v])=>`${k}=${v}`).join("; "));
    const res = await fetch(url, { ...init, headers, redirect: "manual" });
    for (const c of (res.headers as any).getSetCookie?.() ?? []) {
      const [kv] = c.split(";"); const i = kv.indexOf("=");
      jar.set(kv.slice(0,i).trim(), kv.slice(i+1).trim());
    }
    return res;
  };
  return { jar, fetch: f };
}

export function makeCaller(file: string, opts: { token?: string; fetch?: typeof fetch } = {}) {
  return async (name: string, method: "GET"|"POST" = "GET", data?: any) => {
    const rpc: any = createClientRpc(fnId(file, name));
    const headers: any = opts.token ? { Authorization: `Bearer ${opts.token}` } : {};
    try {
      return await rpc({ method, data, headers, fetch: opts.fetch });
    } catch (e: any) {
      return { __error: e?.message ?? String(e) };
    }
  };
}
