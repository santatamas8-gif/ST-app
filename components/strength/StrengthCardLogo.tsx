interface StrengthCardLogoProps {
  teamLogoUrl?: string | null;
  variant?: "screen" | "print";
}

export function StrengthCardLogo({ teamLogoUrl, variant = "screen" }: StrengthCardLogoProps) {
  const url = (teamLogoUrl ?? "").trim();
  if (!url) return null;

  if (variant === "print") {
    return (
      <div className="print-team-logo-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Team logo" className="print-team-logo" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Team logo"
      className="h-10 w-auto max-w-[140px] object-contain object-left sm:h-11 sm:max-w-[160px]"
    />
  );
}
