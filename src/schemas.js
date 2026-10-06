// Strict schemas for Pacific trade documents. Use them to validate data typed by a person or read by an AI
// from a scan, and to generate JSON Schema for structured LLM output (z.toJSONSchema).
import { z } from 'zod';

/** Harmonized System code: 6 digits (international), 8 or 10 digits (national tariff line). Dots/spaces allowed. */
export const HsCode = z.string()
  .transform((s) => s.replace(/[\s.]/g, ''))
  .pipe(z.string().regex(/^\d{6}(\d{2}){0,2}$/, 'HS code must have 6, 8 or 10 digits'));

export const CurrencyCode = z.string().regex(/^[A-Z]{3}$/, 'ISO 4217 currency code, e.g. USD, FJD, AUD');
export const CountryCode = z.string().regex(/^[A-Z]{2}$/, 'ISO 3166-1 alpha-2 country code, e.g. FJ, AU, CN');
export const UnLocode = z.string().regex(/^[A-Z]{2}[A-Z2-9]{3}$/, 'UN/LOCODE, e.g. FJSUV');
export const Incoterm = z.enum(['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']);
const Amount = z.number().finite().nonnegative();
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date as YYYY-MM-DD');

export const Party = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  country: CountryCode.optional(),
  tin: z.string().optional().describe('Tax Identification Number (required for the importer in Fiji)'),
});

export const InvoiceLine = z.object({
  description: z.string().min(1),
  hsCode: HsCode.optional(),
  originCountry: CountryCode.optional(),
  quantity: z.number().finite().positive(),
  unit: z.string().optional().describe('e.g. pcs, kg, cartons'),
  unitPrice: Amount,
  lineTotal: Amount,
});

export const CommercialInvoice = z.object({
  documentType: z.literal('commercial_invoice'),
  invoiceNumber: z.string().min(1),
  invoiceDate: IsoDate.optional(),
  seller: Party,
  buyer: Party,
  currency: CurrencyCode,
  incoterm: Incoterm.optional(),
  lines: z.array(InvoiceLine).min(1),
  freight: Amount.optional(),
  insurance: Amount.optional(),
  total: Amount,
  grossWeightKg: Amount.optional(),
  portOfDischarge: UnLocode.optional(),
});

export const Container = z.object({
  number: z.string().regex(/^[A-Z]{4}\d{7}$/, 'ISO 6346 container number, e.g. MSCU1234567').optional(),
  seal: z.string().optional(),
  type: z.string().optional().describe('e.g. 20GP, 40HC'),
});

export const BillOfLading = z.object({
  documentType: z.literal('bill_of_lading'),
  blNumber: z.string().min(1),
  shipper: Party,
  consignee: Party,
  notifyParty: Party.optional(),
  vessel: z.string().optional(),
  voyage: z.string().optional(),
  portOfLoading: UnLocode,
  portOfDischarge: UnLocode,
  packages: z.number().int().positive().optional(),
  grossWeightKg: Amount.optional(),
  containers: z.array(Container).default([]),
  freightTerms: z.enum(['prepaid', 'collect']).optional(),
});

export const TradeDocument = z.discriminatedUnion('documentType', [CommercialInvoice, BillOfLading]);
