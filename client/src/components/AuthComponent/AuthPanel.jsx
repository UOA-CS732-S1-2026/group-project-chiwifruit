import { useState } from "react";
import { ArrowLeft, KeyRound, LogIn, UserPlus, UserRound } from "lucide-react";
import logo from "../../assets/branding/logo.png";
import logoname from "../../assets/branding/logoname.png";
import { continueAsGuest, login, register } from "../../api/auth";
import { getApiErrorMessage, setStoredAuthSession } from "../../api/axios";
import { cn } from "../../lib/utils";

const authModes = [
  { id: "register", label: "Register", Icon: UserPlus },
  { id: "login", label: "Login", Icon: LogIn },
  { id: "guest", label: "Guest", Icon: UserRound },
];

export default function AuthPanel({
  initialMode = "register",
  onSuccess,
  onBack,
  className,
}) {
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [guestNickname, setGuestNickname] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === "register";
  const isLogin = mode === "login";
  const isGuest = mode === "guest";

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setError("");
  };

  const handleBack = () => {
    onBack?.();

    if (window.location.pathname !== "/") {
      window.location.assign("/");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const trimmedUsername = username.trim();

    if ((isLogin || isRegister) && (!trimmedUsername || !password.trim())) {
      setError("Username and password are required");
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setIsSubmitting(true);

      const data = isGuest
        ? await continueAsGuest()
        : isRegister
          ? await register({ username: trimmedUsername, password })
          : await login({ username: trimmedUsername, password });

      setStoredAuthSession(data);
      onSuccess?.(data);
    } catch (err) {
      setError(isGuest ? "Failed to continue as guest" : getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitLabel = isGuest
    ? "Play as Guest"
    : isRegister
      ? "Create Account"
      : "Login";

  return (
    <div className={cn("relative min-h-screen overflow-hidden bg-background", className)}>
      <div className="pointer-events-none absolute -left-40 -top-44 h-[34rem] w-[34rem] rounded-full bg-[color:var(--hero-glow-top)]/30 blur-[8.5rem]" />
      <div className="pointer-events-none absolute -bottom-56 -right-48 h-[36rem] w-[36rem] rounded-full bg-[color:var(--hero-glow-bottom)]/30 blur-[9rem]" />

      {onBack ? (
        <button
          type="button"
          onClick={handleBack}
          className="absolute left-6 top-6 z-20 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground md:left-12 md:top-10"
        >
          <ArrowLeft className="size-4" />
          Back to Home
        </button>
      ) : null}

      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 py-16">
        <div className="mb-7 flex flex-col items-center gap-2">
          <img src={logo} alt="Kichain icon" className="h-14 w-auto object-contain" />
          <img src={logoname} alt="Kichain" className="h-auto w-40 object-contain" />
        </div>

        <form
          onSubmit={handleSubmit}
          className="w-full max-w-[23rem] rounded-2xl bg-white px-5 py-6 shadow-[0_1.25rem_2.5rem_rgba(15,23,42,0.18)] md:px-7"
        >
          <div className="text-center">
            <h1 className="text-xl font-extrabold text-foreground">Join the Game</h1>
            <p className="mx-auto mt-3 max-w-[17rem] text-sm leading-5 text-muted-foreground">
              Create an account to save your profile, or play as a guest.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-3 rounded-xl bg-muted p-1">
            {authModes.map((authMode) => {
              const active = mode === authMode.id;
              const Icon = authMode.Icon;

              return (
                <button
                  key={authMode.id}
                  type="button"
                  onClick={() => handleModeChange(authMode.id)}
                  className={cn(
                    "flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-bold text-muted-foreground transition",
                    active && "bg-white text-primary shadow-sm ring-1 ring-border",
                  )}
                >
                  <Icon className="size-3.5" />
                  {authMode.label}
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-4">
            {isGuest ? (
              <Field
                label="Guest Nickname"
                value={guestNickname}
                onChange={(event) => setGuestNickname(event.target.value)}
                placeholder="MightyKiwi"
                icon={UserRound}
              />
            ) : (
              <>
                <Field
                  label="Username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="NeonTiger"
                  icon={UserRound}
                />
                <Field
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  icon={KeyRound}
                />
                {isRegister ? (
                  <Field
                    label="Confirm Password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Confirm password"
                    icon={KeyRound}
                  />
                ) : null}
              </>
            )}
          </div>

          {error ? (
            <p className="mt-4 text-center text-sm font-semibold text-destructive">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-5 h-12 w-full rounded-xl bg-primary px-4 text-sm font-extrabold text-white shadow-[0_0.75rem_1.5rem_rgba(58,75,219,0.28)] transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Please wait..." : submitLabel}
          </button>
        </form>
      </main>
    </div>
  );
}

function Field({ label, icon, className, ...inputProps }) {
  const Icon = icon;

  return (
    <label className={cn("block", className)}>
      <span className="mb-2 block text-xs font-extrabold text-foreground">{label}</span>
      <span className="flex h-12 items-center gap-3 rounded-xl border border-input bg-white px-4 transition focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/10">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <input
          {...inputProps}
          className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/65"
        />
      </span>
    </label>
  );
}
