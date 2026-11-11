import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/api/whatsapp/webhook", "/api/tasks", "/api/health", "/offline"];

/**
 * Barreira inicial: sem cookie de sessão, vai para o login.
 * A validação real (sessão no banco, perfil, usuário ativo) acontece no servidor
 * em cada página/ação via requireUser().
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  if (req.cookies.has("injecar_session")) {
    // repassa o caminho para o servidor (usado para exigir troca de senha provisória)
    const headers = new Headers(req.headers);
    headers.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers } });
  }
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|icons/|manifest.webmanifest|sw.js|offline.html|favicon.ico|robots.txt).*)"],
};
