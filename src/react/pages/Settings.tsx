import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Building2,
  Database,
  Download,
  FileText,
  Save,
  ShieldCheck,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, jsonBody } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
} from "../components/ui";

interface SettingRow {
  key: string;
  value: unknown;
}
interface EngineRules {
  panelMarginPercent: number;
  inverterOversizePercent: number;
  batteryDodPercent: number;
  inverterEfficiencyPercent: number;
  batteryReservePercent: number;
  defaultRoofType: string;
  boqRules: Array<{
    key: string;
    label: string;
    basis: string;
    multiplier: number;
    priceMode: string;
    unitPrice?: number;
    enabled?: boolean;
  }>;
}
const defaults: Record<string, unknown> = {
  companyName: "Skyland Energy (Pvt.) Ltd",
  companyAddress: "286 H-1, Johar Town, Lahore, Pakistan",
  companyPhone: "",
  companyWebsite: "https://www.theskylandenergy.com",
  companyTagline: "Your Energy Management Company",
  companyAccreditation: "AEDB & PEC Approved",
  validityDays: 5,
  advancePercent: 20,
  exchangeRate: 285,
  defaultTerms: "",
  approvalThreshold: 1000000,
  followUpDays: 3,
  emailNotifications: true,
  approvalNotifications: true,
};

export default function Settings() {
  const { user, hasPermission } = useAuth();
  const administrator = ["super_admin", "admin"].includes(user?.role || "");
  const canManageEngine = hasPermission("auto_quote_rules_manage");
  const [section, setSection] = useState(
    administrator ? "company" : "quotation",
  );
  const [values, setValues] = useState(defaults);
  const [saved, setSaved] = useState(defaults);
  const { notify } = useToast();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<SettingRow[]>("/settings"),
  });
  const rulesQuery = useQuery({
    queryKey: ["auto-quote-rules"],
    queryFn: () => api<EngineRules>("/quotation-engine/rules"),
    enabled: canManageEngine,
  });
  const [rules, setRules] = useState<EngineRules | null>(null);
  const [savedRules, setSavedRules] = useState<EngineRules | null>(null);
  useEffect(() => {
    if (rulesQuery.data) {
      setRules(rulesQuery.data);
      setSavedRules(rulesQuery.data);
    }
  }, [rulesQuery.data]);
  useEffect(() => {
    if (!query.data) return;
    const loaded = {
      ...defaults,
      ...Object.fromEntries(query.data.map((row) => [row.key, row.value])),
    };
    setValues(loaded);
    setSaved(loaded);
  }, [query.data]);
  const changed = useMemo(
    () =>
      Object.keys(values).filter(
        (key) => JSON.stringify(values[key]) !== JSON.stringify(saved[key]),
      ),
    [values, saved],
  );
  const rulesChanged = Boolean(
    rules && savedRules && JSON.stringify(rules) !== JSON.stringify(savedRules),
  );
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (changed.length || rulesChanged) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed.length, rulesChanged]);
  const save = useMutation({
    mutationFn: async () => {
      for (const key of changed)
        await api("/settings", {
          method: "POST",
          ...jsonBody({ key, value: values[key] }),
        });
      if (rulesChanged && rules)
        await api("/quotation-engine/rules", {
          method: "PUT",
          ...jsonBody(rules),
        });
    },
    onSuccess: () => {
      setSaved(values);
      if (rules) setSavedRules(rules);
      client.invalidateQueries({ queryKey: ["settings"] });
      client.invalidateQueries({ queryKey: ["auto-quote-rules"] });
      notify("Settings saved", "success");
    },
    onError: (error) => notify(error.message, "error"),
  });
  function setEngine(key: keyof EngineRules, value: unknown) {
    setRules((current) => (current ? { ...current, [key]: value } : current));
  }
  function set(key: string, value: unknown) {
    setValues((current) => ({ ...current, [key]: value }));
  }
  async function exportData() {
    try {
      const [products, customers, quotations, settings] = await Promise.all([
        api("/products"),
        api("/customers"),
        api("/quotations"),
        api("/settings"),
      ]);
      const blob = new Blob(
        [
          JSON.stringify(
            {
              products,
              customers,
              quotations,
              settings,
              exportedAt: new Date().toISOString(),
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `skyland-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      notify("Data export prepared", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Export failed", "error");
    }
  }
  const nav = administrator
    ? [
        { id: "company", label: "Company", icon: Building2 },
        { id: "quotation", label: "Quotation defaults", icon: FileText },
        ...(canManageEngine
          ? [{ id: "automatic", label: "Automatic design", icon: WandSparkles }]
          : []),
        { id: "security", label: "Security", icon: ShieldCheck },
        { id: "notifications", label: "Notifications", icon: Bell },
        { id: "data", label: "Data", icon: Database },
      ]
    : [{ id: "quotation", label: "Quotation defaults", icon: FileText }];
  if (query.isLoading) return <LoadingState label="Loading settings" />;
  if (query.error)
    return <ErrorState error={query.error} retry={() => query.refetch()} />;
  return (
    <div className="page">
      <PageHeader
        title="Settings"
        description="Company identity, quotation defaults, security, notifications, and data."
        actions={
          <Button
            onClick={() => save.mutate()}
            disabled={(!changed.length && !rulesChanged) || save.isPending}
          >
            <Save />
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        }
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={section === id ? "active" : ""}
              onClick={() => setSection(id)}
            >
              <Icon />
              <span>{label}</span>
              {(id === "automatic"
                ? rulesChanged
                : changed.some((key) =>
                    (
                      ({
                        company: [
                          "companyName",
                          "companyAddress",
                          "companyPhone",
                          "companyWebsite",
                          "companyTagline",
                          "companyAccreditation",
                        ],
                        quotation: [
                          "validityDays",
                          "advancePercent",
                          "exchangeRate",
                          "defaultTerms",
                          "approvalThreshold",
                          "followUpDays",
                        ],
                        notifications: [
                          "emailNotifications",
                          "approvalNotifications",
                        ],
                      })[id] || []
                    ).includes(key),
                  )) && <i />}
            </button>
          ))}
        </nav>
        <div className="settings-content">
          {section === "company" && (
            <Card className="settings-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Brand identity</span>
                  <h2>Company information</h2>
                  <p>
                    Used in proposal headers, footers, and customer
                    communication.
                  </p>
                </div>
              </div>
              <div className="form-grid">
                {Object.entries({
                  companyName: "Company name",
                  companyAddress: "Address",
                  companyPhone: "Phone",
                  companyWebsite: "Website",
                  companyTagline: "Tagline",
                  companyAccreditation: "Accreditation",
                }).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <input
                      className="input"
                      value={String(values[key] || "")}
                      onChange={(event) => set(key, event.target.value)}
                    />
                  </Field>
                ))}
              </div>
            </Card>
          )}
          {section === "quotation" && (
            <Card className="settings-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Proposal behavior</span>
                  <h2>Quotation defaults</h2>
                  <p>New quotations start with these commercial settings.</p>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Validity days">
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={Number(values.validityDays)}
                    onChange={(event) =>
                      set("validityDays", Number(event.target.value))
                    }
                  />
                </Field>
                <Field label="Advance payment (%)">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="100"
                    value={Number(values.advancePercent)}
                    onChange={(event) =>
                      set("advancePercent", Number(event.target.value))
                    }
                  />
                </Field>
                <Field label="USD exchange rate">
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={Number(values.exchangeRate)}
                    onChange={(event) =>
                      set("exchangeRate", Number(event.target.value))
                    }
                  />
                </Field>
                <Field label="Approval threshold (PKR)">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={Number(values.approvalThreshold)}
                    onChange={(event) =>
                      set("approvalThreshold", Number(event.target.value))
                    }
                  />
                </Field>
                <Field label="Default follow-up after days">
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={Number(values.followUpDays)}
                    onChange={(event) =>
                      set("followUpDays", Number(event.target.value))
                    }
                  />
                </Field>
                <Field label="Default terms and conditions">
                  <textarea
                    className="textarea textarea--large"
                    value={String(values.defaultTerms || "")}
                    onChange={(event) =>
                      set("defaultTerms", event.target.value)
                    }
                  />
                </Field>
              </div>
            </Card>
          )}
          {section === "automatic" &&
            (rulesQuery.error ? (
              <ErrorState
                error={rulesQuery.error}
                retry={() => rulesQuery.refetch()}
              />
            ) : rulesQuery.isLoading || !rules ? (
              <LoadingState label="Loading automatic design rules" />
            ) : (
              <>
                <Card className="settings-card">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">Sizing engine</span>
                      <h2>Automatic design rules</h2>
                      <p>
                        These server-validated values control generated
                        equipment quantities.
                      </p>
                    </div>
                    <Badge tone="info">Production rules</Badge>
                  </div>
                  <div className="form-grid">
                    <Field label="Panel margin (%)">
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max="50"
                        value={rules.panelMarginPercent}
                        onChange={(event) =>
                          setEngine(
                            "panelMarginPercent",
                            Number(event.target.value),
                          )
                        }
                      />
                    </Field>
                    <Field label="Maximum inverter oversize (%)">
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max="100"
                        value={rules.inverterOversizePercent}
                        onChange={(event) =>
                          setEngine(
                            "inverterOversizePercent",
                            Number(event.target.value),
                          )
                        }
                      />
                    </Field>
                    <Field label="Battery usable DoD (%)">
                      <input
                        className="input"
                        type="number"
                        min="1"
                        max="100"
                        value={rules.batteryDodPercent}
                        onChange={(event) =>
                          setEngine(
                            "batteryDodPercent",
                            Number(event.target.value),
                          )
                        }
                      />
                    </Field>
                    <Field label="Inverter efficiency (%)">
                      <input
                        className="input"
                        type="number"
                        min="1"
                        max="100"
                        value={rules.inverterEfficiencyPercent}
                        onChange={(event) =>
                          setEngine(
                            "inverterEfficiencyPercent",
                            Number(event.target.value),
                          )
                        }
                      />
                    </Field>
                    <Field label="Battery reserve (%)">
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max="100"
                        value={rules.batteryReservePercent}
                        onChange={(event) =>
                          setEngine(
                            "batteryReservePercent",
                            Number(event.target.value),
                          )
                        }
                      />
                    </Field>
                    <Field label="Default roof">
                      <select
                        className="select"
                        value={rules.defaultRoofType}
                        onChange={(event) =>
                          setEngine("defaultRoofType", event.target.value)
                        }
                      >
                        <option value="rcc">RCC roof</option>
                        <option value="metal-shed">Metal shed</option>
                        <option value="ground-mount">Ground mount</option>
                        <option value="other">Other</option>
                      </select>
                    </Field>
                  </div>
                </Card>
                <Card className="settings-card">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">Automatic BOQ</span>
                      <h2>Installation scope</h2>
                      <p>
                        {
                          rules.boqRules.filter((row) => row.enabled !== false)
                            .length
                        }{" "}
                        active rules calculate structure, protection, cables,
                        services, and site-survey items.
                      </p>
                    </div>
                  </div>
                  <div className="security-list">
                    {rules.boqRules.map((row, index) => (
                      <div className="auto-rule-row" key={row.key}>
                        <input
                          type="checkbox"
                          checked={row.enabled !== false}
                          onChange={(event) =>
                            setRules((current) =>
                              current
                                ? {
                                    ...current,
                                    boqRules: current.boqRules.map(
                                      (item, itemIndex) =>
                                        itemIndex === index
                                          ? {
                                              ...item,
                                              enabled: event.target.checked,
                                            }
                                          : item,
                                    ),
                                  }
                                : current,
                            )
                          }
                        />
                        <span>
                          <strong>{row.label}</strong>
                          <small>
                            {row.basis.replaceAll("_", " ")} × {row.multiplier}{" "}
                            · {row.priceMode.replaceAll("_", " ")}
                          </small>
                        </span>
                        <select
                          className="select"
                          aria-label={`${row.label} quantity basis`}
                          value={row.basis}
                          onChange={(event) =>
                            setRules((current) =>
                              current
                                ? {
                                    ...current,
                                    boqRules: current.boqRules.map(
                                      (item, itemIndex) =>
                                        itemIndex === index
                                          ? {
                                              ...item,
                                              basis: event.target.value,
                                            }
                                          : item,
                                    ),
                                  }
                                : current,
                            )
                          }
                        >
                          <option value="fixed">Fixed</option>
                          <option value="per_panel">Per panel</option>
                          <option value="per_kw">Per kW</option>
                          <option value="per_inverter">Per inverter</option>
                          <option value="per_battery">Per battery</option>
                        </select>
                        <input
                          className="input"
                          aria-label={`${row.label} multiplier`}
                          type="number"
                          min="0"
                          step="0.1"
                          value={row.multiplier}
                          onChange={(event) =>
                            setRules((current) =>
                              current
                                ? {
                                    ...current,
                                    boqRules: current.boqRules.map(
                                      (item, itemIndex) =>
                                        itemIndex === index
                                          ? {
                                              ...item,
                                              multiplier: Number(
                                                event.target.value,
                                              ),
                                            }
                                          : item,
                                    ),
                                  }
                                : current,
                            )
                          }
                        />
                        <select
                          className="select"
                          aria-label={`${row.label} pricing mode`}
                          value={row.priceMode}
                          onChange={(event) =>
                            setRules((current) =>
                              current
                                ? {
                                    ...current,
                                    boqRules: current.boqRules.map(
                                      (item, itemIndex) =>
                                        itemIndex === index
                                          ? {
                                              ...item,
                                              priceMode: event.target.value,
                                            }
                                          : item,
                                    ),
                                  }
                                : current,
                            )
                          }
                        >
                          <option value="catalog">Catalog price</option>
                          <option value="rule">Rule rate</option>
                          <option value="included">Included</option>
                          <option value="survey">Site survey</option>
                        </select>
                        {row.priceMode === "rule" && (
                          <input
                            className="input"
                            aria-label={`${row.label} unit rate`}
                            type="number"
                            min="0"
                            value={row.unitPrice || 0}
                            onChange={(event) =>
                              setRules((current) =>
                                current
                                  ? {
                                      ...current,
                                      boqRules: current.boqRules.map(
                                        (item, itemIndex) =>
                                          itemIndex === index
                                            ? {
                                                ...item,
                                                unitPrice: Number(
                                                  event.target.value,
                                                ),
                                              }
                                            : item,
                                      ),
                                    }
                                  : current,
                              )
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            ))}
          {section === "security" && (
            <Card className="settings-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">System protection</span>
                  <h2>Security policy</h2>
                  <p>Authentication safeguards are enforced by the server.</p>
                </div>
                <Badge tone="success">High protection</Badge>
              </div>
              <div className="security-list">
                <div>
                  <ShieldCheck />
                  <span>
                    <strong>Revocable sessions</strong>
                    <small>
                      Sessions are hashed in MongoDB and can be remotely
                      revoked.
                    </small>
                  </span>
                </div>
                <div>
                  <ShieldCheck />
                  <span>
                    <strong>CSRF and strict origin protection</strong>
                    <small>
                      State-changing browser requests require a matching
                      security token.
                    </small>
                  </span>
                </div>
                <div>
                  <ShieldCheck />
                  <span>
                    <strong>Progressive login lockout</strong>
                    <small>
                      Repeated unsuccessful attempts temporarily lock the
                      account.
                    </small>
                  </span>
                </div>
              </div>
            </Card>
          )}
          {section === "notifications" && (
            <Card className="settings-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Team alerts</span>
                  <h2>Notifications</h2>
                  <p>
                    Choose the operational events that should produce email
                    alerts.
                  </p>
                </div>
              </div>
              <label className="toggle-row">
                <span>
                  <strong>Email notifications</strong>
                  <small>
                    Account, quotation, and follow-up email messages.
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(values.emailNotifications)}
                  onChange={(event) =>
                    set("emailNotifications", event.target.checked)
                  }
                />
              </label>
              <label className="toggle-row">
                <span>
                  <strong>Approval notifications</strong>
                  <small>
                    Notify reviewers when quotations need a decision.
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(values.approvalNotifications)}
                  onChange={(event) =>
                    set("approvalNotifications", event.target.checked)
                  }
                />
              </label>
            </Card>
          )}
          {section === "data" && (
            <Card className="settings-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Portability</span>
                  <h2>Data export</h2>
                  <p>
                    Download an administrative JSON snapshot for controlled
                    backup or migration.
                  </p>
                </div>
              </div>
              <Button tone="secondary" onClick={exportData}>
                <Download />
                Export accessible data
              </Button>
              <div className="data-warning">
                <ShieldCheck />
                <span>
                  <strong>Protected operation</strong>
                  <small>
                    Exports are recorded in security audit history. Store
                    downloaded files securely.
                  </small>
                </span>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
