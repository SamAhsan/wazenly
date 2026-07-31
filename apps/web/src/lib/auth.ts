import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import axios from "axios";

const API_URL = process.env.API_URL || "http://localhost:4000";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const { data } = await axios.post(`${API_URL}/api/auth/login`, {
            email: credentials?.email,
            password: credentials?.password,
          });
          if (data.token) {
            return {
              id: data.user.id,
              email: data.user.email,
              name: data.user.name,
              accessToken: data.token,
              workspaceId: data.workspace?.id,
              role: data.role,
              isSuperAdmin: data.isSuperAdmin,
            };
          }
          return null;
        } catch (err) {
          if (axios.isAxiosError(err) && err.response?.data?.error === "EMAIL_NOT_VERIFIED") {
            throw new Error("EMAIL_NOT_VERIFIED");
          }
          return null;
        }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    // Two-app hybrid: this is App B, used purely for identity (classic OAuth,
    // grants email/public_profile like any normal Facebook Login app). App A
    // (the WhatsApp Tech Provider app, no email scope available on that
    // product) is used separately, post-login, for Embedded Signup only --
    // see /onboarding/connect-whatsapp and POST /api/numbers/connect-embedded-signup.
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? [
          FacebookProvider({
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" && account?.provider !== "facebook") return true;
      try {
        const { data } = await axios.post(
          `${API_URL}/api/auth/oauth`,
          { email: user.email, name: user.name, image: user.image },
          { headers: { "x-internal-secret": process.env.INTERNAL_SERVICE_SECRET } }
        );
        const oauthUser = user as { accessToken?: string; workspaceId?: string; role?: string; isSuperAdmin?: boolean };
        oauthUser.accessToken = data.token;
        oauthUser.workspaceId = data.workspace?.id;
        oauthUser.role = data.role;
        oauthUser.isSuperAdmin = data.isSuperAdmin;
        return true;
      } catch {
        return false;
      }
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as { accessToken?: string; workspaceId?: string; role?: string; isSuperAdmin?: boolean };
        token.accessToken = u.accessToken;
        token.workspaceId = u.workspaceId;
        token.role = u.role;
        token.isSuperAdmin = u.isSuperAdmin;
        token.roleCheckedAt = Date.now();
      }
      // Lets the client push a freshly-issued token after switching companies
      // (see POST /api/workspaces/:id/switch) without a full re-login, or after
      // starting/ending Super Admin impersonation of a company.
      if (trigger === "update" && session) {
        if (session.accessToken !== undefined) token.accessToken = session.accessToken;
        if (session.workspaceId !== undefined) token.workspaceId = session.workspaceId;
        if (session.role !== undefined) token.role = session.role;
        // These four use `null` as an explicit "clear it" signal (distinct
        // from `undefined`, meaning "the caller didn't touch this field") --
        // impersonation exit needs to actually clear them, not just skip.
        if (session.impersonating !== undefined) token.impersonating = session.impersonating;
        if (session.superAdminAccessToken !== undefined) token.superAdminAccessToken = session.superAdminAccessToken;
        if (session.superAdminWorkspaceId !== undefined) token.superAdminWorkspaceId = session.superAdminWorkspaceId;
        if (session.superAdminRole !== undefined) token.superAdminRole = session.superAdminRole;
        token.roleCheckedAt = Date.now();
      }
      // The role is otherwise baked into the JWT at sign-in and never
      // changes again on its own -- so when an admin changes a teammate's
      // role, that teammate's already-issued session kept showing the old
      // one (stale dashboard UI) until they logged out and back in. The API
      // itself always re-checks the live role per request (see requireRole
      // in apps/api), so this was a UI staleness bug, not an authorization
      // hole -- but re-poll here periodically so the dashboard catches up on
      // its own shortly after a role change instead of requiring a re-login.
      // Also picks up isSuperAdmin grant/revoke without a re-login.
      if (!user && trigger !== "update" && token.accessToken && token.workspaceId) {
        const lastChecked = (token.roleCheckedAt as number) || 0;
        if (Date.now() - lastChecked > 30_000) {
          try {
            const { data } = await axios.get(`${API_URL}/api/auth/me`, {
              headers: { Authorization: `Bearer ${token.accessToken}` },
            });
            const ws = data.workspaces?.find((w: { id: string }) => w.id === token.workspaceId);
            if (ws?.role) token.role = ws.role;
            if (typeof data.user?.isSuperAdmin === "boolean") token.isSuperAdmin = data.user.isSuperAdmin;
          } catch {
            // Transient failure -- keep the existing token.role rather than
            // logging the user out over a network blip.
          }
          token.roleCheckedAt = Date.now();
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.workspaceId = token.workspaceId as string;
      session.role = token.role as string;
      session.isSuperAdmin = token.isSuperAdmin as boolean;
      session.impersonating = token.impersonating;
      session.superAdminAccessToken = token.superAdminAccessToken;
      session.superAdminWorkspaceId = token.superAdminWorkspaceId;
      session.superAdminRole = token.superAdminRole;
      return session;
    },
  },
};
