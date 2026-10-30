import { isWalkInOrder, WalkInOrderLike } from "@/utils/walkIn";

interface WalkInBadgeProps extends WalkInOrderLike {
  clean?: boolean;
  className?: string;
}

export function WalkInBadge({
  source,
  customerName,
  facebookName,
  clean = false,
  className,
}: WalkInBadgeProps) {
  if (!isWalkInOrder({ source, customerName, facebookName })) return null;

  return (
    <span
      className={
        className ??
        (clean
          ? "inline-flex whitespace-nowrap border border-black bg-white px-1 py-0.5 text-[8px] font-black tracking-wide text-black"
          : "inline-flex whitespace-nowrap rounded-full border border-indigo-300 bg-indigo-100 px-1.5 py-0.5 text-[9px] font-extrabold text-indigo-900")
      }
    >
      {clean ? "[WI • WALK-IN]" : "🚶 WALK-IN (WI)"}
    </span>
  );
}
