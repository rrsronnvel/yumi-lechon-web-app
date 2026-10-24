export type PaymentChannel = "Cash" | "GCash" | "Maya" | "Bank Transfer";

const PAYMENT_CHANNELS: Array<{ value: PaymentChannel; label: string }> = [
  { value: "Cash", label: "💵 Cash" },
  { value: "GCash", label: "📱 GCash" },
  { value: "Maya", label: "💚 Maya" },
  { value: "Bank Transfer", label: "🏦 Bank Transfer" },
];

interface PaymentChannelPillsProps {
  value: PaymentChannel | "None";
  onChange: (value: PaymentChannel) => void;
  disabled?: boolean;
}

export default function PaymentChannelPills({
  value,
  onChange,
  disabled = false,
}: PaymentChannelPillsProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5 mt-2">
      {PAYMENT_CHANNELS.map((channel) => (
        <button
          key={channel.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(channel.value)}
          className={`rounded-full border px-2 py-1 text-[10px] font-semibold transition-colors disabled:opacity-50 ${
            value === channel.value
              ? "border-emerald-500 bg-emerald-100 text-emerald-900"
              : "border-stone-300 bg-white text-stone-600"
          }`}
        >
          {channel.label}
        </button>
      ))}
    </div>
  );
}
