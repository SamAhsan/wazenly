import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
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
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      try {
        const { data } = await axios.post(
          `${API_URL}/api/auth/oauth`,
          { email: user.email, name: user.name, image: user.image },
          { headers: { "x-internal-secret": process.env.INTERNAL_SERVICE_SECRET } }
        );
        const oauthUser = user as { accessToken?: string; workspaceId?: string; role?: string };
        oauthUser.accessToken = data.token;
        oauthUser.workspaceId = data.workspace?.id;
        oauthUser.role = data.role;
        return true;
      } catch {
        return false;
      }
    },
    async jwt({ token, user }) {
      if (user) {
        const u = user as { accessToken?: string; workspaceId?: string; role?: string };
        token.accessToken = u.accessToken;
        token.workspaceId = u.workspaceId;
        token.role = u.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.workspaceId = token.workspaceId as string;
      session.role = token.role as string;
      return session;
    },
  },
};
