type OrderTableLabelInput = {
  table_number?: number | null;
  table_name?: string | null;
  table_zone_name?: string | null;
};

type OrderSourceLabelInput = OrderTableLabelInput & {
  channel?: string | null;
  customer_name?: string | null;
};

type FormatOrderTableLabelOptions = {
  tableFallbackLabel?: string;
  unknownTableSuffix?: string;
};

type FormatOrderSourceLabelOptions = FormatOrderTableLabelOptions & {
  deliveryLabel?: string;
  pickupLabel?: string;
  customerSeparator?: string;
};

function normalizeLabel(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function formatOrderTableLabel(
  order: OrderTableLabelInput,
  options: FormatOrderTableLabelOptions = {},
) {
  const tableFallbackLabel = options.tableFallbackLabel ?? "Masa";
  const unknownTableSuffix = options.unknownTableSuffix ?? "-";
  const tableName = normalizeLabel(order.table_name);
  const baseTableLabel = tableName
    ? tableName
    : typeof order.table_number === "number"
      ? `${tableFallbackLabel} ${order.table_number}`
      : `${tableFallbackLabel} ${unknownTableSuffix}`;

  const zoneName = normalizeLabel(order.table_zone_name).replace(/[\\/]+$/, "");
  if (!zoneName) {
    return baseTableLabel;
  }

  const normalizedBase = baseTableLabel.toLocaleLowerCase("tr-TR");
  const normalizedZone = zoneName.toLocaleLowerCase("tr-TR");
  if (normalizedBase.startsWith(`${normalizedZone}/`)) {
    return baseTableLabel;
  }

  return `${zoneName}/${baseTableLabel}`;
}

export function formatOrderSourceLabel(
  order: OrderSourceLabelInput,
  options: FormatOrderSourceLabelOptions = {},
) {
  const deliveryLabel = options.deliveryLabel ?? "Paket servis";
  const pickupLabel = options.pickupLabel ?? "Gel-al";
  const customerSeparator = options.customerSeparator ?? " - ";
  const customerName = normalizeLabel(order.customer_name);

  if (order.channel === "delivery") {
    return customerName ? `${deliveryLabel}${customerSeparator}${customerName}` : deliveryLabel;
  }
  if (order.channel === "pickup") {
    return customerName ? `${pickupLabel}${customerSeparator}${customerName}` : pickupLabel;
  }

  const baseLabel = formatOrderTableLabel(order, options);
  if (customerName === "QR Sipariş") {
    return `${baseLabel} (📱 QR Sipariş)`;
  }
  return baseLabel;
}
