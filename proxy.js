import { convexAuthNextjsMiddleware, createRouteMatcher, nextjsMiddlewareRedirect } from "@convex-dev/auth/nextjs/server";

// Pages publiques ; tout le reste exige une session. (Les données restent protégées côté Convex :
// cette redirection n'est qu'un confort, jamais la protection des données.)
const isPublic = createRouteMatcher(["/", "/Connexion", "/inscription"]);
const isAuthPage = createRouteMatcher(["/Connexion", "/inscription"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const authenticated = await convexAuth.isAuthenticated();
  if (!isPublic(request) && !authenticated) return nextjsMiddlewareRedirect(request, "/Connexion");
  if (isAuthPage(request) && authenticated) return nextjsMiddlewareRedirect(request, "/dashboard");
});

export const config = { matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"] };
