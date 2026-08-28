// wrapper to return null pre-hydration for modules that depend on browser or aren't effective to server-side render.
import React from "react";

interface ClientOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function ClientOnly({
  children,
  fallback = null,
}: ClientOnlyProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    React.startTransition(() => {
      setMounted(true);
    });
  }, []);

  return mounted ? <>{children}</> : <>{fallback}</>;
}
