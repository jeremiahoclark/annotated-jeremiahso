import { cn } from "@/utils/cn";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-16 w-16 text-lg",
};

export function Avatar({ src, name, size = "md", className }: AvatarProps) {
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn(
          "shrink-0 rounded-full object-cover bg-surface-container-high",
          sizes[size],
          className
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-surface-container-highest font-medium text-primary",
        sizes[size],
        className
      )}
      aria-hidden
    >
      {initial}
    </span>
  );
}
