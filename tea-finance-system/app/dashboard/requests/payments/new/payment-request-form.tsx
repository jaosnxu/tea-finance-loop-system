"use client";

import { useEffect, useMemo, useState } from "react";

import { submitPaymentRequestAction } from "@/app/dashboard/requests/payments/actions";
import type { FormFieldConfig, FormTemplateConfig } from "@/lib/types";

type PaymentRequestFormProps = {
  activeOrganizations: Array<{
    value: string;
    label: string;
    baseCurrency: "RUB" | "CNY" | "USD";
    taxLabel: string;
    settlementRole: string;
    enableMultiCurrency: boolean;
    enableExchangeRate: boolean;
    allowedCurrencies: Array<"RUB" | "CNY" | "USD">;
  }>;
  paymentParties: Array<{
    value: string;
    label: string;
    type?: string;
    organizationScope?: string[];
    bankName?: string;
    bankAccount?: string;
  }>;
  bankAccounts: Array<{
    value: string;
    label: string;
    organization: string;
    currency: "RUB" | "CNY" | "USD";
    isDefault: boolean;
  }>;
  projects: Array<{
    value: string;
    label: string;
    organization: string;
  }>;
  formTemplate: FormTemplateConfig;
};

export function PaymentRequestForm({
  activeOrganizations,
  paymentParties,
  bankAccounts,
  projects,
  formTemplate
}: PaymentRequestFormProps) {
  const [selectedOrganization, setSelectedOrganization] = useState("");
  const [selectedPartyType, setSelectedPartyType] = useState("supplier");
  const [selectedPartyName, setSelectedPartyName] = useState("");
  const [isInternal, setIsInternal] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState<"RUB" | "CNY" | "USD" | "">("");
  const selectedOrganizationConfig = useMemo(
    () => activeOrganizations.find((item) => item.value === selectedOrganization) ?? null,
    [activeOrganizations, selectedOrganization]
  );
  const selectedLibraryParty = useMemo(
    () => paymentParties.find((item) => item.value === selectedPartyName) ?? null,
    [paymentParties, selectedPartyName]
  );
  const organizationAllowsForeignCurrency = Boolean(selectedOrganizationConfig?.enableMultiCurrency);

  useEffect(() => {
    if (!selectedOrganizationConfig) {
      return;
    }
    setSelectedCurrency(selectedOrganizationConfig.baseCurrency);
  }, [selectedOrganizationConfig]);

  useEffect(() => {
    if (isInternal === "true" && selectedPartyType !== "internal") {
      setSelectedPartyType("internal");
    }
    if (isInternal !== "true" && selectedPartyType === "internal") {
      setSelectedPartyType("supplier");
    }
  }, [isInternal, selectedPartyType]);

  useEffect(() => {
    if (selectedLibraryParty?.type && selectedPartyType !== selectedLibraryParty.type) {
      setSelectedPartyType(selectedLibraryParty.type);
    }
  }, [selectedLibraryParty, selectedPartyType]);

  useEffect(() => {
    if (!selectedLibraryParty) {
      return;
    }
    const inScope =
      !selectedOrganization ||
      selectedLibraryParty.organizationScope == null ||
      selectedLibraryParty.organizationScope.length === 0 ||
      selectedLibraryParty.organizationScope.includes(selectedOrganization);
    if (!inScope) {
      setSelectedPartyName("");
    }
  }, [selectedLibraryParty, selectedOrganization]);

  const visibleSections = useMemo(
    () =>
      formTemplate.sections
        .map((section) => ({
          ...section,
          fields: formTemplate.fields.filter(
            (field) =>
              field.enabled !== false &&
              field.section === section.id &&
              (field.name !== "currency" || organizationAllowsForeignCurrency) &&
              (field.name !== "paymentPartyType" || (!selectedLibraryParty && isInternal !== "true")) &&
              (field.name !== "internalTarget" || isInternal === "true") &&
              (field.organizationScope == null ||
                field.organizationScope.length === 0 ||
                (selectedOrganization ? field.organizationScope.includes(selectedOrganization) : true))
          )
        }))
        .filter((section) => section.fields.length > 0),
    [formTemplate, isInternal, organizationAllowsForeignCurrency, selectedLibraryParty, selectedOrganization]
  );

  const scopedPaymentParties = useMemo(() => {
    if (!selectedPartyType && !selectedOrganization && !isInternal) {
      return paymentParties;
    }
    return paymentParties.filter((party) => {
      const normalizedType = selectedPartyType || (isInternal === "true" ? "internal" : "supplier");
      const inOrganizationScope =
        !selectedOrganization ||
        party.organizationScope == null ||
        party.organizationScope.length === 0 ||
        party.organizationScope.includes(selectedOrganization);
      if (!inOrganizationScope) {
        return false;
      }
      if (!normalizedType) {
        return true;
      }
      return party.type === normalizedType;
    });
  }, [isInternal, paymentParties, selectedOrganization, selectedPartyType]);

  const scopedBankAccounts = useMemo(() => {
    if (!selectedOrganization && !selectedCurrency) {
      return bankAccounts;
    }
    const byOrganization = selectedOrganization
      ? bankAccounts.filter((account) => account.organization === selectedOrganization)
      : bankAccounts;
    const byCurrency = selectedCurrency
      ? byOrganization.filter((account) => account.currency === selectedCurrency)
      : byOrganization;
    if (byCurrency.length > 0) {
      return byCurrency;
    }
    if (byOrganization.length > 0) {
      return byOrganization;
    }
    return bankAccounts;
  }, [bankAccounts, selectedCurrency, selectedOrganization]);

  const suggestedBankAccount = useMemo(
    () =>
      scopedBankAccounts.find(
        (account) => account.isDefault && (!selectedCurrency || account.currency === selectedCurrency)
      ) ?? scopedBankAccounts[0] ?? null,
    [scopedBankAccounts, selectedCurrency]
  );

  return (
    <form action={submitPaymentRequestAction} className="rounded-lg border border-line bg-white p-6">
      <h2 className="text-lg font-semibold">{formTemplate.name}</h2>
      <div className="mt-2 text-sm text-black/55">
        前台尽量只做选择和核对。组织、币种、对象资料、默认账户优先走后台配置。
      </div>

      <div className="mt-4 rounded-lg border border-line bg-paper px-4 py-4 text-sm">
        <div className="font-medium text-ink">默认业务信息</div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="text-black/60">
            当前组织：
            <span className="font-medium text-ink"> {selectedOrganization || "请先选择组织"}</span>
          </div>
          <div className="text-black/60">
            默认币种：
            <span className="font-medium text-ink"> {selectedCurrency || "请先选择组织"}</span>
          </div>
          <div className="text-black/60">
            默认付款账户：
            <span className="font-medium text-ink"> {suggestedBankAccount?.value ?? "后台未配置"}</span>
          </div>
        </div>
        {suggestedBankAccount ? <div className="mt-2 text-xs text-black/45">{suggestedBankAccount.label}</div> : null}
      </div>
      {!organizationAllowsForeignCurrency ? <input type="hidden" name="currency" value={selectedCurrency || "RUB"} /> : null}
      <input type="hidden" name="suggestedBankAccountName" value={suggestedBankAccount?.value ?? ""} />

      <div className="mt-5 space-y-6">
        {visibleSections.map((section) => (
          <section key={section.id}>
            <div className="border-b border-line pb-3">
              <div className="text-base font-semibold">{section.label}</div>
              {section.description ? <div className="mt-1 text-sm text-black/55">{section.description}</div> : null}
            </div>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              {section.fields.map((field) => (
                <ConfiguredField
                  key={field.id}
                  field={field}
                  organizations={activeOrganizations}
                  paymentParties={paymentParties}
                  projects={projects}
                  bankAccounts={scopedBankAccounts}
                  selectedOrganization={selectedOrganization}
                  onOrganizationChange={setSelectedOrganization}
                  scopedPaymentParties={scopedPaymentParties}
                  selectedPartyType={selectedPartyType}
                  onPartyTypeChange={setSelectedPartyType}
                  selectedPartyName={selectedPartyName}
                  onPartyNameChange={setSelectedPartyName}
                  selectedLibraryParty={selectedLibraryParty}
                  isInternal={isInternal}
                  onInternalChange={setIsInternal}
                  selectedCurrency={selectedCurrency}
                  onCurrencyChange={(value) => setSelectedCurrency(value as "RUB" | "CNY" | "USD" | "")}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button name="submitMode" value="draft" className="rounded-md bg-ink px-5 py-3 text-sm font-medium text-white">
          保存草稿
        </button>
        <button name="submitMode" value="submit" className="rounded-md border border-line bg-paper px-5 py-3 text-sm font-medium text-ink">
          提交审批
        </button>
      </div>
    </form>
  );
}

function Label({ text }: { text: string }) {
  return <div className="text-sm font-medium text-black/70">{text}</div>;
}

function Field({
  name,
  label,
  placeholder,
  defaultValue,
  required = false,
  type = "text",
  readOnly = false,
  note
}: {
  name: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
  required?: boolean;
  type?: "text" | "number";
  readOnly?: boolean;
  note?: string;
}) {
  return (
    <div className="min-w-0">
      <Label text={`${label}${required ? " *" : ""}`} />
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        readOnly={readOnly}
        className={`mt-2 h-11 w-full rounded-md border border-line px-4 text-sm outline-none placeholder:text-black/35 ${
          readOnly ? "bg-paper text-black/70" : "bg-white"
        }`}
        placeholder={placeholder}
      />
      {note ? <div className="mt-2 text-xs leading-5 text-black/45">{note}</div> : null}
    </div>
  );
}

function SelectField({
  name,
  label,
  options,
  required = false,
  value,
  onChange
}: {
  name: string;
  label: string;
  options: Array<string | [string, string]>;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <Label text={`${label}${required ? " *" : ""}`} />
      <select
        name={name}
        required={required}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-line bg-white px-4 text-sm outline-none"
      >
        <option value="">请选择</option>
        {options.map((option) => {
          const optionValue = Array.isArray(option) ? option[0] : option;
          const optionLabel = Array.isArray(option) ? option[1] : option;
          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </div>
  );
}

function UploadField({ label, note }: { label: string; note: string }) {
  return (
    <div>
      <Label text={label} />
      <div className="mt-2 rounded-md border border-dashed border-line bg-paper px-4 py-4 text-sm text-black/55">
        上传区域
        <div className="mt-1 text-xs text-black/40">{note}</div>
      </div>
    </div>
  );
}

function ConfiguredField({
  field,
  organizations,
  paymentParties,
  projects,
  scopedPaymentParties,
  bankAccounts,
  selectedOrganization,
  onOrganizationChange,
  selectedPartyType,
  onPartyTypeChange,
  selectedPartyName,
  onPartyNameChange,
  selectedLibraryParty,
  isInternal,
  onInternalChange,
  selectedCurrency,
  onCurrencyChange
}: {
  field: FormFieldConfig;
  organizations: Array<{
    value: string;
    label: string;
    baseCurrency: "RUB" | "CNY" | "USD";
    taxLabel: string;
    settlementRole: string;
    enableMultiCurrency: boolean;
    enableExchangeRate: boolean;
    allowedCurrencies: Array<"RUB" | "CNY" | "USD">;
  }>;
  paymentParties: Array<{ value: string; label: string; type?: string; organizationScope?: string[] }>;
  projects: Array<{ value: string; label: string; organization: string }>;
  scopedPaymentParties: Array<{
    value: string;
    label: string;
    type?: string;
    organizationScope?: string[];
    bankName?: string;
    bankAccount?: string;
  }>;
  bankAccounts: Array<{
    value: string;
    label: string;
    organization: string;
    currency: "RUB" | "CNY" | "USD";
    isDefault: boolean;
  }>;
  selectedOrganization: string;
  onOrganizationChange: (value: string) => void;
  selectedPartyType: string;
  onPartyTypeChange: (value: string) => void;
  selectedPartyName: string;
  onPartyNameChange: (value: string) => void;
  selectedLibraryParty: { value: string; label: string; bankName?: string; bankAccount?: string } | null;
  isInternal: string;
  onInternalChange: (value: string) => void;
  selectedCurrency: string;
  onCurrencyChange: (value: string) => void;
}) {
  const className = field.width === "full" ? "md:col-span-2" : "";
  const options = getFieldOptions(field, organizations, scopedPaymentParties, bankAccounts, projects, selectedOrganization);

  if (field.type === "textarea") {
    return (
      <div className={className}>
        <Label text={`${field.label}${field.required ? " *" : ""}`} />
        <textarea
          name={field.name}
          required={field.required}
          defaultValue={field.defaultValue}
          className="mt-2 min-h-28 w-full rounded-md border border-line bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-black/35"
          placeholder={field.placeholder}
        />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className={className}>
        <SelectField
          name={field.name}
          label={field.label}
          required={field.required}
          options={options}
          value={
            field.name === "organization"
              ? selectedOrganization
              : field.name === "paymentPartyType"
                ? selectedPartyType
                : field.name === "paymentPartyName"
                  ? selectedPartyName
                : field.name === "isInternal"
                  ? isInternal
                  : field.name === "currency"
                    ? selectedCurrency
                  : undefined
          }
          onChange={
            field.name === "organization"
              ? onOrganizationChange
              : field.name === "paymentPartyType"
                ? onPartyTypeChange
                : field.name === "paymentPartyName"
                  ? onPartyNameChange
                : field.name === "isInternal"
                  ? onInternalChange
                  : field.name === "currency"
                    ? onCurrencyChange
                  : undefined
          }
        />
        {field.name === "paymentPartyName" ? (
          <div className="mt-2 text-xs leading-5 text-black/45">选择资料库对象后，开户行和账号按后台资料库回填，不再让前台重复填写。</div>
        ) : null}
      </div>
    );
  }

  if (field.type === "attachment") {
    return (
      <div className={className}>
        <UploadField label={`${field.label}${field.required ? " *" : ""}`} note={field.note ?? "上传材料"} />
      </div>
    );
  }

  return (
    <div className={className}>
      <Field
        name={field.name}
        label={field.label}
        required={field.required}
        placeholder={field.placeholder ?? ""}
        defaultValue={
          field.name === "paymentPartyBank"
            ? selectedLibraryParty?.bankName ?? field.defaultValue
            : field.name === "paymentPartyAccount"
              ? selectedLibraryParty?.bankAccount ?? field.defaultValue
              : field.defaultValue
        }
        type={field.type === "number" ? "number" : "text"}
        readOnly={
          field.name === "applicantName" ||
          Boolean(selectedLibraryParty && ["paymentPartyBank", "paymentPartyAccount"].includes(field.name))
        }
        note={
          field.name === "applicantName"
            ? "系统默认带出，前台不需要填写。"
            : selectedLibraryParty && ["paymentPartyBank", "paymentPartyAccount"].includes(field.name)
            ? "来自付款对象资料库，用于核对"
            : undefined
        }
      />
    </div>
  );
}

function getFieldOptions(
  field: FormFieldConfig,
  organizations: Array<{ value: string; label: string }>,
  paymentParties: Array<{ value: string; label: string }>,
  bankAccounts: Array<{ value: string; label: string }>,
  projects: Array<{ value: string; label: string; organization: string }>,
  selectedOrganization: string
) {
  if (field.name === "organization") {
    return organizations.map((item) => [item.value, item.label] as [string, string]);
  }
  if (field.name === "currency") {
    const selected = organizations.find((item) => item.value === selectedOrganization);
    const allowedCurrencies = (selected as { allowedCurrencies?: Array<"RUB" | "CNY" | "USD"> } | undefined)?.allowedCurrencies ?? ["RUB"];
    return allowedCurrencies.map((item) => [item, item] as [string, string]);
  }
  if (field.name === "internalTarget") {
    return organizations
      .filter((item) => item.value !== selectedOrganization)
      .map((item) => [item.value, item.label] as [string, string]);
  }
  if (field.name === "projectName") {
    return projects
      .filter((item) => !selectedOrganization || item.organization === selectedOrganization)
      .map((item) => [item.value, item.label] as [string, string]);
  }
  if (field.name === "paymentPartyName") {
    return paymentParties.map((item) => [item.value, item.label] as [string, string]);
  }
  if (field.name === "bankAccountName") {
    return bankAccounts.map((item) => [item.value, item.label] as [string, string]);
  }
  return (field.options ?? []).map((item) => [item.value, item.label] as [string, string]);
}
