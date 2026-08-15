import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { resetPasswordByEmail } from "@/lib/reset-password.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Library, Loader2, ChevronRight, ChevronLeft, CheckCircle2, ScanFace } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import { motion, useMotionValue, useSpring, useMotionTemplate } from "framer-motion";
import { MagneticButton } from "@/components/landing/MagneticButton";

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
    let hasSession = false;
    try {
      const { data } = await supabase.auth.getSession();
      hasSession = !!data?.session;
    } catch (e) {
      // Ignore errors in SSR
    }
    if (hasSession) throw redirect({ to: "/dashboard" });
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

import * as faceapi from '@vladmandic/face-api';

function FaceScannerVideo({ onDetected }: { onDetected: (desc: Float32Array) => void }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    let stream: MediaStream | null = null;
    let interval: any = null;
    let isUnmounted = false;
    
    async function initCamera() {
      // Load models
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models')
      ]);
      if (isUnmounted) return;

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          videoRef.current.onplay = () => {
            interval = setInterval(async () => {
              if (videoRef.current) {
                const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
                  .withFaceLandmarks()
                  .withFaceDescriptor();
                  
                if (detection && !isUnmounted) {
                  onDetected(detection.descriptor);
                }
              }
            }, 500);
          };
        }
      } catch (err) {
        console.error("Camera access denied or unavailable", err);
      }
    }
    
    initCamera();
    
    return () => {
      isUnmounted = true;
      if (interval) clearInterval(interval);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onDetected]);
  
  return (
    <video 
      ref={videoRef} 
      autoPlay 
      playsInline 
      muted 
      className="absolute inset-0 w-full h-full object-cover opacity-70 grayscale contrast-125"
    />
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"auth" | "forgot">("auth");
  
  // Face ID states
  const [faceAuthMode, setFaceAuthMode] = useState<"idle" | "choice" | "register_creds" | "scanning">("idle");
  const [scanIntent, setScanIntent] = useState<"register" | "authenticate">("authenticate");
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<"analyzing" | "success" | "failed">("analyzing");
  const [faceEmail, setFaceEmail] = useState("");
  const [facePassword, setFacePassword] = useState("");
  const [detectedDescriptor, setDetectedDescriptor] = useState<Float32Array | null>(null);

  useEffect(() => { document.title = "Sign in • Smart Library"; }, []);

  const handleFaceIdClick = () => {
    const saved = localStorage.getItem("smart_library_biometrics");
    if (saved) {
      setFaceAuthMode("choice");
    } else {
      setFaceAuthMode("register_creds");
    }
  };

  const startFaceScan = (intent: "register" | "authenticate") => {
    setScanIntent(intent);
    setFaceAuthMode("scanning");
    setScanStatus("analyzing");
    setDetectedDescriptor(null);
    setIsScanning(true);
  };

  const onFaceDetected = React.useCallback((desc: Float32Array) => {
    // Only accept the first detection to avoid multiple triggers
    setDetectedDescriptor(prev => prev ? prev : desc);
  }, []);

  useEffect(() => {
    if (isScanning && detectedDescriptor) {
      const processFace = async () => {
        if (scanIntent === "register") {
          setScanStatus("success");
          const descArray = Array.from(detectedDescriptor);
          localStorage.setItem("smart_library_biometrics", JSON.stringify({ email: faceEmail, password: facePassword, descriptor: descArray }));
          toast.success("Face ID Registered successfully!");
          
          setBusy(true);
          const { error } = await supabase.auth.signInWithPassword({ email: faceEmail, password: facePassword });
          setBusy(false);
          
          if (!error) navigate({ to: "/dashboard" });
          else toast.error("Registration saved, but login failed: " + error.message);
          
          setIsScanning(false);
          setFaceAuthMode("idle");
        } else if (scanIntent === "authenticate") {
          const saved = localStorage.getItem("smart_library_biometrics");
          if (saved) {
            try {
              const creds = JSON.parse(saved);
              const savedDesc = new Float32Array(creds.descriptor);
              const distance = faceapi.euclideanDistance(detectedDescriptor, savedDesc);
              
              if (distance < 0.5) { // Strict threshold for better security (0.5 or 0.6 is typical)
                setScanStatus("success");
                toast.success("Face Recognized. Welcome back!");
                
                setBusy(true);
                const { error } = await supabase.auth.signInWithPassword({ email: creds.email, password: creds.password });
                setBusy(false);
                
                if (!error) navigate({ to: "/dashboard" });
                else toast.error(error.message);
              } else {
                setScanStatus("failed");
                toast.error("Face not recognized! Access Denied.");
              }
            } catch (e) {
              setScanStatus("failed");
              toast.error("Biometrics corrupted. Please register again.");
            }
          } else {
            setScanStatus("failed");
            toast.error("Biometrics not found.");
          }
          
          setTimeout(() => {
            setIsScanning(false);
            setFaceAuthMode("idle");
          }, 2000);
        }
      };
      
      processFace();
    }
  }, [isScanning, detectedDescriptor, scanIntent, faceEmail, facePassword, navigate]);

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
    try {
      await resetPasswordByEmail({
        data: {
          email,
          redirectTo: window.location.origin + "/update-password",
        },
      });
      toast.success("Password reset email sent! Check your inbox.");
      setView("auth");
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email.");
    } finally {
      setBusy(false);
    }
  };

  const getRedirectUrl = (path: string) => {
    const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
    return `${window.location.origin}${base}${path.startsWith('/') ? path.slice(1) : path}`;
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: getRedirectUrl("dashboard") } });
    if (error) { setBusy(false); toast.error(error.message); }
  };

  const signInWithGithub = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "github", options: { redirectTo: getRedirectUrl("dashboard") } });
    if (error) { setBusy(false); toast.error(error.message); }
  };

  const signInWithMicrosoft = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "azure", options: { redirectTo: getRedirectUrl("dashboard") } });
    if (error) { setBusy(false); toast.error(error.message); }
  };

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseX = useSpring(x, { stiffness: 300, damping: 20 });
  const mouseY = useSpring(y, { stiffness: 300, damping: 20 });
  
  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const xPos = (clientX - left) / width - 0.5;
    const yPos = (clientY - top) / height - 0.5;
    x.set(xPos * 5); // Subtle 3D effect
    y.set(yPos * 5);
  }

  return (
    <div className="relative min-h-screen w-full bg-background flex items-center justify-center p-6 overflow-hidden">
      {/* Deep Atmospheric Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[10%] left-[10%] w-[600px] h-[600px] rounded-full bg-primary/20 blur-[150px] mix-blend-screen animate-blob" />
        <div className="absolute top-[60%] right-[10%] w-[500px] h-[500px] rounded-full bg-accent/20 blur-[150px] mix-blend-screen animate-blob" style={{ animationDelay: '3s' }} />
      </div>
      <div className="absolute inset-0 noise-overlay opacity-20 pointer-events-none z-0" />

      <div className="relative z-10 grid w-full max-w-5xl gap-8 md:grid-cols-2 items-center">
        <div className="text-primary-foreground space-y-4 hidden md:block">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Smart Library Logo" className="h-24 w-auto object-contain drop-shadow-2xl animate-in zoom-in-90 duration-700" />
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
        <motion.div
          onMouseMove={handleMouseMove}
          onMouseLeave={() => { x.set(0); y.set(0); }}
          style={{ rotateX: mouseY, rotateY: mouseX }}
          className="perspective-1000"
        >
          <Card className="glass-extreme border-0 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
            <CardHeader className="relative z-10">
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
                    <MagneticButton className="w-full">
                      <Button type="submit" className="w-full" disabled={busy}>
                        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
                      </Button>
                    </MagneticButton>
                  </form>
                  <div className="relative mt-4">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    <MagneticButton className="w-full"><Button type="button" variant="outline" className="w-full h-11" onClick={handleFaceIdClick} disabled={busy} title="Face ID Login"><ScanFace className="text-primary" /></Button></MagneticButton>
                    <MagneticButton className="w-full"><Button type="button" variant="outline" className="w-full h-11" onClick={signInWithGoogle} disabled={busy} title="Continue with Google"><GoogleIcon /></Button></MagneticButton>
                    <MagneticButton className="w-full"><Button type="button" variant="outline" className="w-full h-11" onClick={signInWithMicrosoft} disabled={busy} title="Continue with Microsoft"><MicrosoftIcon /></Button></MagneticButton>
                    <MagneticButton className="w-full"><Button type="button" variant="outline" className="w-full h-11" onClick={signInWithGithub} disabled={busy} title="Continue with GitHub"><GithubIcon /></Button></MagneticButton>
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
                  <div className="grid grid-cols-4 gap-3">
                    <Button type="button" variant="outline" className="w-full h-11" onClick={handleFaceIdClick} disabled={busy} title="Face ID Login"><ScanFace className="text-primary" /></Button>
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
        </motion.div>
      </div>

      {/* Face ID Choice Dialog */}
      {faceAuthMode === "choice" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <Card className="w-full max-w-sm glass-extreme border border-white/10 shadow-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto bg-primary/20 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <ScanFace className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-xl">Face ID Found</CardTitle>
              <CardDescription>We detected a saved biometric profile on this device.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" size="lg" onClick={() => startFaceScan("authenticate")}>
                Continue with Face ID
              </Button>
              <Button variant="outline" className="w-full" size="lg" onClick={() => setFaceAuthMode("register_creds")}>
                Create New Face ID
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setFaceAuthMode("idle")}>
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Face ID Credentials Registration */}
      {faceAuthMode === "register_creds" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <Card className="w-full max-w-sm glass-extreme border border-white/10 shadow-2xl">
            <CardHeader>
              <CardTitle>Register Face ID</CardTitle>
              <CardDescription>Enter your account credentials to link your biometrics.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); startFaceScan("register"); }} className="space-y-4">
                <div>
                  <Label>Email Address</Label>
                  <Input type="email" required value={faceEmail} onChange={(e) => setFaceEmail(e.target.value)} className="bg-black/50" />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input type="password" required value={facePassword} onChange={(e) => setFacePassword(e.target.value)} className="bg-black/50" />
                </div>
                <div className="pt-2 flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setFaceAuthMode("idle")}>Cancel</Button>
                  <Button type="submit" className="flex-1">Start Scan</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Futuristic Face Scan Overlay */}
      {isScanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-500">
          <div className="relative flex flex-col items-center">
            {/* Holographic scanning box */}
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, type: "spring" }}
              className={`relative w-72 h-96 rounded-3xl border-2 overflow-hidden shadow-[0_0_50px_rgba(var(--primary),0.3)] bg-black transition-colors duration-300 ${scanStatus === "success" ? "border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.3)]" : scanStatus === "failed" ? "border-destructive shadow-[0_0_50px_rgba(239,68,68,0.3)]" : "border-primary/50"}`}
            >
              <FaceScannerVideo onDetected={onFaceDetected} />
              
              {/* Corner accents */}
              <div className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-3xl z-20 ${scanStatus === "success" ? "border-green-500" : scanStatus === "failed" ? "border-destructive" : "border-primary"}`} />
              <div className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-3xl z-20 ${scanStatus === "success" ? "border-green-500" : scanStatus === "failed" ? "border-destructive" : "border-primary"}`} />
              <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-3xl z-20 ${scanStatus === "success" ? "border-green-500" : scanStatus === "failed" ? "border-destructive" : "border-primary"}`} />
              <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-3xl z-20 ${scanStatus === "success" ? "border-green-500" : scanStatus === "failed" ? "border-destructive" : "border-primary"}`} />
              
              {/* Scanning line */}
              {scanStatus === "analyzing" && (
                <motion.div 
                  animate={{ top: ["0%", "100%", "0%"] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute left-0 right-0 h-1 bg-primary shadow-[0_0_30px_rgba(var(--primary),1)] z-30"
                />
              )}
              
              <div className="absolute inset-0 bg-primary/10 flex items-center justify-center z-10 pointer-events-none mix-blend-overlay">
                <ScanFace className={`h-40 w-40 ${scanStatus === "success" ? "text-green-500" : scanStatus === "failed" ? "text-destructive" : "text-primary/30 animate-pulse"}`} />
              </div>
            </motion.div>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={`mt-8 font-mono text-sm tracking-widest uppercase ${scanStatus === "failed" ? "text-destructive" : scanStatus === "success" ? "text-green-500" : "text-primary animate-pulse"}`}
            >
              {scanStatus === "analyzing" ? "Analyzing Biometrics..." : scanStatus === "success" ? "Face Identified" : "Biometrics Not Found"}
            </motion.p>
            
            <Button 
              variant="ghost" 
              className="mt-12 text-muted-foreground hover:text-white"
              onClick={() => { setIsScanning(false); setFaceAuthMode("idle"); }}
            >
              Abort Scan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}