// B2: Input masks for Brazilian formats

export function maskCNPJ(v: string): string {
  const n = v.replace(/\D/g, "").slice(0, 14);
  if (n.length <= 2) return n;
  if (n.length <= 5) return n.slice(0,2) + "." + n.slice(2);
  if (n.length <= 8) return n.slice(0,2) + "." + n.slice(2,5) + "." + n.slice(5);
  if (n.length <= 12) return n.slice(0,2) + "." + n.slice(2,5) + "." + n.slice(5,8) + "/" + n.slice(8);
  return n.slice(0,2) + "." + n.slice(2,5) + "." + n.slice(5,8) + "/" + n.slice(8,12) + "-" + n.slice(12);
}

export function maskPhone(v: string): string {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (n.length === 0) return "";
  if (n.length <= 2) return "(" + n;
  if (n.length <= 7) return "(" + n.slice(0,2) + ") " + n.slice(2);
  return "(" + n.slice(0,2) + ") " + n.slice(2,7) + "-" + n.slice(7);
}

export function maskDate(v: string): string {
  const n = v.replace(/\D/g, "").slice(0, 8);
  if (n.length <= 2) return n;
  if (n.length <= 4) return n.slice(0,2) + "/" + n.slice(2);
  return n.slice(0,2) + "/" + n.slice(2,4) + "/" + n.slice(4);
}

export function maskCPF(v: string): string {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 3) return n;
  if (n.length <= 6) return n.slice(0,3) + "." + n.slice(3);
  if (n.length <= 9) return n.slice(0,3) + "." + n.slice(3,6) + "." + n.slice(6);
  return n.slice(0,3) + "." + n.slice(3,6) + "." + n.slice(6,9) + "-" + n.slice(9);
}

export function maskCurrency(v: string): string {
  const n = v.replace(/\D/g, "");
  if (!n) return "";
  const val = (parseInt(n) / 100).toFixed(2);
  return "R$ " + val.replace(".", ",");
}

export function unmaskNumber(v: string): string {
  return v.replace(/\D/g, "");
}
