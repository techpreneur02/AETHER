"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const ACCESS_TOKEN_KEY = "aether_access_token";

function tokenIsCurrent(token: string): boolean {
  try {
    const encodedPayload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = encodedPayload.padEnd(
      encodedPayload.length + ((4 - encodedPayload.length % 4) % 4),
      "=",
    );
    const payload = JSON.parse(
      window.atob(paddedPayload),
    ) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute = pathname === "/login";
  const [authorized, setAuthorized] = useState(isPublicRoute);

  useEffect(() => {
    if (isPublicRoute) {
      setAuthorized(true);
      return;
    }

    const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token || !tokenIsCurrent(token)) {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      window.location.replace("/login?reason=session-expired");
      return;
    }

    setAuthorized(true);

    function handleRejectedRequest(event: PromiseRejectionEvent) {
      if (event.reason instanceof Error && event.reason.message === "AUTH_REQUIRED") {
        event.preventDefault();
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
        window.location.replace("/login?reason=session-expired");
      }
    }

    window.addEventListener("unhandledrejection", handleRejectedRequest);
    return () => window.removeEventListener("unhandledrejection", handleRejectedRequest);
  }, [isPublicRoute]);

  if (!authorized) return null;
  return children;
}