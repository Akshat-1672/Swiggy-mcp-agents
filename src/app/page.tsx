"use client";

import { useState, useEffect } from "react";

interface MealOption {
  type: "cook" | "delivery" | "dineout";
  title: string;
  subText: string;
  cost: number;
  timeMinutes: number;
  deepLinkUrl: string;
  confidence?: "high" | "low";
}

interface SystemError {
  node: string;
  message: string;
  recoverable: boolean;
}

type NodeState = "idle" | "active" | "success" | "error";

export default function Home() {
  // Input states
  const [prompt, setPrompt] = useState("Find me a low carb salad option for under ₹500");
  const [lat, setLat] = useState(12.9716); // Bangalore lat
  const [lng, setLng] = useState(77.5946); // Bangalore lng
  const [token, setToken] = useState("");
  const [budgetCap, setBudgetCap] = useState<number>(500);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Load token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("swiggy_oauth_token");
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  const handleConnectSwiggy = async () => {
    setIsLoggingIn(true);
    setStreamError("");
    try {
      const res = await fetch("/api/auth/login-url");
      if (!res.ok) throw new Error("Failed to fetch authorization URL");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No URL returned from authorization handler");
      }
    } catch (err: any) {
      console.error(err);
      setStreamError(err.message || "Failed to initiate Swiggy OAuth login");
      setIsLoggingIn(false);
    }
  };

  const handleDisconnectSwiggy = () => {
    localStorage.removeItem("swiggy_oauth_token");
    setToken("");
  };

  // Execution states
  const [isExecuting, setIsExecuting] = useState(false);
  const [quotes, setQuotes] = useState<MealOption[]>([]);
  const [errors, setErrors] = useState<SystemError[]>([]);
  const [synthesizedText, setSynthesizedText] = useState("");
  const [streamError, setStreamError] = useState("");

  // Graph visualizer node states
  const [nodeStates, setNodeStates] = useState<Record<string, NodeState>>({
    router: "idle",
    cook_node: "idle",
    delivery_node: "idle",
    dineout_node: "idle",
    synthesizer: "idle",
  });

  const handleStartOptimization = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExecuting(true);
    setQuotes([]);
    setErrors([]);
    setSynthesizedText("");
    setStreamError("");

    // Set initial node states
    setNodeStates({
      router: "active",
      cook_node: "idle",
      delivery_node: "idle",
      dineout_node: "idle",
      synthesizer: "idle",
    });

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          location: { lat, lng },
          token,
          budgetCap: budgetCap || undefined,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! Status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("ReadableStream is not supported by this browser.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Move router from active to success once response starts flowing
      setNodeStates((prev) => ({ ...prev, router: "success" }));

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;

            const data = JSON.parse(dataStr);

            // Handle stream-level error
            if (data.error) {
              setStreamError(data.error);
              setIsExecuting(false);
              return;
            }

            const { node, stateUpdate } = data;

            // Update graph node execution visual state
            setNodeStates((prev) => {
              const updated = { ...prev };
              
              // Set the finished node to success (or error if errors are present)
              if (node) {
                const nodeHasError = stateUpdate.errors && stateUpdate.errors.some((e: any) => e.node === node);
                updated[node] = nodeHasError ? "error" : "success";
              }

              // Set active markers for nodes executing in next step
              if (node === "router") {
                // Determine which nodes router dispatched to
                const targets = stateUpdate.messages ? ["cook_node", "delivery_node", "dineout_node"] : [];
                targets.forEach((t) => {
                  updated[t] = "active";
                });
              } else if (node === "cook_node" || node === "delivery_node" || node === "dineout_node") {
                // If any worker completed, check if other workers are still idle
                // and put synthesizer to active if we are moving to next step
                updated.synthesizer = "active";
              }

              return updated;
            });

            // Accumulate quotes
            if (stateUpdate.quotes && stateUpdate.quotes.length > 0) {
              setQuotes((prev) => {
                // Avoid duplicates by comparing title and type
                const filtered = stateUpdate.quotes.filter(
                  (newQ: MealOption) => !prev.some((oldQ) => oldQ.type === newQ.type && oldQ.title === newQ.title)
                );
                return [...prev, ...filtered];
              });
            }

            // Accumulate errors
            if (stateUpdate.errors && stateUpdate.errors.length > 0) {
              setErrors((prev) => {
                const filtered = stateUpdate.errors.filter(
                  (newE: SystemError) => !prev.some((oldE) => oldE.node === newE.node)
                );
                return [...prev, ...filtered];
              });
            }

            // Synthesizer compiled text
            if (node === "synthesizer" && stateUpdate.messages?.[0]?.content) {
              setSynthesizedText(stateUpdate.messages[0].content);
              setNodeStates((prev) => ({ ...prev, synthesizer: "success" }));
            }
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setStreamError(err.message || "Failed to establish stream connection");
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar controls */}
      <aside className="glass-panel settings-section">
        <h2 style={{ fontSize: "1.3rem", color: "#fff", marginBottom: "0.25rem" }}>Optimization Panel</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginBottom: "1.5rem" }}>
          Configure user parameters and mock API options.
        </p>

        <form onSubmit={handleStartOptimization}>
          <div className="input-group" style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
              Swiggy MCP Connection
            </label>
            {token ? (
              <div style={{
                background: "rgba(16, 185, 129, 0.05)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                borderRadius: "8px",
                padding: "0.75rem 1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
                  <span style={{ fontSize: "0.85rem", color: "#10b981", fontWeight: 600 }}>Connected</span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Token: {token.substring(0, 8)}...{token.substring(token.length - 8)}
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectSwiggy}
                  style={{
                    marginTop: "0.25rem",
                    padding: "0.4rem 0.75rem",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    borderRadius: "6px",
                    color: "#f87171",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "background 0.2s"
                  }}
                >
                  Disconnect Session
                </button>
              </div>
            ) : (
              <div style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--panel-border)",
                borderRadius: "8px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem"
              }}>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                  Authenticate to connect to Food, Instamart, and Dineout MCP servers.
                </p>
                <button
                  type="button"
                  onClick={handleConnectSwiggy}
                  disabled={isLoggingIn}
                  className="btn-primary"
                  style={{
                    padding: "0.6rem",
                    fontSize: "0.85rem",
                    background: "linear-gradient(135deg, #fc8019 0%, #e65c00 100%)",
                    boxShadow: "0 4px 12px rgba(252, 128, 25, 0.2)"
                  }}
                >
                  {isLoggingIn ? "Redirecting..." : "Connect Swiggy"}
                </button>
              </div>
            )}
          </div>

          <div className="input-group">
            <label>Location Coordinates (Lat / Lng)</label>
            <div className="coordinate-inputs">
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(Number(e.target.value))}
                placeholder="Lat"
                required
              />
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(Number(e.target.value))}
                placeholder="Lng"
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Max Budget Cap (₹ INR)</label>
            <input
              type="number"
              value={budgetCap || ""}
              onChange={(e) => setBudgetCap(Number(e.target.value))}
              placeholder="e.g. 500"
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={isExecuting || !token}
            style={{
              opacity: !token ? 0.6 : 1,
              cursor: !token ? "not-allowed" : "pointer"
            }}
          >
            {isExecuting ? (
              <>
                <span className="pulsing-dot"></span>
                Running Agents...
              </>
            ) : !token ? (
              <>Connect Account First</>
            ) : (
              <>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.904-4.477L21 9l-4.477-8.904L9.813 15.904z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 21l-3.462-1.938L3.6 15.6M9.813 15.904L9 21M9.813 15.904L3.6 15.6M9 21L3.6 15.6" />
                </svg>
                Optimize Meal
              </>
            )}
          </button>
        </form>
      </aside>

      {/* Main Content Area */}
      <main className="chat-section">
        <header>
          <h1 className="title-glow">Multi-Agent Meal Optimization Engine</h1>
          <p className="subtitle">
            Parallel orchestration evaluating Cooking, Delivery, and Dine-out side-by-side using Swiggy MCP Serverless Layers.
          </p>
        </header>

        {/* Input Text Box */}
        <div className="glass-panel">
          <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.5rem", fontWeight: 500 }}>
            What would you like to eat today?
          </label>
          <textarea
            className="prompt-textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isExecuting}
            placeholder="e.g., Low carb, high protein meal for under ₹400"
          />
        </div>

        {/* Real-time Graph Visualizer */}
        <div className="glass-panel" style={{ padding: "1.25rem 1.75rem" }}>
          <h3 style={{ fontSize: "0.95rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
            Stateful LangGraph Orchestrator Stream
          </h3>
          
          <div className="graph-visualizer">
            {/* Start Node */}
            <div className="visual-node node-success">
              <div className="node-dot">▶</div>
              <span className="node-label">START</span>
            </div>

            {/* Router Node */}
            <div className={`visual-node node-${nodeStates.router}`}>
              <div className="node-dot">⌥</div>
              <span className="node-label">Router</span>
            </div>

            {/* Cook Branch */}
            <div className={`visual-node node-${nodeStates.cook_node}`}>
              <div className="node-dot">🍳</div>
              <span className="node-label">Cook Node</span>
            </div>

            {/* Delivery Branch */}
            <div className={`visual-node node-${nodeStates.delivery_node}`}>
              <div className="node-dot">🚴</div>
              <span className="node-label">Delivery Node</span>
            </div>

            {/* Dineout Branch */}
            <div className={`visual-node node-${nodeStates.dineout_node}`}>
              <div className="node-dot">🍽</div>
              <span className="node-label">Dineout Node</span>
            </div>

            {/* Synthesizer Node */}
            <div className={`visual-node node-${nodeStates.synthesizer}`}>
              <div className="node-dot">Σ</div>
              <span className="node-label">Synthesizer</span>
            </div>
          </div>
        </div>

        {/* Error notifications */}
        {(streamError || errors.length > 0) && (
          <div className="glass-panel" style={{ borderColor: "#ef4444", background: "rgba(239,68,68,0.02)" }}>
            <h4 style={{ color: "#ef4444", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Execution Error
            </h4>
            {streamError && <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>{streamError}</p>}
            {errors.map((e, idx) => (
              <p key={idx} style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
                <strong>{e.node}:</strong> {e.message}
              </p>
            ))}
          </div>
        )}

        {/* Synthesized Matrix Comparison */}
        {quotes.length > 0 && (
          <section className="glass-panel matrix-container">
            <h3 style={{ fontSize: "1.1rem", color: "#fff", marginBottom: "1rem" }}>
              Synthesized Comparison Matrix
            </h3>

            <div style={{ overflowX: "auto" }}>
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th>Modality</th>
                    <th>Option / Details</th>
                    <th>Cost (INR)</th>
                    <th>Time (Mins)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q, idx) => (
                    <tr key={idx} className={`matrix-row-${q.type}`}>
                      <td>
                        <span className={`modality-badge badge-${q.type}`}>
                          {q.type}
                        </span>
                      </td>
                      <td>
                        <div className="cell-primary">{q.title}</div>
                        <div className="cell-secondary">{q.subText}</div>
                      </td>
                      <td>
                        <div className="cell-primary">₹{q.cost}</div>
                      </td>
                      <td>
                        <div className="cell-primary">{q.timeMinutes} mins</div>
                      </td>
                      <td>
                        <a
                          href={q.deepLinkUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="deep-link-btn"
                        >
                          Checkout
                          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Markdown Synthesizer Summary */}
        {synthesizedText && (
          <section className="glass-panel">
            <h3 style={{ fontSize: "1.1rem", color: "#fff", marginBottom: "1rem" }}>
              Orchestrator Recommendations
            </h3>
            <div 
              className="synth-output-md"
              style={{ whiteSpace: "pre-wrap" }}
              dangerouslySetInnerHTML={{
                __html: formatMarkdown(synthesizedText)
              }}
            />
          </section>
        )}
      </main>
    </div>
  );
}

// Simple markdown-to-html helper to format the synthesizer recommendation text
function formatMarkdown(text: string): string {
  let html = text;
  
  // Bold formatting
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  
  // Omitted note formatting (italics)
  html = html.replace(/_(.*?)_/g, "<em>$1</em>");
  
  // Lists
  html = html.replace(/^\s*-\s+(.*?)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)/, "<ul>$1</ul>");
  
  // Links
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="deep-link-btn" style="margin-left:5px">$1</a>');

  return html;
}
