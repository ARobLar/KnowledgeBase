import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

async function refreshGoogleToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: number;
  refreshToken: string;
} | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    const data = await res.json() as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
    };
    if (!res.ok || !data.access_token) return null;
    return {
      accessToken: data.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
      // Google only returns a new refresh token when it rotates; keep the old one otherwise
      refreshToken: data.refresh_token ?? refreshToken,
    };
  } catch {
    return null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/drive",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // First sign-in: persist all token data into the JWT
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        };
      }

      // Token still valid (60s buffer to avoid using it right as it expires)
      if (token.expiresAt && Date.now() < (token.expiresAt as number) * 1000 - 60_000) {
        return token;
      }

      // Token expired — refresh it
      if (!token.refreshToken) return token;

      const refreshed = await refreshGoogleToken(token.refreshToken as string);
      if (!refreshed) {
        // Refresh failed (revoked token, etc.) — keep stale token so the
        // session stays alive; Drive calls will 401 and the UI will prompt re-auth
        return token;
      }

      return {
        ...token,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: refreshed.expiresAt,
      };
    },
    async session({ session, token }) {
      const s = session as typeof session & { accessToken?: string };
      s.accessToken = token.accessToken as string | undefined;
      return s;
    },
  },
  secret: process.env.AUTH_SECRET,
});
