export { auth as middleware } from "@/src/lib/auth";

export const config = {
  matcher: ["/", "/(management|merchant|billed|unbilled)(.*)", "/api/:path*"],
};
