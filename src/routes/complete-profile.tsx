import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PhoneInput } from "@/components/ui/phone-input";
import { toast } from "sonner";
import { Library, Loader2, CheckCircle2, ChevronRight, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/complete-profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Complete Your Profile • Smart Library" },
      { name: "description", content: "Complete your library member profile." },
    ],
  }),
  component: CompleteProfilePage,
});

function CompleteProfilePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [address, setAddress] = useState("");
  const [school, setSchool] = useState("");
  const [membershipNumber, setMembershipNumber] = useState("");
  const [nicId, setNicId] = useState("");
  const [phone, setPhone] = useState("");

  const ageNum = parseInt(age) || 0;
  const isUnder18 = ageNum > 0 && ageNum < 18;
  const isAdult = ageNum >= 18;

  const [appLauncher, setAppLauncher] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isInvite, setIsInvite] = useState(false);

  useEffect(() => {
    const isElectron = /electron/i.test(navigator.userAgent);
    
    // If opened via Chrome/Email but app is installed, attempt deep link launch
    if (!isElectron) {
      setAppLauncher(true);
      setChecking(false);
      
      const deepLink = "smartlibrary://" + window.location.pathname + window.location.search + window.location.hash;
      
      setTimeout(() => {
        window.location.href = deepLink;
      }, 500);
      return;
    }

    const init = async () => {
      try {
        // In Supabase v2 with PKCE, the client automatically processes the code/token on load.
        // Wait a tiny bit for the session to be established automatically by the SDK
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Clear any auth tokens from the URL without triggering a reload
        window.history.replaceState(null, "", window.location.pathname);

        const { data, error: userError } = await supabase.auth.getUser();
        if (userError || !data.user) { 
          console.error("Auth error:", userError);
          await supabase.auth.signOut();
          navigate({ to: "/auth" }); 
          return; 
        }
        
        setUserId(data.user.id);
        if (data.user.email) setUserEmail(data.user.email);

        // Detect if this is an invited user (they use email provider, but haven't completed their profile)
        // Normal email signups complete their profile at the same time they sign up.
        // Invited users are created by admin, so they land here to complete it.
        const provider = data.user.app_metadata?.provider;
        if (provider === 'email') {
          setIsInvite(true);
        }

        // Pre-fill name from OAuth metadata (Google/GitHub/Microsoft provide this)
        const metaName = data.user.user_metadata?.full_name
          || data.user.user_metadata?.name
          || "";
        if (metaName) setFullName(metaName);

        // Check if profile is already complete (has age in members table)
        const { data: member, error: memberError } = await supabase
          .from("members")
          .select("age, address, full_name")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (memberError) {
          console.error("Member fetch error:", memberError);
        }

        if (member?.age && member?.address && member?.full_name) {
          // Already complete — go to dashboard
          navigate({ to: "/dashboard" });
        } else {
          // Pre-fill name from members table if it exists
          if (member?.full_name) setFullName(member.full_name);
          setChecking(false);
        }
      } catch (err) {
        console.error("Initialization error:", err);
        toast.error("Failed to load profile. Please try logging in again.");
        await supabase.auth.signOut();
        navigate({ to: "/auth" });
      }
    };
    init();
  }, []);

  const handleNextStep0 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { toast.error("Full name is required."); return; }
    if (!age) { toast.error("Age is required."); return; }
    if (!address) { toast.error("Address is required."); return; }
    if (isUnder18 && (!school || !membershipNumber)) {
      toast.error("School and Library Membership Number are required for under-18 members."); return;
    }
    if (isAdult && (!nicId || !membershipNumber)) {
      toast.error("NIC ID and Library Membership Number are required."); return;
    }
    if (isInvite) {
      if (!password) { toast.error("Please set a password."); return; }
      if (password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
      if (password !== confirmPassword) { toast.error("Passwords do not match."); return; }
    }
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) { toast.error("Not logged in."); return; }
    setBusy(true);

    try {
      const { data: existing } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      // Only include columns that definitely exist — new columns saved separately
      const corePayload: any = {
        user_id: userId,
        address,
        phone: phone || null,
        status: "active",
      };

      // Try to add new columns — if they don't exist yet Supabase will ignore unknown keys gracefully
      const fullPayload: any = {
        ...corePayload,
        full_name: fullName.trim(),
        age: parseInt(age) || null,
        member_number: membershipNumber || null,
        nic_id: isAdult ? nicId : null,
        school: isUnder18 ? school : null,
      };

      let error;
      if (existing) {
        ({ error } = await supabase.from("members").update(fullPayload).eq("user_id", userId));
      } else {
        const { data: authUser } = await supabase.auth.getUser();
        ({ error } = await supabase.from("members").insert({
          ...fullPayload,
          email: authUser.user?.email || null,
          registration_date: new Date().toISOString().split("T")[0],
        }));
      }

      // Also update the auth user's display name
      const updates: any = { data: { full_name: fullName.trim() } };
      if (isInvite && password) {
        updates.password = password;
      }
      await supabase.auth.updateUser(updates);

      if (error) {
        console.error("Profile save error:", error);
        toast.error(error.message);
        return;
      }

      toast.success("Profile completed! Welcome to Smart Library.");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      console.error("Unexpected error:", err);
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sidebar via-primary/40 to-accent/30">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

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
              You are being redirected to the Desktop Application to complete your profile setup.
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
      <div className="grid w-full max-w-5xl gap-8 md:grid-cols-2 items-center">
        {/* Left panel */}
        <div className="text-primary-foreground space-y-4 hidden md:block">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center shadow-lg">
              <Library className="h-6 w-6 text-accent-foreground" />
            </div>
            <div>
              <div className="text-2xl font-bold">Smart Library</div>
              <div className="text-sm text-primary-foreground/80">Management System Pro</div>
            </div>
          </div>
          <h1 className="text-4xl font-bold leading-tight">Just one more step!</h1>
          <p className="text-primary-foreground/85">
            We need a few details to complete your library membership. This only takes a minute.
          </p>
          <ul className="text-sm space-y-2 text-primary-foreground/80">
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-400" /> Age & address</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-400" /> Membership verification</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-400" /> Optional phone verification</li>
          </ul>
        </div>

        {/* Right card */}
        <Card className="shadow-2xl border-0">
          <CardHeader>
            <CardTitle>Complete Your Profile</CardTitle>
            <CardDescription>
              A few more details are needed to activate your library membership.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {["Personal Info", "Phone (Optional)"].map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all
                    ${i < step ? "bg-green-500 text-white" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className={`text-xs hidden sm:block ${i === step ? "text-primary font-medium" : "text-muted-foreground"}`}>{s}</span>
                  {i < 1 && <div className={`w-8 h-px ${i < step ? "bg-green-500" : "bg-border"}`} />}
                </div>
              ))}
            </div>

            {/* Step 0: Personal Info */}
            {step === 0 && (
              <form onSubmit={handleNextStep0} className="space-y-3">
                {userEmail && (
                  <div>
                    <Label htmlFor="cp-email">Email Address</Label>
                    <Input
                      id="cp-email"
                      value={userEmail}
                      disabled
                      className="bg-muted/50 cursor-not-allowed text-muted-foreground"
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="cp-name">Full Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="cp-name"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <Label htmlFor="cp-age">Age <span className="text-red-500">*</span></Label>
                  <Input id="cp-age" type="number" min={1} max={120} required value={age}
                    onChange={e => setAge(e.target.value)} placeholder="e.g. 25" />
                </div>
                <div>
                  <Label htmlFor="cp-addr">Address <span className="text-red-500">*</span></Label>
                  <Input id="cp-addr" required value={address}
                    onChange={e => setAddress(e.target.value)} placeholder="Your home address" />
                </div>

                {isUnder18 && (
                  <div className="border rounded-lg p-3 space-y-3 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Under 18 — Required Details</p>
                    <div>
                      <Label htmlFor="cp-school">School <span className="text-red-500">*</span></Label>
                      <Input id="cp-school" required value={school}
                        onChange={e => setSchool(e.target.value)} placeholder="Your school name" />
                    </div>
                    <div>
                      <Label htmlFor="cp-mn">Library Membership Number <span className="text-red-500">*</span></Label>
                      <Input id="cp-mn" required value={membershipNumber}
                        onChange={e => setMembershipNumber(e.target.value)} placeholder="e.g. LIB-00123" />
                    </div>
                  </div>
                )}

                {isAdult && (
                  <div className="border rounded-lg p-3 space-y-3 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">18 & Over — Required Details</p>
                    <div>
                      <Label htmlFor="cp-nic">NIC ID Number <span className="text-red-500">*</span></Label>
                      <Input id="cp-nic" required value={nicId}
                        onChange={e => setNicId(e.target.value)} placeholder="Your National ID Number" />
                    </div>
                    <div>
                      <Label htmlFor="cp-mn2">Library Membership Number <span className="text-red-500">*</span></Label>
                      <Input id="cp-mn2" required value={membershipNumber}
                        onChange={e => setMembershipNumber(e.target.value)} placeholder="e.g. LIB-00123" />
                    </div>
                  </div>
                )}

                {isInvite && (
                  <div className="border rounded-lg p-3 space-y-3 bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800">
                    <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">Account Security</p>
                    <div>
                      <Label htmlFor="cp-pass">Set Password <span className="text-red-500">*</span></Label>
                      <Input id="cp-pass" type="password" required value={password}
                        onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" />
                    </div>
                    <div>
                      <Label htmlFor="cp-cpass">Confirm Password <span className="text-red-500">*</span></Label>
                      <Input id="cp-cpass" type="password" required value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
                    </div>
                  </div>
                )}

                {!age && (
                  <p className="text-xs text-muted-foreground text-center">Enter your age to see additional required fields.</p>
                )}

                <Button type="submit" className="w-full" disabled={!age || !address || (!isUnder18 && !isAdult)}>
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </form>
            )}

            {/* Step 1: Phone + Submit */}
            {step === 1 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Phone number — saved directly, no OTP needed */}
                <div>
                  <Label>
                    Phone number <span className="text-muted-foreground text-xs">(optional)</span>
                  </Label>
                  <PhoneInput
                    value={phone}
                    onChange={setPhone}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Your phone number will be saved to your profile.</p>
                </div>

                {/* Summary */}
                <div className="border rounded-lg p-3 space-y-1 bg-muted/30 text-sm">
                  <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-2">Summary</p>
                  <p><span className="text-muted-foreground">Age:</span> {age} ({isUnder18 ? "Under 18" : "Adult"})</p>
                  <p><span className="text-muted-foreground">Address:</span> {address}</p>
                  {isUnder18 && <p><span className="text-muted-foreground">School:</span> {school}</p>}
                  {isAdult && <p><span className="text-muted-foreground">NIC:</span> {nicId}</p>}
                  <p><span className="text-muted-foreground">Membership #:</span> {membershipNumber}</p>
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep(0)} className="flex-1">
                    <ChevronLeft className="mr-1 h-4 w-4" /> Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={busy}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Complete Profile
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
