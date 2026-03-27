export const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
};

export const formatCurrency = (value) => {
  const n = Number(value) || 0;
  return `${new Intl.NumberFormat("fr-FR").format(n)} FCFA`;
};

export const daysTo = (value) => {
  if (!value) return 9999;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};
