"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function MockLoginContent() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get("client_id") || "unknown";
  const redirectUri = searchParams.get("redirect_uri");
  const state = searchParams.get("state") || "";
  const scope = searchParams.get("scope") || "mcp:tools";

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setErrorMessage("Please enter a valid 10-digit phone number");
      return;
    }
    setErrorMessage("");
    setIsSending(true);

    setTimeout(() => {
      setIsSending(false);
      setStep("otp");
    }, 1200);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp !== "123456") {
      setErrorMessage("Invalid OTP. Use test OTP: 123456");
      return;
    }
    setErrorMessage("");
    setIsVerifying(true);

    setTimeout(() => {
      completeAuth();
    }, 1000);
  };

  const handleBypass = () => {
    setPhone("9876543210");
    setOtp("123456");
    completeAuth();
  };

  const completeAuth = () => {
    if (!redirectUri) {
      setErrorMessage("Error: Missing redirect_uri in Swiggy authorization parameters.");
      setIsVerifying(false);
      return;
    }

    const mockCode = `mock_auth_code_${Math.random().toString(36).substring(2, 10)}`;
    const finalRedirectUrl = `${redirectUri}?code=${mockCode}&state=${encodeURIComponent(state)}`;
    window.location.href = finalRedirectUrl;
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoBadge}>Swiggy</div>
          <h2 style={styles.title}>Builders Club Login</h2>
          <p style={styles.subtitle}>Simulated Authorize consent screen for local staging</p>
        </div>

        <div style={styles.clientBadge}>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Application <strong>{clientId}</strong> is requesting access to:
          </p>
          <div style={styles.scopesList}>
            {scope.split(" ").map((s) => (
              <span key={s} style={styles.scopeTag}>
                {s}
              </span>
            ))}
          </div>
        </div>

        {errorMessage && <div style={styles.errorAlert}>{errorMessage}</div>}

        {step === "phone" ? (
          <form onSubmit={handleSendOtp} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Enter Phone Number</label>
              <div style={styles.phoneInputWrapper}>
                <span style={styles.countryCode}>+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  placeholder="99999 99999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  style={styles.phoneInput}
                  required
                />
              </div>
            </div>

            <button type="submit" disabled={isSending} style={styles.btnPrimary}>
              {isSending ? "Sending OTP..." : "Get OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Enter 6-Digit OTP</label>
              <input
                type="text"
                maxLength={6}
                placeholder="------"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                style={styles.otpInput}
                required
              />
              <p style={styles.tipText}>
                Use test code: <strong>123456</strong>
              </p>
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setStep("phone")}
                style={styles.btnSecondary}
              >
                Back
              </button>
              <button type="submit" disabled={isVerifying} style={styles.btnPrimary}>
                {isVerifying ? "Verifying..." : "Verify & Authorize"}
              </button>
            </div>
          </form>
        )}

        <div style={styles.divider}>
          <span style={styles.dividerText}>Developer Tools</span>
        </div>

        <button type="button" onClick={handleBypass} style={styles.btnBypass}>
          ⚡ Fast-Track Mock Auth
        </button>
      </div>
    </div>
  );
}

export default function MockLoginPage() {
  return (
    <Suspense fallback={<div style={styles.loadingContainer}>Loading OAuth parameters...</div>}>
      <MockLoginContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "radial-gradient(circle at 50% 50%, #1c1d30 0%, #090a0f 100%)",
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
    maxWidth: "420px",
    background: "rgba(255, 255, 255, 0.03)",
    backdropFilter: "blur(20px)",
    borderRadius: "16px",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    boxShadow: "0 24px 60px rgba(0, 0, 0, 0.5)",
    padding: "2rem",
    color: "#f3f4f6",
  },
  header: {
    textAlign: "center",
    marginBottom: "1.5rem",
  },
  logoBadge: {
    display: "inline-block",
    background: "linear-gradient(135deg, #fc8019 0%, #e65c00 100%)",
    color: "#fff",
    fontSize: "0.85rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    padding: "0.35rem 0.85rem",
    borderRadius: "20px",
    marginBottom: "0.75rem",
    boxShadow: "0 4px 10px rgba(252, 128, 25, 0.3)",
  },
  title: {
    fontSize: "1.4rem",
    fontWeight: 600,
    color: "#fff",
    margin: "0 0 0.25rem 0",
  },
  subtitle: {
    fontSize: "0.8rem",
    color: "#9ca3af",
    margin: 0,
  },
  clientBadge: {
    background: "rgba(255, 255, 255, 0.02)",
    border: "1px solid rgba(255, 255, 255, 0.05)",
    borderRadius: "8px",
    padding: "0.75rem 1rem",
    marginBottom: "1.5rem",
  },
  scopesList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.4rem",
    marginTop: "0.5rem",
  },
  scopeTag: {
    fontSize: "0.75rem",
    color: "hsl(171, 75%, 45%)",
    background: "hsla(171, 75%, 45%, 0.12)",
    padding: "0.15rem 0.5rem",
    borderRadius: "4px",
    fontFamily: "monospace",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  label: {
    fontSize: "0.85rem",
    color: "#9ca3af",
    fontWeight: 500,
  },
  phoneInputWrapper: {
    display: "flex",
    alignItems: "center",
    background: "rgba(0, 0, 0, 0.25)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "8px",
    overflow: "hidden",
  },
  countryCode: {
    padding: "0.75rem 1rem",
    background: "rgba(255, 255, 255, 0.02)",
    color: "#9ca3af",
    borderRight: "1px solid rgba(255, 255, 255, 0.08)",
    fontSize: "0.95rem",
    fontWeight: 500,
  },
  phoneInput: {
    flex: 1,
    padding: "0.75rem 1rem",
    background: "transparent",
    border: "none",
    color: "#fff",
    fontSize: "1rem",
    outline: "none",
    letterSpacing: "0.05em",
  },
  otpInput: {
    width: "100%",
    padding: "0.75rem 1rem",
    background: "rgba(0, 0, 0, 0.25)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "1.25rem",
    textAlign: "center",
    outline: "none",
    letterSpacing: "0.5em",
  },
  tipText: {
    fontSize: "0.75rem",
    color: "#9ca3af",
    marginTop: "0.25rem",
    textAlign: "center",
  },
  errorAlert: {
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    color: "#f87171",
    fontSize: "0.85rem",
    borderRadius: "8px",
    padding: "0.75rem 1rem",
    marginBottom: "1.25rem",
  },
  btnPrimary: {
    flex: 1,
    padding: "0.85rem",
    background: "linear-gradient(135deg, #fc8019 0%, #e65c00 100%)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 15px rgba(252, 128, 25, 0.25)",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
  btnSecondary: {
    padding: "0.85rem 1.25rem",
    background: "rgba(255, 255, 255, 0.05)",
    color: "#9ca3af",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "8px",
    fontSize: "0.95rem",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    margin: "1.5rem 0",
  },
  dividerText: {
    fontSize: "0.75rem",
    color: "#4b5563",
    padding: "0 0.5rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  btnBypass: {
    width: "100%",
    padding: "0.75rem",
    background: "rgba(255, 255, 255, 0.03)",
    color: "hsl(171, 75%, 45%)",
    border: "1px solid hsla(171, 75%, 45%, 0.2)",
    borderRadius: "8px",
    fontSize: "0.85rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.2s, border-color 0.2s",
  },
};
