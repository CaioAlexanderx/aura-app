import { useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth";
import { useFocusEffect } from "expo-router";
import { companiesApi } from "@/services/api";
import { validateEmail, validatePhone, syncProfileCache } from "./shared";
import type { ProfileField } from "./shared";

export function useConfigProfile() {
  const { user, company, companyLogo, setCompanyLogo, updateCompany, isDemo } = useAuthStore();

  const [companyName, setCompanyName] = useState(company?.name || "");
  const [address,     setAddress]     = useState("");
  const [email,       setEmail]       = useState(user?.email || "");
  const [phone,       setPhone]       = useState("");
  const [cnpj,        setCnpj]        = useState("");
  const [taxRegime,   setTaxRegime]   = useState("");
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [savedOk,     setSavedOk]     = useState(false);

  const emailError = email ? validateEmail(email) : null;
  const phoneError = phone ? validatePhone(phone) : null;
  const hasErrors  = !!(emailError || phoneError);

  const profileFields: ProfileField[] = [
    { label: "Nome",     ok: !!companyName },
    { label: "CNPJ",     ok: !!cnpj },
    { label: "E-mail",   ok: !!email && !emailError },
    { label: "Telefone", ok: !!phone && !phoneError },
    { label: "Endereco", ok: !!address },
    { label: "Logo",     ok: !!companyLogo },
  ];

  const loadProfile = useCallback(async () => {
    if (!company?.id || isDemo) { setLoading(false); return; }
    setLoading(true);
    try {
      const p = await companiesApi.getProfile(company.id);
      const name = p.trade_name || p.legal_name || company?.name || "";
      const em   = p.email      || user?.email || "";
      const ph   = p.phone      || "";
      const addr = p.address    || "";
      const cn   = p.cnpj       || "";
      const reg  = p.tax_regime || "";
      setCompanyName(name); setCnpj(cn); setEmail(em);
      setPhone(ph); setAddress(addr); setTaxRegime(reg);
      // P1 #5: Load logo from server if available
      if (p.logo_url && !companyLogo) {
        setCompanyLogo(p.logo_url);
      }
      syncProfileCache({ companyName: name, cnpj: cn, email: em, phone: ph, address: addr });
    } catch {} finally { setLoading(false); }
  }, [company?.id]);

  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

  async function handleSave() {
    if (hasErrors || !company?.id || isDemo) return;
    setSaving(true);
    try {
      const body: Record<string, string> = {
        trade_name: companyName.trim(),
        email:      email.trim(),
        phone:      phone.trim(),
        address:    address.trim(),
      };
      const filtered: Record<string, string> = {};
      for (const [k, v] of Object.entries(body)) {
        if (v !== "") filtered[k] = v;
      }
      if (Object.keys(filtered).length === 0) {
        setSaving(false);
        return;
      }
      const res = await companiesApi.updateProfile(company.id, filtered);
      if (res.trade_name !== undefined) setCompanyName(res.trade_name || res.name || "");
      if (res.email !== undefined) setEmail(res.email);
      if (res.phone !== undefined) setPhone(res.phone);
      if (res.address !== undefined) setAddress(res.address);
      updateCompany({ name: res.trade_name || res.name || company.name });
      syncProfileCache({
        companyName: res.trade_name || res.name || companyName,
        cnpj, email: res.email || email, phone: res.phone || phone,
        address: res.address || address,
      });
      setSavedOk(true); setTimeout(() => setSavedOk(false), 2500);
    } catch (err: any) {
      const { toast } = await import("@/components/Toast");
      toast.error(err?.message || "Erro ao salvar");
    } finally { setSaving(false); }
  }

  function onCnpjSaved(newCnpj: string, preview: { name: string; address: string } | null) {
    setCnpj(newCnpj);
    if (preview) {
      if (!companyName.trim()) setCompanyName(preview.name);
      if (!address.trim()) setAddress(preview.address);
    }
    syncProfileCache({
      companyName: companyName || preview?.name || "",
      cnpj: newCnpj, email, phone,
      address: address || preview?.address || "",
    });
  }

  // P1 #5: Save logo URL to company profile
  async function saveLogoUrl(url: string) {
    if (!company?.id) return;
    try {
      await companiesApi.updateProfile(company.id, { logo_url: url });
    } catch {}
  }

  async function removeLogoUrl() {
    if (!company?.id) return;
    try {
      await companiesApi.updateProfile(company.id, { logo_url: "" });
    } catch {}
  }

  return {
    companyName, setCompanyName,
    address, setAddress,
    email, setEmail,
    phone, setPhone,
    cnpj, taxRegime,
    loading, saving, savedOk,
    emailError, phoneError, hasErrors,
    profileFields,
    handleSave, onCnpjSaved,
    saveLogoUrl, removeLogoUrl,
  };
}
