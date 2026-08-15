import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Lock, Library } from "lucide-react";

export const Route = createFileRoute("/update-password")({
  component: UpdatePasswordPage,
});

function UpdatePasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [appLauncher, setAppLauncher] = useState(false);

  useEffect(() => {
    document.title = "Update Password • Smart Library";
    
    const isElectron = /electron/i.test(navigator.userAgent);
    
    // If opened via Chrome/Email but app is installed, attempt deep link launch
    if (!isElectron) {
      setAppLauncher(true);
      const deepLink = "smartlibrary://" + window.location.pathname + window.location.search + window.location.hash;
      
      setTimeout(() => {
        window.location.href = deepLink;
      }, 500);
      return;
    }

    // Check if user is actually authenticated (magic link logs them in)
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        toast.error("Invalid or expired password reset link.");
        navigate({ to: "/auth", replace: true });
      }
    });
  }, [navigate]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters.");
    if (password !== confirmPassword) return toast.error("Passwords do not match.");

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated successfully!");
      navigate({ to: "/dashboard", replace: true });
    }
  };

  if (appLauncher) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-sidebar via-primary/40 to-accent/30 flex items-center justify-center p-6">
        <Card className="shadow-2xl border-0 max-w-lg w-full text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center shadow-lg">
                <Library className="h-8 w-8 text-accent-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl">Opening Smart Library Pro...</CardTitle>
            <CardDescription className="text-base mt-2">
              You are being redirected to the Desktop Application to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2">If the app didn't open automatically:</p>
              <Button onClick={() => window.location.href = "smartlibrary://" + window.location.pathname + window.location.search + window.location.hash} className="w-full">
                Click here to Launch App
              </Button>
            </div>
            
            <div className="border-t pt-6">
              <p className="text-sm text-muted-foreground mb-3">Don't have the Smart Library Pro app installed yet?</p>
              <a href="/Smart_Library_Pro_Setup_2.0.0.zip" download>
                <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/10">
                  Download Desktop App
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-sidebar via-primary/40 to-accent/30 flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-2xl border-0 animate-in fade-in slide-in-from-bottom-4">
        <CardHeader className="space-y-1 items-center text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Secure your account</CardTitle>
          <CardDescription>Enter a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <Label htmlFor="pwd">New Password</Label>
              <Input 
                id="pwd" 
                type="password" 
                required 
                minLength={6} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••"
              />
            </div>
            <div>
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input 
                id="confirm" 
                type="password" 
                required 
                minLength={6} 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full mt-2" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
