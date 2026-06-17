export type KioskLockRequestDecision =
  | { type: "allow" }
  | { type: "redirect"; destination: "/kiosk-rpe" }
  | { type: "block_api"; status: 423 };

const ALLOWED_LOCKED_PAGE_PATHS = ["/kiosk-rpe", "/auth/callback"] as const;
const ALLOWED_LOCKED_API_PATHS = [
  "/api/kiosk-rpe/submit",
  "/api/kiosk-lock/enter",
  "/api/kiosk-lock/exit",
  "/api/health",
] as const;

const PUBLIC_INFRASTRUCTURE_PREFIXES = ["/_next/"] as const;
const PUBLIC_STATIC_FILE_RE =
  /^\/(?:favicon\.ico|manifest\.json|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml))$/i;

function isPathOrDescendant(pathname: string, allowedPath: string): boolean {
  return pathname === allowedPath || pathname.startsWith(`${allowedPath}/`);
}

function isPublicInfrastructurePath(pathname: string): boolean {
  return (
    PUBLIC_INFRASTRUCTURE_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    PUBLIC_STATIC_FILE_RE.test(pathname)
  );
}

function isAllowedLockedPagePath(pathname: string): boolean {
  return ALLOWED_LOCKED_PAGE_PATHS.some((path) => isPathOrDescendant(pathname, path));
}

function isAllowedLockedApiPath(pathname: string): boolean {
  return ALLOWED_LOCKED_API_PATHS.some((path) => isPathOrDescendant(pathname, path));
}

export function getKioskLockRequestDecision(input: {
  pathname: string;
  method: string;
  isAuthenticated: boolean;
  kioskLocked: boolean;
  role?: "admin" | "staff" | "player" | null;
}): KioskLockRequestDecision {
  if (!input.kioskLocked || !input.isAuthenticated) {
    return { type: "allow" };
  }

  if (input.role !== "admin" && input.role !== "staff") {
    return { type: "allow" };
  }

  if (isPublicInfrastructurePath(input.pathname) || isAllowedLockedPagePath(input.pathname)) {
    return { type: "allow" };
  }

  if (input.pathname.startsWith("/api/")) {
    if (isAllowedLockedApiPath(input.pathname)) {
      return { type: "allow" };
    }
    return { type: "block_api", status: 423 };
  }

  return { type: "redirect", destination: "/kiosk-rpe" };
}
