import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const { code, state } = await req.json().catch(() => ({}));

    if (!code || !state) {
      return NextResponse.json(
        { error: "Missing authorization code or state parameter" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const savedState = cookieStore.get("swiggy_oauth_state")?.value;
    const savedVerifier = cookieStore.get("swiggy_oauth_verifier")?.value;

    if (!savedState || !savedVerifier) {
      return NextResponse.json(
        { error: "OAuth session expired or cookies missing" },
        { status: 400 }
      );
    }

    // CSRF mitigation
    if (state !== savedState) {
      return NextResponse.json(
        { error: "Invalid state parameter. Possible CSRF attack detected." },
        { status: 403 }
      );
    }

    const isMock = (process.env.SWIGGY_FOOD_MCP_URL || "").includes("localhost");
    const redirectUri = process.env.SWIGGY_OAUTH_REDIRECT_URI || "http://localhost:3000/oauth/callback";

    // Clear OAuth cookies
    cookieStore.delete("swiggy_oauth_state");
    cookieStore.delete("swiggy_oauth_verifier");

    if (isMock) {
      // Return a simulated token response for local testing
      return NextResponse.json({
        access_token: `mock_oauth_pkce_token_${Date.now()}`,
        token_type: "Bearer",
        expires_in: 432000,
        scope: "mcp:tools mcp:resources mcp:prompts",
      });
    }

    // Call official Swiggy token exchange endpoint
    const response = await fetch("https://mcp.swiggy.com/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        code_verifier: savedVerifier,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Swiggy Token Exchange Error Response]", errorText);
      return NextResponse.json(
        { error: `Token exchange failed: ${errorText || response.statusText}` },
        { status: response.status }
      );
    }

    const tokens = await response.json();
    return NextResponse.json(tokens);
  } catch (error: any) {
    console.error("[Token exchange handler error]", error);
    return NextResponse.json(
      { error: "Internal Server Error during token exchange" },
      { status: 500 }
    );
  }
}
