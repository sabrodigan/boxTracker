import { useEffect } from "react";
import { useParams, useLocation, Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Box } from "@shared/schema";
import { Loader2Icon } from "lucide-react";

export default function QrRedirectPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const { data: box, error, isLoading } = useQuery<Box>({
    queryKey: ["/api/boxes/by-qr", token],
    enabled: !!token && !!user,
    queryFn: async () => {
      const res = await fetch(`/api/boxes/by-qr/${encodeURIComponent(token!)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  useEffect(() => {
    if (box) setLocation(`/box/${box.id}`, { replace: true });
  }, [box, setLocation]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to={`/auth?next=/qr/${token}`} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-2">
        <p className="text-lg font-medium">Box not found</p>
        <p className="text-sm text-muted-foreground">
          This QR code isn't linked to any of your boxes.
        </p>
      </div>
    );
  }

  return null;
}
