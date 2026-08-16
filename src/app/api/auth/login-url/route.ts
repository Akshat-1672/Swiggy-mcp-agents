import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  try {
    const isMock = (process.env.SWIGGY_FOOD_MCP_URL || "").includes("localhost");
    const clientId = process.env.SWIGGY_OAUTH_CLIENT_ID || "antigravity_mock_client_id";
    const redirectUri = process.env.SWIGGY_OAUTH_REDIRECT_URI || "http://localhost:3000/oauth/callback";

    // 1. Generate PKCE verifier + challenge
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    // 2. Generate random state to protect against CSRF
    const state = crypto.randomBytes(16).toString("hex");

    // 3. Save to secure HTTP-only cookies
    const cookieStore = await cookies();
    const isProd = process.env.NODE_ENV === "production";

    cookieStore.set("swiggy_oauth_verifier", codeVerifier, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 300, // 5 minutes
      path: "/",
    });

    cookieStore.set("swiggy_oauth_state", state, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 300,
      path: "/",
    });

    // 4. Construct appropriate Authorize URL
    let authorizeUrl = "";
    if (isMock) {
      // Route to local mock login interface
      authorizeUrl = `/oauth/mock-login?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&code_challenge=${codeChallenge}&code_challenge_method=S256&state=${state}&scope=mcp:tools`;
    } else {
      // Route to official Swiggy OAuth provider
      authorizeUrl = `https://mcp.swiggy.com/auth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&code_challenge=${codeChallenge}&code_challenge_method=S256&state=${state}&scope=mcp:tools`;
    }

    return NextResponse.json({ url: authorizeUrl });
  } catch (error: any) {
    console.error("[Login URL generation error]", error);
    return NextResponse.json(
      { error: "Failed to generate authorization URL" },
      { status: 500 }
    );
  }
}
