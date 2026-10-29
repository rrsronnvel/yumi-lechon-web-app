import { isWalkInOrder, WalkInOrderLike } from "@/utils/walkIn";

interface WalkInBadgeProps extends WalkInOrderLike {
  clean?: boolean;
}

export function WalkInBadge({ clean = false, ...order }: WalkInBadgeProps) {
  if (!isWalkInOrder(order)) return null;

  return (
    <span
      className={
        clean
          ? "inline-flex whitespace-nowrap border border-black bg-white px-1 py-0.5 text-[8px] font-black tracking-wide text-black"
          : "inline-flex whitespace-nowrap rounded-full border border-indigo-300 bg-indigo-100 px-1.5 py-0.5 text-[9px] font-extrabold text-indigo-900"
      }
    >
      {clean ? "[WI • WALK-IN]" : "🚶 WALK-IN (WI)"}
    </span>
  );
}
