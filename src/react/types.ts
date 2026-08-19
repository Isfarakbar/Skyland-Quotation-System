export type Role = "super_admin" | "admin" | "manager" | "employee";
export type UserStatus = "pending" | "active" | "suspended" | "rejected";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  profilePicture?: string;
  role: Role;
  status: UserStatus;
  designation?: string;
  department?: string;
  city?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  employeeId?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
  mfaEnabled?: boolean;
  permissions?: Record<string, boolean>;
  effectivePermissions: Record<string, boolean>;
  createdAt?: string;
  approvedAt?: string;
}

export interface Product {
  id: string;
  _id?: string;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  capacity?: string;
  capacityUnit?: string;
  unit: string;
  unitPrice: number;
  pricePerWatt?: number;
  image?: string;
  active?: boolean;
  effectiveFrom?: string;
  priceHistory?: {
    unitPrice: number;
    pricePerWatt?: number;
    changedAt?: string;
  }[];
  createdAt?: string;
  inverterType?: string;
  autoSizing?: {
    enabled?: boolean;
    capacityValue?: number;
    capacityUnit?: string;
    supportedSystemTypes?: string[];
    phase?: string;
    minSystemKw?: number;
    maxSystemKw?: number;
    priority?: number;
  };
}

export interface Customer {
  id: string;
  _id?: string;
  name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  city: string;
  projectType?: string;
  serviceInterest?: string;
  address?: string;
  notes?: string;
  createdBy?: string;
  assignedTo?: string;
  createdAt?: string;
}

export interface QuoteItem {
  productId?: string;
  name: string;
  description?: string;
  category?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  total?: number;
  isOptional?: boolean;
}

export type QuoteStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "sent"
  | "viewed"
  | "accepted"
  | "rejected"
  | "expired"
  | "cancelled";

export interface Quotation {
  id: string;
  _id?: string;
  quotationNumber: string;
  customerId: string;
  templateId?: string;
  systemSize: number;
  systemType: "ongrid" | "hybrid" | "offgrid";
  items: QuoteItem[];
  subtotal: number;
  discount: number;
  discountType: "percent" | "fixed";
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  status: QuoteStatus;
  revision?: number;
  followUpAt?: string;
  followUpNote?: string;
  assignedTo?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
  notes?: string;
  validityDays?: number;
  installationDays?: number;
  paymentSchedule?: { label: string; percent: number }[];
  generation?: EngineGenerationSnapshot | null;
}

export interface EngineInput {
  systemSizeKw: number;
  systemType: "ongrid" | "hybrid" | "offgrid";
  panelBrand: string;
  inverterBrand: string;
  includeBattery: boolean;
  batteryBrand: string;
  backupLoadKw: number;
  backupHours: number;
  roofType: string;
  prosumerIncluded: boolean;
}

export interface EngineDesign {
  requestedAcKw: number;
  panelModel: string;
  panelWatts: number;
  panelQuantity: number;
  actualDcKw: number;
  inverterModel: string;
  inverterUnitKw: number;
  inverterQuantity: number;
  inverterTotalKw: number;
  inverterBreakdown?: { model: string; capacity: number; quantity: number }[];
  requiredBatteryKwh: number;
  batteryModel: string;
  batteryUnitKwh: number;
  batteryQuantity: number;
  batteryTotalKwh: number;
  batteryBreakdown?: { model: string; capacity: number; quantity: number }[];
}

export interface EnginePreview {
  engineVersion: string;
  catalogVersion: string;
  rulesVersion: string;
  digest: string;
  input: EngineInput;
  design: EngineDesign;
  items: QuoteItem[];
  subtotal: number;
  assumptions: string[];
  warnings: string[];
}

export interface EngineGenerationSnapshot extends Omit<
  EnginePreview,
  "items" | "subtotal"
> {
  mode?: "automatic";
  manualOverrides?: unknown;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}
export interface PageResult<T> {
  items: T[];
  meta: PageMeta;
}

export interface ApiProblem {
  code: string;
  message: string;
  fields?: Record<string, string>;
  requestId?: string;
}
