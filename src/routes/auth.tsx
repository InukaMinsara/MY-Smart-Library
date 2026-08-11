import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Library, Loader2, ChevronRight, ChevronLeft, CheckCircle2 } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.58c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const GithubIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
  </svg>
);

const MicrosoftIcon = () => (
  <svg viewBox="0 0 21 21" className="h-5 w-5" aria-hidden="true">
    <path fill="#f25022" d="M1 1h9v9H1z" />
    <path fill="#00a4ef" d="M1 11h9v9H1z" />
    <path fill="#7fba00" d="M11 1h9v9h-9z" />
    <path fill="#ffb900" d="M11 11h9v9h-9z" />
  </svg>
);

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in • Smart Library" },
      { name: "description", content: "Sign in to Smart Library Management System." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

// Multi-step signup form
type SignupForm = {
  fullName: string;
  email: string;
  password: string;
  age: string;
  address: string;
  phone: string;
  // under 18
  school: string;
  membershipNumber: string;
  // 18+
  nicId: string;
};

const STEPS = ["Account", "Personal Info", "Verification"];

function SignupForm({ busy, setBusy }: { busy: boolean; setBusy: (v: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<SignupForm>({
    fullName: "", email: "", password: "", age: "",
    address: "", phone: "", school: "", membershipNumber: "", nicId: "",
  });

  const set = (k: keyof SignupForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const age = parseInt(form.age) || 0;
  const isUnder18 = age > 0 && age < 18;
  const isAdult = age >= 18;

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 0) {
      if (!form.email || !form.password) { toast.error("Email and password are required."); return; }
      if (form.password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    }
    if (step === 1) {
      if (!form.age) { toast.error("Age is required."); return; }
      if (!form.address) { toast.error("Address is required."); return; }
      if (isUnder18 && (!form.school || !form.membershipNumber)) {
        toast.error("School and Library Membership Number are required for under-18 members."); return;
      }
      if (isAdult && (!form.nicId || !form.membershipNumber)) {
        toast.error("NIC ID and Library Membership Number are required."); return;
      }
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName || undefined,
          age: form.age,
          address: form.address,
          phone: form.phone || undefined,
          school: isUnder18 ? form.school : undefined,
          member_number: form.membershipNumber,
          nic_id: isAdult ? form.nicId : undefined,
        },
        emailRedirectTo: window.location.origin,
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email and click the verification link to activate your account.");
  };

  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all
            ${i < step ? "bg-green-500 text-white" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </div>
          <span className={`text-xs hidden sm:block ${i === step ? "text-primary font-medium" : "text-muted-foreground"}`}>{s}</span>
          {i < STEPS.length - 1 && <div className={`w-6 h-px ${i < step ? "bg-green-500" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="pt-2">
      {stepIndicator}

      {/* Step 0: Account */}
      {step === 0 && (
        <form onSubmit={handleNext} className="space-y-3">
          <div>
            <Label htmlFor="n2">Full name <span className="text-red-500">*</span></Label>
            <Input id="n2" required value={form.fullName} onChange={set("fullName")} placeholder="Your full name" />
          </div>
          <div>
            <Label htmlFor="e2">Email <span className="text-red-500">*</span></Label>
            <Input id="e2" type="email" required value={form.email} onChange={set("email")} />
          </div>
          <div>
            <Label htmlFor="p2">Password <span className="text-red-500">*</span></Label>
            <Input id="p2" type="password" required minLength={6} value={form.password} onChange={set("password")} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            After verifying your email, you will automatically become a <strong>Library Member</strong>.
          </p>
        </form>
      )}

      {/* Step 1: Personal Info */}
      {step === 1 && (
        <form onSubmit={handleNext} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="age">Age <span className="text-red-500">*</span></Label>
              <Input id="age" type="number" min={1} max={120} required value={form.age} onChange={set("age")} placeholder="e.g. 25" />
            </div>
          </div>
          <div>
            <Label htmlFor="addr">Address <span className="text-red-500">*</span></Label>
            <Input id="addr" required value={form.address} onChange={set("address")} placeholder="Your home address" />
          </div>

          {/* Conditional fields based on age */}
          {isUnder18 && (
            <div className="border rounded-lg p-3 space-y-3 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Under 18 — Required Details</p>
              <div>
                <Label htmlFor="school">School <span className="text-red-500">*</span></Label>
                <Input id="school" required value={form.school} onChange={set("school")} placeholder="Your school name" />
              </div>
              <div>
                <Label htmlFor="mn">Library Membership Number <span className="text-red-500">*</span></Label>
                <Input id="mn" required value={form.membershipNumber} onChange={set("membershipNumber")} placeholder="e.g. LIB-00123" />
              </div>
            </div>
          )}

          {isAdult && (
            <div className="border rounded-lg p-3 space-y-3 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">18 & Over — Required Details</p>
              <div>
                <Label htmlFor="nic">NIC ID Number <span className="text-red-500">*</span></Label>
                <Input id="nic" required value={form.nicId} onChange={set("nicId")} placeholder="Your National ID Number" />
              </div>
              <div>
                <Label htmlFor="mn2">Library Membership Number <span className="text-red-500">*</span></Label>
                <Input id="mn2" required value={form.membershipNumber} onChange={set("membershipNumber")} placeholder="e.g. LIB-00123" />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(0)} className="flex-1">
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button type="submit" className="flex-1" disabled={!form.age || !form.address || (!isUnder18 && !isAdult)}>
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          {!form.age && <p className="text-xs text-muted-foreground text-center">Enter your age to see additional required fields.</p>}
        </form>
      )}

      {/* Step 2: Phone + Submit */}
      {step === 2 && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Phone number <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <PhoneInput
              value={form.phone}
              onChange={(v) => setForm(f => ({ ...f, phone: v }))}
            />
            <p className="text-xs text-muted-foreground mt-1">Your phone number will be saved to your profile.</p>
          </div>

          <div className="border rounded-lg p-3 space-y-1 bg-muted/30 text-sm">
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-2">Summary</p>
            {form.fullName && <p><span className="text-muted-foreground">Name:</span> {form.fullName}</p>}
            <p><span className="text-muted-foreground">Email:</span> {form.email}</p>
            <p><span className="text-muted-foreground">Age:</span> {form.age} ({isUnder18 ? "Under 18" : "Adult"})</p>
            <p><span className="text-muted-foreground">Address:</span> {form.address}</p>
            {isUnder18 && <p><span className="text-muted-foreground">School:</span> {form.school}</p>}
            {isAdult && <p><span className="text-muted-foreground">NIC:</span> {form.nicId}</p>}
            <p><span className="text-muted-foreground">Membership #:</span> {form.membershipNumber}</p>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button type="submit" className="flex-1" disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Account
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"auth" | "forgot">("auth");

  useEffect(() => { document.title = "Sign in • Smart Library"; }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: "/dashboard" });
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Please enter your email address.");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/update-password",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset email sent! Check your inbox.");
    setView("auth");
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/dashboard" } });
    if (error) { setBusy(false); toast.error(error.message); }
  };

  const signInWithGithub = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "github", options: { redirectTo: window.location.origin + "/dashboard" } });
    if (error) { setBusy(false); toast.error(error.message); }
  };

  const signInWithMicrosoft = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "azure", options: { redirectTo: window.location.origin + "/dashboard" } });
    if (error) { setBusy(false); toast.error(error.message); }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-sidebar via-primary/40 to-accent/30 flex items-center justify-center p-6">
      <div className="grid w-full max-w-5xl gap-8 md:grid-cols-2 items-center">
        <div className="text-primary-foreground space-y-4 hidden md:block">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Smart Library Logo" className="h-24 w-auto object-contain drop-shadow-2xl animate-in zoom-in-90 duration-700" />
            <div>
              <div className="text-2xl font-bold">Smart Library</div>
              <div className="text-sm text-primary-foreground/80">Management System Pro</div>
            </div>
          </div>
          <h1 className="text-4xl font-bold leading-tight">Run your library like clockwork.</h1>
          <p className="text-primary-foreground/85">
            Books, members, loans, returns, reservations, fines and reports — all in one modern dashboard.
          </p>
          <ul className="text-sm space-y-1 text-primary-foreground/80">
            <li>• Role-based admin &amp; librarian access</li>
            <li>• Real-time inventory &amp; overdue tracking</li>
            <li>• Automatic fine calculation</li>
            <li>• Reservations queue with notifications</li>
          </ul>
        </div>
        <Card className="shadow-2xl border-0">
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in with your staff account, or request access below.</CardDescription>
          </CardHeader>
          <CardContent>
            {view === "auth" ? (
              <Tabs defaultValue="signin">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Create account</TabsTrigger>
                </TabsList>

                {/* Sign In */}
                <TabsContent value="signin">
                  <form onSubmit={signIn} className="space-y-3 pt-2">
                    <div>
                      <Label htmlFor="e1">Email</Label>
                      <Input id="e1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="p1">Password</Label>
                        <button type="button" onClick={() => setView("forgot")} className="text-xs text-primary hover:underline">
                          Forgot password?
                        </button>
                      </div>
                      <Input id="p1" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
                    </Button>
                  </form>
                  <div className="relative mt-4">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <Button type="button" variant="outline" className="w-full h-11" onClick={signInWithGoogle} disabled={busy} title="Continue with Google"><GoogleIcon /></Button>
                    <Button type="button" variant="outline" className="w-full h-11" onClick={signInWithMicrosoft} disabled={busy} title="Continue with Microsoft"><MicrosoftIcon /></Button>
                    <Button type="button" variant="outline" className="w-full h-11" onClick={signInWithGithub} disabled={busy} title="Continue with GitHub"><GithubIcon /></Button>
                  </div>
                </TabsContent>

                {/* Sign Up — multi-step */}
                <TabsContent value="signup">
                  <SignupForm busy={busy} setBusy={setBusy} />
                  <div className="relative mt-4 mb-4">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Button type="button" variant="outline" className="w-full h-11" onClick={signInWithGoogle} disabled={busy} title="Continue with Google"><GoogleIcon /></Button>
                    <Button type="button" variant="outline" className="w-full h-11" onClick={signInWithMicrosoft} disabled={busy} title="Continue with Microsoft"><MicrosoftIcon /></Button>
                    <Button type="button" variant="outline" className="w-full h-11" onClick={signInWithGithub} disabled={busy} title="Continue with GitHub"><GithubIcon /></Button>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="pt-2 animate-in fade-in zoom-in-95">
                <h3 className="text-lg font-semibold mb-2">Reset Password</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
                <form onSubmit={resetPassword} className="space-y-4">
                  <div>
                    <Label htmlFor="reset-email">Email</Label>
                    <Input id="reset-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setView("auth")} className="flex-1" disabled={busy}>
                      <ChevronLeft className="mr-1 h-4 w-4" /> Back
                    </Button>
                    <Button type="submit" className="flex-1" disabled={busy || !email}>
                      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send Link
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}