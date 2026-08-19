import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileCheck2,
  FileText,
  Gauge,
  Mail,
  Plus,
  Save,
  Search,
  Send,
  Sparkles,
  WandSparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ApiError, api, jsonBody } from "../lib/api";
import type {
  Customer,
  EngineInput,
  EnginePreview,
  Product,
  Quotation,
  QuoteItem,
} from "../types";
import { money, titleCase } from "../lib/format";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
} from "../components/ui";

interface Draft {
  quotationNumber: string;
  customerId: string;
  templateId: string;
  systemSize: number;
  systemUnit: "kW" | "MW";
  systemType: "ongrid" | "hybrid" | "offgrid";
  panelBrand: string;
  inverterBrand: string;
  includeBattery: boolean;
  batteryBrand: string;
  backupLoadKw: number;
  backupHours: number;
  roofType: string;
  prosumerIncluded: boolean;
  items: QuoteItem[];
  discount: number;
  discountType: "percent" | "fixed";
  taxRate: number;
  notes: string;
  validityDays: number;
  installationDays: number;
  followUpAt: string;
  followUpNote: string;
  paymentSchedule: { label: string; percent: number }[];
}
interface QuoteTemplate {
  _id?: string;
  id?: string;
  name: string;
  description?: string;
  systemType?: Draft["systemType"];
  items?: QuoteItem[];
  defaults?: Partial<Draft>;
}
type SaveIntent = "draft" | "sent" | "pending_approval" | "email";
const initialDraft = (): Draft => ({
  quotationNumber: `SLE-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${Date.now().toString().slice(-5)}`,
  customerId: "",
  templateId: "",
  systemSize: 10,
  systemUnit: "kW",
  systemType: "ongrid",
  panelBrand: "",
  inverterBrand: "",
  includeBattery: false,
  batteryBrand: "",
  backupLoadKw: 5,
  backupHours: 2,
  roofType: "rcc",
  prosumerIncluded: false,
  items: [],
  discount: 0,
  discountType: "percent",
  taxRate: 0,
  notes: "",
  validityDays: 5,
  installationDays: 7,
  followUpAt: "",
  followUpNote: "",
  paymentSchedule: [
    { label: "Advance with order", percent: 20 },
    { label: "Equipment delivery / installation", percent: 70 },
    { label: "Testing and commissioning", percent: 10 },
  ],
});
const idOf = (row: { id?: string; _id?: string }) => row.id || row._id || "";

export default function QuotationBuilder() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { notify } = useToast();
  const { hasPermission } = useAuth();
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [preview, setPreview] = useState<EnginePreview | null>(null);
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      return {
        ...initialDraft(),
        ...(JSON.parse(sessionStorage.getItem("skyland:draft") || "") || {}),
      };
    } catch {
      return initialDraft();
    }
  });
  const customers = useQuery({
    queryKey: ["customers", "builder"],
    queryFn: () => api<Customer[]>("/customers"),
  });
  const products = useQuery({
    queryKey: ["products", "builder"],
    queryFn: () => api<Product[]>("/products"),
  });
  const templates = useQuery({
    queryKey: ["quotation-templates"],
    queryFn: () => api<QuoteTemplate[]>("/templates"),
  });
  const engineOptions = useQuery({
    queryKey: ["quotation-engine-options", draft.systemSize, draft.systemType],
    queryFn: () =>
      api<{
        panelBrands: string[];
        inverterBrands: string[];
        batteryBrands: string[];
      }>(
        `/quotation-engine/options?systemSizeKw=${draft.systemSize}&systemType=${draft.systemType}`,
      ),
    enabled: hasPermission("auto_quote_generate"),
  });
  const existing = useQuery({
    queryKey: ["quotation", id],
    queryFn: () => api<Quotation>(`/quotations/${id}`),
    enabled: Boolean(id),
  });
  useEffect(() => {
    const selected = searchParams.get("customer");
    if (selected && !id)
      setDraft((value) => ({ ...value, customerId: selected }));
  }, [searchParams, id]);
  useEffect(() => {
    if (!hasPermission("auto_quote_generate")) setManualMode(true);
  }, [hasPermission]);
  useEffect(() => {
    if (!existing.data) return;
    const row = existing.data;
    setDraft({
      quotationNumber: row.quotationNumber,
      customerId: row.customerId,
      templateId: row.templateId || "",
      systemSize: row.systemSize,
      systemUnit: row.systemSize >= 1000 ? "MW" : "kW",
      systemType: row.systemType,
      panelBrand: row.generation?.input.panelBrand || "",
      inverterBrand: row.generation?.input.inverterBrand || "",
      includeBattery: row.generation?.input.includeBattery || false,
      batteryBrand: row.generation?.input.batteryBrand || "",
      backupLoadKw: row.generation?.input.backupLoadKw || 0,
      backupHours: row.generation?.input.backupHours || 0,
      roofType: row.generation?.input.roofType || "rcc",
      prosumerIncluded: row.generation?.input.prosumerIncluded || false,
      items: row.items,
      discount: row.discount || 0,
      discountType: row.discountType || "percent",
      taxRate: row.taxRate || 0,
      notes: row.notes || "",
      validityDays: row.validityDays || 5,
      installationDays: row.installationDays || 7,
      followUpAt: row.followUpAt?.slice(0, 10) || "",
      followUpNote: row.followUpNote || "",
      paymentSchedule: row.paymentSchedule || initialDraft().paymentSchedule,
    });
    setManualMode(!row.generation);
    setPreview(
      row.generation
        ? ({
            ...row.generation,
            items: row.items,
            subtotal: row.subtotal,
          } as EnginePreview)
        : null,
    );
  }, [existing.data]);
  useEffect(() => {
    const timer = window.setTimeout(
      () => sessionStorage.setItem("skyland:draft", JSON.stringify(draft)),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [draft]);
  const subtotal = useMemo(
    () =>
      draft.items.reduce(
        (sum, item) =>
          sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
        0,
      ),
    [draft.items],
  );
  const discountAmount =
    draft.discountType === "fixed"
      ? draft.discount
      : (subtotal * draft.discount) / 100;
  const taxAmount =
    (Math.max(0, subtotal - discountAmount) * draft.taxRate) / 100;
  const total = Math.max(0, subtotal - discountAmount) + taxAmount;
  const selectedCustomer = customers.data?.find(
    (row) => idOf(row) === draft.customerId,
  );
  const filteredProducts = (products.data || []).filter(
    (row) =>
      row.active !== false &&
      [row.name, row.brand, row.model, row.category]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const save = useMutation({
    mutationFn: async (intent: SaveIntent) => {
      const status = intent === "email" ? "draft" : intent;
      const body = {
        ...draft,
        templateId: draft.templateId || null,
        followUpAt: draft.followUpAt || null,
        status: status === "pending_approval" ? "draft" : status,
        subtotal,
        taxAmount,
        grandTotal: total,
        items: draft.items.map((item) => ({
          ...item,
          total: item.quantity * item.unitPrice,
        })),
        generation:
          preview && !manualMode
            ? {
                input: preview.input,
                digest: preview.digest,
              }
            : null,
      };
      const result = await api<Quotation>(
        id ? `/quotations/${id}` : "/quotations",
        { method: id ? "PUT" : "POST", ...jsonBody(body), timeout: 20_000 },
      );
      if (intent === "pending_approval")
        return {
          quotation: await api<Quotation>(
            `/quotations/${idOf(result)}/approval`,
            {
              method: "POST",
              ...jsonBody({ note: "Submitted from quotation builder" }),
            },
          ),
          intent,
        };
      if (intent === "email") {
        try {
          await api<{ message: string; status: string }>(
            "/email/send-quotation",
            {
              method: "POST",
              ...jsonBody({ quotationId: idOf(result) }),
              timeout: 25_000,
            },
          );
          return { quotation: { ...result, status: "sent" }, intent };
        } catch (error) {
          client.invalidateQueries({ queryKey: ["quotations"] });
          const reason =
            error instanceof Error ? error.message : "Email delivery failed";
          throw new Error(
            `Quotation ${result.quotationNumber} was saved as a draft, but the email was not sent. ${reason}`,
          );
        }
      }
      return { quotation: result, intent };
    },
    onSuccess: ({ quotation, intent }) => {
      sessionStorage.removeItem("skyland:draft");
      client.invalidateQueries({ queryKey: ["quotations"] });
      notify(
        intent === "email"
          ? `Quotation ${quotation.quotationNumber} emailed successfully`
          : `Quotation ${quotation.quotationNumber} saved`,
        "success",
      );
      navigate("/quotations");
    },
    onError: (error) => {
      const detail =
        error instanceof ApiError && error.fields
          ? Object.values(error.fields)[0]
          : undefined;
      notify(detail || error.message, "error");
    },
  });
  const generate = useMutation({
    mutationFn: () => {
      const input: EngineInput = {
        systemSizeKw: draft.systemSize,
        systemType: draft.systemType,
        panelBrand: draft.panelBrand,
        inverterBrand: draft.inverterBrand,
        includeBattery: draft.systemType !== "ongrid" || draft.includeBattery,
        batteryBrand: draft.batteryBrand,
        backupLoadKw: draft.backupLoadKw,
        backupHours: draft.backupHours,
        roofType: draft.roofType,
        prosumerIncluded: draft.prosumerIncluded,
      };
      return api<EnginePreview>("/quotation-engine/preview", {
        method: "POST",
        ...jsonBody(input),
        timeout: 20_000,
      });
    },
    onSuccess: (result) => {
      setPreview(result);
      setDraft((value) => ({ ...value, items: result.items }));
      notify("Complete quotation generated", "success");
    },
    onError: (error) => notify(error.message, "error"),
  });
  function addProduct(product: Product) {
    setDraft((value) => {
      const key = idOf(product);
      const existingItem = value.items.find((item) => item.productId === key);
      return {
        ...value,
        items: existingItem
          ? value.items.map((item) =>
              item.productId === key
                ? { ...item, quantity: item.quantity + 1 }
                : item,
            )
          : [
              ...value.items,
              {
                productId: key,
                name: product.name,
                category: product.category,
                unit: product.unit,
                quantity: 1,
                unitPrice: product.unitPrice,
              },
            ],
      };
    });
  }
  function updateItem(index: number, patch: Partial<QuoteItem>) {
    setDraft((value) => ({
      ...value,
      items: value.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }
  function removeItem(index: number) {
    setDraft((value) => ({
      ...value,
      items: value.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }
  function next() {
    if (step === 1 && !draft.customerId)
      return notify("Select a customer first", "error");
    if (step === 2 && !manualMode && !preview)
      return notify(
        "Choose the companies and generate the quotation first",
        "error",
      );
    if (step === 2 && manualMode && draft.items.length === 0)
      return notify("Add at least one product or service", "error");
    setStep((value) => Math.min(4, value + 1));
  }
  function applyTemplate(templateId: string) {
    const template = (templates.data || []).find(
      (row) => idOf(row) === templateId,
    );
    setDraft((value) =>
      template
        ? {
            ...value,
            ...template.defaults,
            templateId,
            systemType: template.systemType || value.systemType,
            items: (template.items || []).map((item) => ({ ...item })),
          }
        : { ...value, templateId: "" },
    );
    if (template) {
      setManualMode(true);
      setPreview(null);
    }
  }
  if (
    customers.isLoading ||
    products.isLoading ||
    templates.isLoading ||
    existing.isLoading
  )
    return <LoadingState label="Preparing quotation builder" />;
  if (customers.error || products.error || templates.error || existing.error)
    return (
      <ErrorState
        error={
          customers.error || products.error || templates.error || existing.error
        }
        retry={() => {
          customers.refetch();
          products.refetch();
          templates.refetch();
          existing.refetch();
        }}
      />
    );
  const steps = [
    "Customer & system",
    "Automatic design",
    "Commercial terms",
    "Review & send",
  ];
  return (
    <div className="page builder-page">
      <PageHeader
        title={id ? `Edit ${draft.quotationNumber}` : "New Quotation"}
        description="Build a complete solar proposal with products, installation, labor, and commercial terms."
        actions={
          <Button
            tone="secondary"
            onClick={() => save.mutate("draft")}
            disabled={save.isPending}
          >
            <Save />
            Save draft
          </Button>
        }
      />
      <div className="stepper" aria-label="Quotation progress">
        {steps.map((label, index) => (
          <button
            key={label}
            className={
              step === index + 1 ? "active" : step > index + 1 ? "complete" : ""
            }
            onClick={() => index + 1 < step && setStep(index + 1)}
          >
            <span>{step > index + 1 ? <Check /> : index + 1}</span>
            <small>{label}</small>
          </button>
        ))}
      </div>
      <div className="builder-layout">
        <div className="builder-workspace">
          {step === 1 && (
            <Card className="builder-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Step 1</span>
                  <h2>Select customer and system</h2>
                  <p>
                    Choose who this proposal is for and the proposed
                    configuration.
                  </p>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Customer">
                  <select
                    className="select"
                    value={draft.customerId}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        customerId: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select customer</option>
                    {(customers.data || []).map((row) => (
                      <option key={idOf(row)} value={idOf(row)}>
                        {row.name} — {row.city}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Quotation template">
                  <select
                    className="select"
                    value={draft.templateId}
                    onChange={(event) => applyTemplate(event.target.value)}
                  >
                    <option value="">Start from scratch</option>
                    {(templates.data || []).map((row) => (
                      <option key={idOf(row)} value={idOf(row)}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Quotation reference">
                  <input
                    className="input"
                    value={draft.quotationNumber}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        quotationNumber: event.target.value,
                      }))
                    }
                    required
                  />
                </Field>
                <Field label="Nominal system size">
                  <div className="capacity-input">
                    <input
                      className="input"
                      type="number"
                      min={draft.systemUnit === "MW" ? 0.001 : 0.1}
                      max={draft.systemUnit === "MW" ? 5 : 5000}
                      step={draft.systemUnit === "MW" ? 0.001 : 0.1}
                      value={
                        draft.systemUnit === "MW"
                          ? draft.systemSize / 1000
                          : draft.systemSize
                      }
                      onChange={(event) => {
                        const entered = Number(event.target.value);
                        setPreview(null);
                        setDraft((value) => ({
                          ...value,
                          systemSize:
                            value.systemUnit === "MW"
                              ? entered * 1000
                              : entered,
                          items: manualMode ? value.items : [],
                        }));
                      }}
                    />
                    <select
                      className="select"
                      aria-label="System size unit"
                      value={draft.systemUnit}
                      onChange={(event) =>
                        setDraft((value) => ({
                          ...value,
                          systemUnit: event.target.value as "kW" | "MW",
                        }))
                      }
                    >
                      <option value="kW">kW</option>
                      <option value="MW">MW</option>
                    </select>
                  </div>
                </Field>
                <Field label="System type">
                  <select
                    className="select"
                    value={draft.systemType}
                    onChange={(event) => {
                      const systemType = event.target
                        .value as Draft["systemType"];
                      setPreview(null);
                      setDraft((value) => ({
                        ...value,
                        systemType,
                        includeBattery:
                          systemType === "ongrid" ? value.includeBattery : true,
                        panelBrand: "",
                        inverterBrand: "",
                        batteryBrand: "",
                        items: manualMode ? value.items : [],
                      }));
                    }}
                  >
                    <option value="ongrid">On-grid</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="offgrid">Off-grid</option>
                  </select>
                </Field>
              </div>
              {selectedCustomer && (
                <div className="selection-banner">
                  <CheckCircle2 />
                  <span>
                    <strong>{selectedCustomer.name}</strong>
                    <small>
                      {selectedCustomer.phone} · {selectedCustomer.city}
                    </small>
                  </span>
                </div>
              )}
            </Card>
          )}
          {step === 2 && (
            <>
              <div
                className="builder-mode-switch"
                role="group"
                aria-label="Quotation design mode"
              >
                <button
                  className={!manualMode ? "active" : ""}
                  onClick={() => setManualMode(false)}
                  disabled={!hasPermission("auto_quote_generate")}
                >
                  <WandSparkles /> Automatic design
                </button>
                <button
                  className={manualMode ? "active" : ""}
                  onClick={() => {
                    setManualMode(true);
                    setPreview(null);
                  }}
                >
                  <Plus /> Manual builder
                </button>
              </div>
              {!manualMode ? (
                <>
                  <Card className="builder-card">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">Step 2</span>
                        <h2>Choose equipment companies</h2>
                        <p>
                          The design engine will select compatible models and
                          calculate every quantity.
                        </p>
                      </div>
                      <Badge tone="info">
                        {draft.systemSize >= 1000
                          ? `${draft.systemSize / 1000} MW`
                          : `${draft.systemSize} kW`}
                      </Badge>
                    </div>
                    {engineOptions.isLoading ? (
                      <LoadingState label="Finding compatible equipment" />
                    ) : engineOptions.error ? (
                      <ErrorState
                        error={engineOptions.error}
                        retry={() => engineOptions.refetch()}
                      />
                    ) : (
                      <div className="form-grid auto-design-form">
                        <Field label="Solar panel company">
                          <select
                            className="select"
                            value={draft.panelBrand}
                            onChange={(event) => {
                              setPreview(null);
                              setDraft((value) => ({
                                ...value,
                                panelBrand: event.target.value,
                                items: [],
                              }));
                            }}
                          >
                            <option value="">Select panel company</option>
                            {(engineOptions.data?.panelBrands || []).map(
                              (brand) => (
                                <option key={brand}>{brand}</option>
                              ),
                            )}
                          </select>
                        </Field>
                        <Field label="Inverter company">
                          <select
                            className="select"
                            value={draft.inverterBrand}
                            onChange={(event) => {
                              setPreview(null);
                              setDraft((value) => ({
                                ...value,
                                inverterBrand: event.target.value,
                                items: [],
                              }));
                            }}
                          >
                            <option value="">Select inverter company</option>
                            {(engineOptions.data?.inverterBrands || []).map(
                              (brand) => (
                                <option key={brand}>{brand}</option>
                              ),
                            )}
                          </select>
                        </Field>
                        {draft.systemType === "ongrid" && (
                          <Field label="Battery storage">
                            <label className="toggle-row">
                              <input
                                type="checkbox"
                                checked={draft.includeBattery}
                                onChange={(event) => {
                                  setPreview(null);
                                  setDraft((value) => ({
                                    ...value,
                                    includeBattery: event.target.checked,
                                    batteryBrand: event.target.checked
                                      ? value.batteryBrand
                                      : "",
                                    items: [],
                                  }));
                                }}
                              />
                              <span>Add optional backup storage</span>
                            </label>
                          </Field>
                        )}
                        {(draft.systemType !== "ongrid" ||
                          draft.includeBattery) && (
                          <>
                            <Field label="Battery company">
                              <select
                                className="select"
                                value={draft.batteryBrand}
                                onChange={(event) => {
                                  setPreview(null);
                                  setDraft((value) => ({
                                    ...value,
                                    batteryBrand: event.target.value,
                                    items: [],
                                  }));
                                }}
                              >
                                <option value="">Select battery company</option>
                                {(engineOptions.data?.batteryBrands || []).map(
                                  (brand) => (
                                    <option key={brand}>{brand}</option>
                                  ),
                                )}
                              </select>
                            </Field>
                            <Field label="Essential backup load (kW)">
                              <input
                                className="input"
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={draft.backupLoadKw}
                                onChange={(event) => {
                                  setPreview(null);
                                  setDraft((value) => ({
                                    ...value,
                                    backupLoadKw: Number(event.target.value),
                                    items: [],
                                  }));
                                }}
                              />
                            </Field>
                            <Field label="Required backup (hours)">
                              <input
                                className="input"
                                type="number"
                                min="0.5"
                                step="0.5"
                                value={draft.backupHours}
                                onChange={(event) => {
                                  setPreview(null);
                                  setDraft((value) => ({
                                    ...value,
                                    backupHours: Number(event.target.value),
                                    items: [],
                                  }));
                                }}
                              />
                            </Field>
                          </>
                        )}
                        <Field label="Roof assumption">
                          <select
                            className="select"
                            value={draft.roofType}
                            onChange={(event) => {
                              setPreview(null);
                              setDraft((value) => ({
                                ...value,
                                roofType: event.target.value,
                                items: [],
                              }));
                            }}
                          >
                            <option value="rcc">RCC roof</option>
                            <option value="metal-shed">Metal shed</option>
                            <option value="ground-mount">Ground mount</option>
                            <option value="other">
                              Other / survey required
                            </option>
                          </select>
                        </Field>
                        <Field label="Prosumer scope">
                          <label className="toggle-row">
                            <input
                              type="checkbox"
                              checked={draft.prosumerIncluded}
                              onChange={(event) => {
                                setPreview(null);
                                setDraft((value) => ({
                                  ...value,
                                  prosumerIncluded: event.target.checked,
                                  items: [],
                                }));
                              }}
                            />
                            <span>Include application support</span>
                          </label>
                        </Field>
                      </div>
                    )}
                    <div className="auto-generate-action">
                      <Button
                        onClick={() => generate.mutate()}
                        disabled={generate.isPending || engineOptions.isLoading}
                      >
                        <WandSparkles />{" "}
                        {generate.isPending
                          ? "Generating…"
                          : preview
                            ? "Regenerate quotation"
                            : "Generate complete quotation"}
                      </Button>
                    </div>
                  </Card>
                  {preview && (
                    <Card className="builder-card generated-preview">
                      <div className="section-heading">
                        <div>
                          <span className="eyebrow">Generated design</span>
                          <h2>{preview.design.actualDcKw} kW DC solar array</h2>
                          <p>
                            Review the automatically selected equipment and
                            complete installation scope.
                          </p>
                        </div>
                        <Badge tone="success">
                          <CheckCircle2 /> Ready
                        </Badge>
                      </div>
                      <div className="design-metrics">
                        <div>
                          <Gauge />
                          <span>
                            Panels
                            <strong>
                              {preview.design.panelQuantity} ×{" "}
                              {preview.design.panelWatts} W
                            </strong>
                            <small>{preview.design.panelModel}</small>
                          </span>
                        </div>
                        <div>
                          <Gauge />
                          <span>
                            Inverters
                            <strong>
                              {preview.design.inverterUnitKw > 0
                                ? `${preview.design.inverterQuantity} × ${preview.design.inverterUnitKw} kW`
                                : `${preview.design.inverterTotalKw} kW combined`}
                            </strong>
                            <small>{preview.design.inverterModel}</small>
                          </span>
                        </div>
                        {preview.design.batteryQuantity > 0 && (
                          <div>
                            <Gauge />
                            <span>
                              Battery storage
                              <strong>
                                {preview.design.batteryUnitKwh > 0
                                  ? `${preview.design.batteryQuantity} × ${preview.design.batteryUnitKwh} kWh`
                                  : `${preview.design.batteryTotalKwh} kWh combined`}
                              </strong>
                              <small>{preview.design.batteryModel}</small>
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="line-items generated-items">
                        {draft.items.map((item, index) => (
                          <div
                            className="line-item"
                            key={`${item.productId || item.name}-${index}`}
                          >
                            <span className="generated-item-name">
                              <strong>{item.name}</strong>
                              <small>
                                {item.description ||
                                  (item.unitPrice === 0
                                    ? "Included"
                                    : "Automatically calculated")}
                              </small>
                            </span>
                            <label>
                              Qty
                              <input
                                className="input"
                                type="number"
                                min="0"
                                step="0.1"
                                value={item.quantity}
                                disabled={!hasPermission("auto_quote_override")}
                                onChange={(event) =>
                                  updateItem(index, {
                                    quantity: Number(event.target.value),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Rate
                              <input
                                className="input"
                                type="number"
                                min="0"
                                value={item.unitPrice}
                                disabled={!hasPermission("auto_quote_override")}
                                onChange={(event) =>
                                  updateItem(index, {
                                    unitPrice: Number(event.target.value),
                                  })
                                }
                              />
                            </label>
                            <strong>
                              {item.unitPrice === 0
                                ? item.description?.includes("site survey")
                                  ? "Site survey"
                                  : "Included"
                                : money(item.quantity * item.unitPrice)}
                            </strong>
                            {hasPermission("auto_quote_override") ? (
                              <button
                                onClick={() => removeItem(index)}
                                aria-label={`Remove ${item.name}`}
                              >
                                <Trash2 />
                              </button>
                            ) : (
                              <span />
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="generation-assumptions">
                        <strong>Engineering assumptions</strong>
                        <ul>
                          {preview.assumptions.map((assumption) => (
                            <li key={assumption}>{assumption}</li>
                          ))}
                        </ul>
                      </div>
                    </Card>
                  )}
                </>
              ) : (
                <>
                  <Card className="builder-card">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">Step 2</span>
                        <h2>Select products and services</h2>
                        <p>
                          Catalog prices remain editable for this
                          customer-specific quotation.
                        </p>
                      </div>
                    </div>
                    <div className="search-box">
                      <Search />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search panels, inverters, batteries, labor…"
                      />
                    </div>
                    <div className="builder-products">
                      {filteredProducts.map((product) => (
                        <button
                          key={idOf(product)}
                          onClick={() => addProduct(product)}
                        >
                          <span>
                            {product.image ? (
                              <img src={product.image} alt="" />
                            ) : (
                              <Sparkles />
                            )}
                          </span>
                          <div>
                            <strong>{product.name}</strong>
                            <small>
                              {titleCase(product.category)} ·{" "}
                              {money(product.unitPrice)}
                            </small>
                          </div>
                          <Plus />
                        </button>
                      ))}
                    </div>
                  </Card>
                  <Card className="builder-card">
                    <div className="section-heading">
                      <div>
                        <h2>Selected items</h2>
                        <p>Adjust quantity and customer-specific rates.</p>
                      </div>
                      <Button
                        tone="secondary"
                        size="sm"
                        onClick={() =>
                          setDraft((value) => ({
                            ...value,
                            items: [
                              ...value.items,
                              {
                                name: "Custom installation service",
                                category: "service",
                                unit: "job",
                                quantity: 1,
                                unitPrice: 0,
                              },
                            ],
                          }))
                        }
                      >
                        <Plus />
                        Custom line
                      </Button>
                    </div>
                    {draft.items.length ? (
                      <div className="line-items">
                        {draft.items.map((item, index) => (
                          <div
                            className="line-item"
                            key={`${item.productId || item.name}-${index}`}
                          >
                            <input
                              className="input line-item__name"
                              aria-label="Item name"
                              value={item.name}
                              onChange={(event) =>
                                updateItem(index, { name: event.target.value })
                              }
                            />
                            <label>
                              Qty
                              <input
                                className="input"
                                type="number"
                                min="0"
                                step="0.1"
                                value={item.quantity}
                                onChange={(event) =>
                                  updateItem(index, {
                                    quantity: Number(event.target.value),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Rate
                              <input
                                className="input"
                                type="number"
                                min="0"
                                value={item.unitPrice}
                                onChange={(event) =>
                                  updateItem(index, {
                                    unitPrice: Number(event.target.value),
                                  })
                                }
                              />
                            </label>
                            <strong>
                              {money(item.quantity * item.unitPrice)}
                            </strong>
                            <button
                              onClick={() => removeItem(index)}
                              aria-label={`Remove ${item.name}`}
                            >
                              <Trash2 />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="No items selected"
                        message="Choose products above or add a custom labor/service line."
                      />
                    )}
                  </Card>
                </>
              )}
            </>
          )}
          {step === 3 && (
            <Card className="builder-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Step 3</span>
                  <h2>Commercial terms</h2>
                  <p>
                    Set discounts, taxes, payment terms, installation, and
                    follow-up.
                  </p>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Discount">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={draft.discount}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        discount: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label="Discount type">
                  <select
                    className="select"
                    value={draft.discountType}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        discountType: event.target
                          .value as Draft["discountType"],
                      }))
                    }
                  >
                    <option value="percent">Percentage</option>
                    <option value="fixed">Fixed PKR</option>
                  </select>
                </Field>
                <Field label="Tax rate (%)">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="100"
                    value={draft.taxRate}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        taxRate: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label="Validity (days)">
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={draft.validityDays}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        validityDays: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label="Installation days">
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={draft.installationDays}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        installationDays: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label="Follow-up date">
                  <input
                    className="input"
                    type="date"
                    value={draft.followUpAt}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        followUpAt: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Follow-up note">
                  <input
                    className="input"
                    value={draft.followUpNote}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        followUpNote: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Proposal notes">
                  <textarea
                    className="textarea"
                    value={draft.notes}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        notes: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>
              <div className="milestones">
                <h3>Payment schedule</h3>
                {draft.paymentSchedule.map((row, index) => (
                  <div key={index}>
                    <input
                      className="input"
                      value={row.label}
                      onChange={(event) =>
                        setDraft((value) => ({
                          ...value,
                          paymentSchedule: value.paymentSchedule.map(
                            (item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, label: event.target.value }
                                : item,
                          ),
                        }))
                      }
                    />
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="100"
                      value={row.percent}
                      onChange={(event) =>
                        setDraft((value) => ({
                          ...value,
                          paymentSchedule: value.paymentSchedule.map(
                            (item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    percent: Number(event.target.value),
                                  }
                                : item,
                          ),
                        }))
                      }
                    />
                    <span>%</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {step === 4 && (
            <Card className="builder-card review-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Step 4</span>
                  <h2>Review and finish</h2>
                  <p>
                    Confirm the commercial snapshot before saving or requesting
                    approval.
                  </p>
                </div>
                <Badge tone="info">
                  {draft.systemSize} kW {titleCase(draft.systemType)}
                </Badge>
              </div>
              <div className="review-customer">
                <span>
                  <strong>
                    {selectedCustomer?.name || "Customer not selected"}
                  </strong>
                  <small>
                    {selectedCustomer?.phone} · {selectedCustomer?.city}
                  </small>
                </span>
                <span>
                  <strong>{draft.quotationNumber}</strong>
                  <small>Valid for {draft.validityDays} days</small>
                </span>
              </div>
              <div className="review-lines">
                {draft.items.map((item, index) => (
                  <div key={index}>
                    <span>
                      {item.name}
                      <small>
                        {item.quantity} × {money(item.unitPrice)}
                      </small>
                    </span>
                    <strong>
                      {item.unitPrice === 0
                        ? "Included / survey"
                        : money(item.quantity * item.unitPrice)}
                    </strong>
                  </div>
                ))}
              </div>
              <div className="review-actions">
                <Button
                  tone="secondary"
                  onClick={() => save.mutate("draft")}
                  disabled={save.isPending}
                >
                  <Save />
                  Save draft
                </Button>
                <Button
                  tone="secondary"
                  onClick={() => save.mutate("pending_approval")}
                  disabled={save.isPending}
                >
                  <FileCheck2 />
                  Request approval
                </Button>
                {selectedCustomer?.email ? (
                  <Button
                    onClick={() => save.mutate("email")}
                    disabled={save.isPending}
                  >
                    <Mail />
                    Save &amp; email
                  </Button>
                ) : (
                  <Button
                    onClick={() => save.mutate("sent")}
                    disabled={save.isPending}
                    title="This customer has no email address"
                  >
                    <Send />
                    Save &amp; mark sent
                  </Button>
                )}
              </div>
            </Card>
          )}
          <div className="builder-navigation">
            <Button
              tone="secondary"
              disabled={step === 1}
              onClick={() => setStep((value) => Math.max(1, value - 1))}
            >
              <ArrowLeft />
              Back
            </Button>
            {step < 4 && (
              <Button onClick={next}>
                Continue
                <ArrowRight />
              </Button>
            )}
          </div>
        </div>
        <aside className="quote-summary">
          <span className="eyebrow">Live commercial summary</span>
          <h2>{draft.quotationNumber}</h2>
          <div>
            <span>Customer</span>
            <strong>{selectedCustomer?.name || "Not selected"}</strong>
          </div>
          <div>
            <span>System</span>
            <strong>
              {draft.systemSize} kW · {titleCase(draft.systemType)}
            </strong>
          </div>
          <div>
            <span>Line items</span>
            <strong>{draft.items.length}</strong>
          </div>
          <hr />
          <div>
            <span>Subtotal</span>
            <strong>{money(subtotal)}</strong>
          </div>
          <div>
            <span>Discount</span>
            <strong>- {money(discountAmount)}</strong>
          </div>
          <div>
            <span>Tax</span>
            <strong>{money(taxAmount)}</strong>
          </div>
          <div className="summary-total">
            <span>Grand total</span>
            <strong>{money(total)}</strong>
          </div>
          <small>
            <FileText /> Prices are preserved in this quotation when catalog
            rates change.
          </small>
        </aside>
      </div>
    </div>
  );
}
