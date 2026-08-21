import Image from "next/image";

type BrandProps = {
  compact?: boolean;
  priority?: boolean;
};

export function Brand({ compact = false, priority = false }: BrandProps) {
  return (
    <span className={compact ? "brandLockup brandLockupCompact" : "brandLockup"}>
      <Image
        className="brandMark"
        src="/brand/humblebrag-mark-512.png"
        alt=""
        width={compact ? 42 : 58}
        height={compact ? 42 : 58}
        priority={priority}
      />
      <span className="brandType" aria-label="humblebrag">
        <span>humble</span><span>brag</span>
      </span>
    </span>
  );
}
