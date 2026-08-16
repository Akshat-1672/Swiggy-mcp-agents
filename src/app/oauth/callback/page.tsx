"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function CallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      setStatus("error");
      setErrorMessage("Missing authorization code or state from OAuth provider.");
      return;
    }

    async function exchangeToken() {
      try {
        const response = await fetch("/api/auth/callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code, state }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to exchange token.");
        }

        const data = await response.json();
        if (data.access_token) {
          localStorage.setItem("swiggy_oauth_token", data.access_token);
          setStatus("success");
          setTimeout(() => {
            window.location.href = "/";
          }, 800);
        } else {
          throw new Error("No access token returned from Swiggy server.");
        }
      } catch (err: any) {
        console.error("[Token Exchange Error]", err);
        setStatus("error");
        setErrorMessage(err.message || "An unexpected error occurred during authorization.");
      }
    }

    exchangeToken();
  }, [searchParams]);

  if (status === "error") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.errorIcon}>⚠️</div>
          <h2 style={styles.title}>Connection Failed</h2>
          <p style={styles.subtitle}>{errorMessage}</p>
          <button onClick={() => (window.location.href = "/")} style={styles.btnPrimary}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}} />
      <div style={styles.card}>
        {status === "loading" ? (
          <>
            <div style={styles.spinner} />
            <h2 style={styles.title}>Securing Connection</h2>
            <p style={styles.subtitle}>Exchanging codes and establishing secure MCP layer...</p>
          </>
        ) : (
          <>
            <div style={styles.successIcon}>✓</div>
            <h2 style={styles.title}>Connection Successful</h2>
            <p style={styles.subtitle}>Redirecting to optimization dashboard...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div style={styles.loadingContainer}>Initializing OAuth Callback...</div>}>
      <CallbackContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "radial-gradient(circle at 50% 50%, #161726 0%, #090a0f 100%)",
    padding: "1rem",
    fontFamily: "'Inter', sans-serif",
  },
  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#9ca3af",
    fontSize: "1.1rem",
    background: "#090a0f",
  },
  card: {
    width: "100%",
    maxWidth: "400px",
    background: "rgba(255, 255, 255, 0.03)",
    backdropFilter: "blur(20px)",
    borderRadius: "16px",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    boxShadow: "0 24px 60px rgba(0, 0, 0, 0.5)",
    padding: "2.5rem 2rem",
    textAlign: "center",
    color: "#f3f4f6",
  },
  title: {
    fontSize: "1.3rem",
    fontWeight: 600,
    color: "#fff",
    margin: "1rem 0 0.5rem 0",
  },
  subtitle: {
    fontSize: "0.85rem",
    color: "#9ca3af",
    lineHeight: "1.5",
    margin: "0 0 1.5rem 0",
  },
  spinner: {
    display: "inline-block",
    width: "40px",
    height: "40px",
    border: "3px solid rgba(124, 58, 237, 0.1)",
    borderTopColor: "hsl(263, 85%, 65%)",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  errorIcon: {
    fontSize: "3rem",
    color: "#ef4444",
    lineHeight: "1",
  },
  successIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "rgba(16, 185, 129, 0.15)",
    border: "2px solid #10b981",
    color: "#10b981",
    fontSize: "1.5rem",
    fontWeight: "bold",
    margin: "0 auto",
  },
  btnPrimary: {
    width: "100%",
    padding: "0.85rem",
    background: "linear-gradient(135deg, hsl(263, 85%, 65%) 0%, #7c3aed 100%)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 15px rgba(124, 58, 237, 0.3)",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
};
