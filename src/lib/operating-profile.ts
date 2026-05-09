import type { BusinessType, OperatingProfile, OperatingProfileCapabilities } from "@/lib/types";

export function resolveOperatingProfile(businessType?: BusinessType | null): OperatingProfile {
  return businessType === "self_service_coffee" ? "coffee_self_service" : "restaurant_classic";
}

export function getOperatingProfileCapabilities(profile: OperatingProfile): OperatingProfileCapabilities {
  if (profile === "coffee_self_service") {
    return {
      channels: ["pickup"],
      payment_mode: "pay_at_order",
      pickup_identity: "number_plus_name",
      order_ready_board: true,
      hide_table_ui: true,
    };
  }

  // Default to restaurant_classic
  return {
    channels: ["dine_in", "pickup", "delivery"],
    payment_mode: "pay_at_checkout",
    pickup_identity: "table_number",
    order_ready_board: false,
    hide_table_ui: false,
  };
}
