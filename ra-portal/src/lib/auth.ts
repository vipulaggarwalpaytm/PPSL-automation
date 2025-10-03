import NextAuth, { type NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getUserHodByEmail } from "@/src/lib/googleSheets";

export const authConfig: NextAuthConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async session({ session }) {
      const email = session.user?.email;
      if (email) {
        try {
          const hod = await getUserHodByEmail(email);
          (session as any).hod = hod;
        } catch (e) {
          (session as any).hod = null;
        }
      }
      return session;
    },
    async signIn({ profile }) {
      // Allow any Google account; HOD gating done on data fetch
      return !!profile?.email;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export const { handlers, auth } = NextAuth(authConfig);
