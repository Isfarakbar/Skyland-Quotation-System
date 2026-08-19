import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  Grid2X2,
  ImagePlus,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useState } from "react";
import { api, jsonBody, pageResult } from "../lib/api";
import type { PageResult, Product } from "../types";
import { money, titleCase } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Pagination,
} from "../components/ui";
import { ConfirmDialog } from "../components/ConfirmDialog";

const categories = [
  "all",
  "solar-panel",
  "inverter",
  "battery",
  "structure",
  "cable",
  "accessory",
  "service",
  "other",
];
const blank = {
  name: "",
  category: "solar-panel",
  brand: "",
  model: "",
  capacity: "",
  capacityUnit: "W",
  inverterType: "",
  unit: "piece",
  unitPrice: 0,
  pricePerWatt: 0,
  image: "",
  active: true,
  autoSizing: {
    enabled: true,
    capacityValue: 0,
    capacityUnit: "W",
    supportedSystemTypes: [] as string[],
    phase: "any",
    minSystemKw: 0,
    maxSystemKw: 5000,
    priority: 100,
  },
};
const productId = (row: Product) => row.id || row._id || "";

export default function Products() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(blank);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const { hasPermission } = useAuth();
  const { notify } = useToast();
  const client = useQueryClient();
  const params = new URLSearchParams({
    page: String(page),
    limit: "18",
    sort: "name",
    ...(search ? { search } : {}),
    ...(category !== "all" ? { category } : {}),
  });
  const query = useQuery({
    queryKey: ["products", page, search, category],
    queryFn: () => api<PageResult<Product> | Product[]>(`/products?${params}`),
  });
  const data = query.data ? pageResult(query.data) : null;
  const save = useMutation({
    mutationFn: async () => {
      const path = editing ? `/products/${productId(editing)}` : "/products";
      const method = editing ? "PUT" : "POST";
      const payload = {
        ...form,
        autoSizing: {
          ...form.autoSizing,
          capacityValue: Number.parseFloat(String(form.capacity || 0)) || 0,
          capacityUnit: form.capacityUnit,
          supportedSystemTypes:
            form.category === "inverter" && form.inverterType
              ? [form.inverterType]
              : [],
        },
      };
      return api<Product>(path, { method, ...jsonBody(payload) });
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["products"] });
      setDialogOpen(false);
      notify(editing ? "Product updated" : "Product added", "success");
    },
    onError: (error) => notify(error.message, "error"),
  });
  const remove = useMutation({
    mutationFn: (row: Product) =>
      api(`/products/${productId(row)}`, { method: "DELETE" }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["products"] });
      setDeleting(null);
      notify("Product deleted", "success");
    },
    onError: (error) => notify(error.message, "error"),
  });
  function openEditor(row?: Product) {
    setEditing(row || null);
    setForm(
      row
        ? {
            ...blank,
            ...row,
            inverterType: row.inverterType || "",
            autoSizing: { ...blank.autoSizing, ...row.autoSizing },
          }
        : blank,
    );
    setDialogOpen(true);
  }
  async function uploadImage(file?: File) {
    if (!file) return;
    try {
      const body = new FormData();
      body.append("image", file);
      body.append("folder", "products");
      const result = await api<{ url: string }>("/uploads/image", {
        method: "POST",
        body,
        timeout: 30_000,
      });
      setForm((value) => ({ ...value, image: result.url }));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Upload failed", "error");
    }
  }
  return (
    <div className="page">
      <PageHeader
        title="Product Catalog"
        description="Reusable solar equipment and services for quotations — no stock tracking."
        actions={
          hasPermission("products_manage") ? (
            <Button onClick={() => openEditor()}>
              <Plus />
              Add product
            </Button>
          ) : undefined
        }
      />
      <div className="toolbar">
        <div className="search-box">
          <Search />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search products, brands or models…"
            aria-label="Search products"
          />
        </div>
        <div className="view-toggle" aria-label="View style">
          <button
            className={view === "grid" ? "active" : ""}
            onClick={() => setView("grid")}
            aria-label="Grid view"
          >
            <Grid2X2 />
          </button>
          <button
            className={view === "list" ? "active" : ""}
            onClick={() => setView("list")}
            aria-label="List view"
          >
            <List />
          </button>
        </div>
      </div>
      <div
        className="chip-scroll"
        role="tablist"
        aria-label="Product categories"
      >
        {categories.map((item) => (
          <button
            role="tab"
            aria-selected={category === item}
            className={category === item ? "active" : ""}
            key={item}
            onClick={() => {
              setCategory(item);
              setPage(1);
            }}
          >
            {item === "all" ? "All products" : titleCase(item)}
          </button>
        ))}
      </div>
      {query.isLoading ? (
        <LoadingState label="Loading catalog" />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : !data?.items.length ? (
        <EmptyState
          title="No products found"
          message="Try a different filter or add a reusable quotation product."
          action={
            hasPermission("products_manage") ? (
              <Button onClick={() => openEditor()}>
                <Plus />
                Add product
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className={`product-grid product-grid--${view}`}>
            {data.items.map((row) => (
              <article className="product-card" key={productId(row)}>
                <div className="product-image">
                  {row.image ? (
                    <img src={row.image} alt="" loading="lazy" />
                  ) : (
                    <Boxes />
                  )}
                  <Badge tone={row.active === false ? "danger" : "success"}>
                    {row.active === false ? "Inactive" : "Active"}
                  </Badge>
                </div>
                <div className="product-content">
                  <span className="eyebrow">{titleCase(row.category)}</span>
                  <h2>{row.name}</h2>
                  <p>
                    {[
                      row.brand,
                      row.model,
                      row.capacity &&
                        `${row.capacity}${row.capacityUnit || ""}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Reusable quotation item"}
                  </p>
                  <div className="product-footer">
                    <div>
                      <strong>{money(row.unitPrice)}</strong>
                      <span>per {row.unit || "item"}</span>
                    </div>
                    {hasPermission("products_manage") && (
                      <div className="row-actions">
                        <button
                          onClick={() => openEditor(row)}
                          aria-label={`Edit ${row.name}`}
                        >
                          <Pencil />
                        </button>
                        {hasPermission("products_delete") && (
                          <button
                            className="danger"
                            onClick={() => setDeleting(row)}
                            aria-label={`Delete ${row.name}`}
                          >
                            <Trash2 />
                          </button>
                        )}
                        <button aria-label="More options">
                          <MoreHorizontal />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Pagination
            page={data.meta.page}
            pages={data.meta.pages}
            onChange={setPage}
          />
        </>
      )}
      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog dialog--form">
            <div className="dialog__header">
              <div>
                <Dialog.Title>
                  {editing ? "Edit product" : "Add product"}
                </Dialog.Title>
                <Dialog.Description>
                  Keep catalog information clear for fast quotation selection.
                </Dialog.Description>
              </div>
              <Dialog.Close className="dialog__close" aria-label="Close">
                <X />
              </Dialog.Close>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
              className="form-grid"
            >
              <Field label="Product name">
                <input
                  className="input"
                  value={form.name}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, name: event.target.value }))
                  }
                  required
                />
              </Field>
              <Field label="Category">
                <select
                  className="select"
                  value={form.category}
                  onChange={(event) => {
                    const category = event.target.value;
                    const capacityUnit =
                      category === "solar-panel"
                        ? "W"
                        : category === "battery"
                          ? "kWh"
                          : category === "inverter"
                            ? "kW"
                            : "";
                    setForm((value) => ({
                      ...value,
                      category,
                      capacityUnit,
                      inverterType:
                        category === "inverter" ? value.inverterType : "",
                    }));
                  }}
                >
                  {categories.slice(1).map((item) => (
                    <option key={item} value={item}>
                      {titleCase(item)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Brand">
                <input
                  className="input"
                  value={form.brand}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      brand: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Model">
                <input
                  className="input"
                  value={form.model}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      model: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Rated capacity">
                <div className="capacity-input">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.capacity}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        capacity: event.target.value,
                      }))
                    }
                  />
                  <select
                    className="select"
                    aria-label="Capacity unit"
                    value={form.capacityUnit}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        capacityUnit: event.target.value,
                      }))
                    }
                  >
                    <option value="W">W</option>
                    <option value="kW">kW</option>
                    <option value="kWh">kWh</option>
                    <option value="">N/A</option>
                  </select>
                </div>
              </Field>
              {form.category === "inverter" && (
                <Field label="Inverter type">
                  <select
                    className="select"
                    value={form.inverterType}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        inverterType: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select type</option>
                    <option value="ongrid">On-grid</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="offgrid">Off-grid</option>
                  </select>
                </Field>
              )}
              <Field label="Automatic quotation">
                <select
                  className="select"
                  value={form.autoSizing.enabled ? "enabled" : "disabled"}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      autoSizing: {
                        ...value.autoSizing,
                        enabled: event.target.value === "enabled",
                      },
                    }))
                  }
                >
                  <option value="enabled">
                    Available for automatic design
                  </option>
                  <option value="disabled">Manual quotations only</option>
                </select>
              </Field>
              <Field label="Unit">
                <input
                  className="input"
                  value={form.unit}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, unit: event.target.value }))
                  }
                  required
                />
              </Field>
              <Field label="Unit price (PKR)">
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={form.unitPrice}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      unitPrice: Number(event.target.value),
                    }))
                  }
                  required
                />
              </Field>
              <Field label="Price per watt">
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={form.pricePerWatt}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      pricePerWatt: Number(event.target.value),
                    }))
                  }
                />
              </Field>
              <Field label="Product image">
                <label className="upload-box">
                  {form.image ? (
                    <img src={form.image} alt="Product preview" />
                  ) : (
                    <>
                      <ImagePlus />
                      <span>Choose JPEG, PNG or WebP</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => uploadImage(event.target.files?.[0])}
                  />
                  <Upload />
                </label>
              </Field>
              <Field label="Catalog status">
                <select
                  className="select"
                  value={form.active ? "active" : "inactive"}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      active: event.target.value === "active",
                    }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
              <div className="form-grid__full dialog__actions">
                <Button
                  tone="secondary"
                  type="button"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save product"}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete product?"
        message={`${deleting?.name || "This product"} will be removed from future selection. Existing quotations keep their saved prices.`}
        confirmLabel="Delete product"
        busy={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  );
}
