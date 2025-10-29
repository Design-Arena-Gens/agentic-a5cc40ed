"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";

import type { AgentActionResult, AgentLogEntry, AgentRequestPayload } from "@/lib/agent/types";

type ConfigState = {
  listId: string;
  fromName: string;
  replyTo: string;
  defaultPreviewText: string;
  tags: string;
};

type LevelVisual = {
  border: string;
  background: string;
  color: string;
  label: string;
};

const defaultConfig: ConfigState = {
  listId: "",
  fromName: "",
  replyTo: "",
  defaultPreviewText: "",
  tags: ""
};

const examplePrompts = [
  "List campaigns so I can review the pipeline.",
  "Add hannah@orbital.studio to my main newsletter list and tag her as partner.",
  "Create a campaign \"November Product Update\" with body: <p>Announcing our latest features. Include a CTA to the changelog.</p>",
  "Send campaign 9a8b7c to close out the launch sequence.",
  "Settle all pending campaigns and share the results."
];

const levelVisuals: Record<AgentLogEntry["level"], LevelVisual> = {
  info: {
    border: "1px solid rgba(96,165,250,0.28)",
    background: "rgba(37,99,235,0.12)",
    color: "#bfdbfe",
    label: "Info"
  },
  success: {
    border: "1px solid rgba(34,197,94,0.3)",
    background: "rgba(22,163,74,0.15)",
    color: "#bbf7d0",
    label: "Success"
  },
  warning: {
    border: "1px solid rgba(250,204,21,0.3)",
    background: "rgba(202,138,4,0.18)",
    color: "#fef08a",
    label: "Warning"
  },
  error: {
    border: "1px solid rgba(248,113,113,0.3)",
    background: "rgba(220,38,38,0.2)",
    color: "#fecaca",
    label: "Error"
  }
};

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatActionLabel(result: AgentActionResult): string {
  switch (result.action.type) {
    case "addSubscriber":
      return `Subscribe ${result.action.email}`;
    case "createCampaign":
      return `Create ${result.action.subject}`;
    case "sendCampaign":
      return `Send ${result.action.campaignId}`;
    case "listCampaigns":
      return "Campaign overview";
    case "listAudiences":
      return "Audience overview";
    case "settleCampaigns":
      return "Settle pending campaigns";
    default:
      return "Agent action";
  }
}

interface FetchResponsePayload {
  configured: boolean;
  summary: string;
  interpretation: AgentLogEntry[];
  execution: AgentLogEntry[];
  results: AgentActionResult[];
}

export function MailchimpAgent() {
  const [config, setConfig] = useState<ConfigState>(defaultConfig);
  const [instruction, setInstruction] = useState("");
  const [summary, setSummary] = useState<string>("");
  const [interpreterLogs, setInterpreterLogs] = useState<AgentLogEntry[]>([]);
  const [executionLogs, setExecutionLogs] = useState<AgentLogEntry[]>([]);
  const [results, setResults] = useState<AgentActionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    const checkConfiguration = async () => {
      try {
        const response = await fetch("/api/agent", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to verify configuration");
        }
        const data = (await response.json()) as { configured: boolean };
        setConfigured(data.configured);
      } catch (err) {
        setError((err as Error).message ?? "Unable to contact agent endpoint");
      }
    };
    checkConfiguration();
  }, []);

  const configTags = useMemo(() => parseTags(config.tags), [config.tags]);

  const handleConfigChange = (field: keyof ConfigState) => (event: ChangeEvent<HTMLInputElement>) => {
    setConfig((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const payload: AgentRequestPayload = {
      instruction,
      config: {
        listId: config.listId || undefined,
        fromName: config.fromName || undefined,
        replyTo: config.replyTo || undefined,
        defaultPreviewText: config.defaultPreviewText || undefined,
        tags: configTags.length > 0 ? configTags : undefined
      }
    };

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error ?? "Agent request failed");
      }

      const data = (await response.json()) as FetchResponsePayload;
      setConfigured(data.configured);
      setSummary(data.summary);
      setInterpreterLogs(data.interpretation ?? []);
      setExecutionLogs(data.execution ?? []);
      setResults(data.results ?? []);
    } catch (err) {
      setError((err as Error).message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header style={{ marginBottom: "2.75rem" }}>
        <div className="pill" style={{ marginBottom: "1rem" }}>
          Mailchimp Automation Agent
        </div>
        <h1 style={{ fontSize: "2.75rem", margin: 0, fontWeight: 700 }}>Command Center for Your Email Operations</h1>
        <p style={{ maxWidth: "720px", marginTop: "1.1rem", fontSize: "1.1rem", lineHeight: 1.75, color: "rgba(226,232,240,0.8)" }}>
          Give the agent natural language directives and it will interpret, plan, and execute the necessary Mailchimp API tasks.
          Configure your defaults, triage pending campaigns, add subscribers, and settle entire launch sequences with one command.
        </p>
        {configured === false && (
          <div
            className="card"
            style={{
              marginTop: "1.5rem",
              border: "1px solid rgba(248,113,113,0.35)",
              background: "rgba(248,113,113,0.12)",
              color: "#fecaca"
            }}
          >
            <h3 style={{ marginTop: 0, color: "#fee2e2" }}>Mailchimp credentials missing</h3>
            <p style={{ marginBottom: 0, lineHeight: 1.6 }}>
              Provide <code>MAILCHIMP_API_KEY</code> and <code>MAILCHIMP_SERVER_PREFIX</code> as environment variables before running production commands.
            </p>
          </div>
        )}
        {error && (
          <div
            className="card"
            style={{
              marginTop: "1.5rem",
              border: "1px solid rgba(248,113,113,0.35)",
              background: "rgba(220,38,38,0.18)",
              color: "#fecaca"
            }}
          >
            <h3 style={{ marginTop: 0 }}>Request error</h3>
            <p style={{ marginBottom: 0 }}>{error}</p>
          </div>
        )}
      </header>

      <form className="grid two-column" onSubmit={handleSubmit}>
        <section className="card" style={{ position: "relative" }}>
          <h3>Operating configuration</h3>
          <p style={{ marginTop: "0.75rem", marginBottom: "1.5rem", color: "rgba(203,213,225,0.75)" }}>
            Defaults applied to every task. Nothing leaves your browser until you hit the <strong>Run agent</strong> button.
          </p>

          <div className="grid" style={{ gap: "1.25rem" }}>
            <div>
              <label className="label" htmlFor="listId">
                Audience List ID
              </label>
              <input
                id="listId"
                className="input"
                placeholder="e.g. a1b2c3d4"
                value={config.listId}
                onChange={handleConfigChange("listId")}
              />
            </div>
            <div>
              <label className="label" htmlFor="fromName">
                From Name
              </label>
              <input
                id="fromName"
                className="input"
                placeholder="Product Team"
                value={config.fromName}
                onChange={handleConfigChange("fromName")}
              />
            </div>
            <div>
              <label className="label" htmlFor="replyTo">
                Reply-To Email
              </label>
              <input
                id="replyTo"
                className="input"
                type="email"
                placeholder="team@company.com"
                value={config.replyTo}
                onChange={handleConfigChange("replyTo")}
              />
            </div>
            <div>
              <label className="label" htmlFor="previewText">
                Preview Text (optional)
              </label>
              <input
                id="previewText"
                className="input"
                placeholder="Automatically set preview copy"
                value={config.defaultPreviewText}
                onChange={handleConfigChange("defaultPreviewText")}
              />
            </div>
            <div>
              <label className="label" htmlFor="tags">
                Tags to apply to new subscribers
              </label>
              <input
                id="tags"
                className="input"
                placeholder="vip, partner, beta"
                value={config.tags}
                onChange={handleConfigChange("tags")}
              />
              {configTags.length > 0 && (
                <div className="tag-input" style={{ marginTop: "0.65rem" }}>
                  {configTags.map((tag) => (
                    <span key={tag} className="tag-pill">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="card" style={{ display: "flex", flexDirection: "column" }}>
          <h3>Instruction</h3>
          <p style={{ marginTop: "0.75rem", marginBottom: "1rem", color: "rgba(203,213,225,0.75)" }}>
            Tell the agent what you need. Mention subscriber emails, campaign IDs, or ask it to settle pending work.
          </p>

          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder={examplePrompts[0]}
            rows={8}
            style={{ resize: "vertical", minHeight: "160px" }}
          />

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem", marginBottom: "1.75rem" }}>
            {examplePrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="button secondary"
                style={{ fontSize: "0.85rem", padding: "0.45rem 1rem" }}
                onClick={() => setInstruction(prompt)}
              >
                {prompt.length > 32 ? `${prompt.slice(0, 32)}…` : prompt}
              </button>
            ))}
          </div>

          <div style={{ marginTop: "auto", display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <button className="button" type="submit" disabled={loading}>
              {loading ? "Running agent…" : "Run agent"}
            </button>
            {summary && (
              <span style={{ color: "rgba(226,232,240,0.7)", fontSize: "0.95rem" }}>{summary}</span>
            )}
          </div>
        </section>
      </form>

      <section className="grid" style={{ marginTop: "2.5rem", gap: "1.5rem" }}>
        <div className="card">
          <h3>Planning timeline</h3>
          {interpreterLogs.length === 0 ? (
            <p style={{ marginBottom: 0, color: "rgba(203,213,225,0.7)" }}>Submit an instruction to inspect the agent’s reasoning steps.</p>
          ) : (
            <div className="timeline" style={{ marginTop: "1.5rem" }}>
              {interpreterLogs.map((log, index) => {
                const visuals = levelVisuals[log.level];
                return (
                  <div key={`${log.title}-${index}`} className="timeline-item" style={{ borderLeftColor: visuals.color }}>
                    <div
                      style={{
                        border: visuals.border,
                        background: visuals.background,
                        color: visuals.color,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        borderRadius: "999px",
                        padding: "0.25rem 0.75rem",
                        fontSize: "0.75rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em"
                      }}
                    >
                      {visuals.label}
                    </div>
                    <h4 className="log-title" style={{ marginTop: "0.65rem" }}>
                      {log.title}
                    </h4>
                    <p className="log-message">{log.message}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Execution output</h3>
          {executionLogs.length === 0 ? (
            <p style={{ marginBottom: 0, color: "rgba(203,213,225,0.7)" }}>Agent logs will appear here after a run.</p>
          ) : (
            <div className="timeline" style={{ marginTop: "1.5rem" }}>
              {executionLogs.map((log, index) => {
                const visuals = levelVisuals[log.level];
                return (
                  <div key={`${log.title}-${index}`} className="timeline-item">
                    <div
                      style={{
                        border: visuals.border,
                        background: visuals.background,
                        color: visuals.color,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        borderRadius: "999px",
                        padding: "0.25rem 0.75rem",
                        fontSize: "0.75rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em"
                      }}
                    >
                      {visuals.label}
                    </div>
                    <h4 className="log-title" style={{ marginTop: "0.65rem" }}>{log.title}</h4>
                    <p className="log-message">{log.message}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {results.length > 0 && (
        <section className="card" style={{ marginTop: "1.5rem" }}>
          <h3>Action ledger</h3>
          <div className="grid" style={{ marginTop: "1.5rem", gap: "1rem" }}>
            {results.map((result, index) => {
              const isSuccess = result.status === "success";
              const hasData = result.data !== undefined && result.data !== null;
              const hasError = result.error !== undefined && result.error !== null;
              return (
                <div
                  key={`${result.action.type}-${index}`}
                  style={{
                    border: isSuccess ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(248,113,113,0.35)",
                    background: isSuccess ? "rgba(22,163,74,0.15)" : "rgba(220,38,38,0.18)",
                    borderRadius: "18px",
                    padding: "1.25rem"
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: "1.05rem" }}>{formatActionLabel(result)}</h4>
                  <p style={{ marginTop: "0.6rem", marginBottom: 0, lineHeight: 1.6 }}>{result.detail}</p>
                  {hasData && (
                    <details style={{ marginTop: "0.75rem" }}>
                      <summary style={{ cursor: "pointer", color: "rgba(226,232,240,0.8)" }}>Raw response</summary>
                      <pre
                        style={{
                          marginTop: "0.7rem",
                          background: "rgba(15,23,42,0.7)",
                          padding: "0.9rem",
                          borderRadius: "12px",
                          overflowX: "auto",
                          fontSize: "0.85rem",
                          lineHeight: 1.5
                        }}
                      >
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  )}
                  {result.status === "error" && hasError && (
                    <details style={{ marginTop: "0.75rem" }}>
                      <summary style={{ cursor: "pointer", color: "#fecaca" }}>Error details</summary>
                      <pre
                        style={{
                          marginTop: "0.7rem",
                          background: "rgba(127,29,29,0.5)",
                          padding: "0.9rem",
                          borderRadius: "12px",
                          overflowX: "auto",
                          fontSize: "0.85rem",
                          lineHeight: 1.5
                        }}
                      >
                        {JSON.stringify(result.error, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export default MailchimpAgent;
