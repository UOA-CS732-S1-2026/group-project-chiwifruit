import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { continueAsGuest } from "../../api/auth";
import { setStoredAuthSession } from "../../api/axios";

export default function AuthModal({ open, onClose }) {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  if (!open) return null;

  const handleGuest = async () => {
    try {
      const data = await continueAsGuest();
      setStoredAuthSession(data);
      onClose();
    } catch {
      setError("Failed to continue as guest");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-center text-2xl font-bold">Welcome to Kichain</h2>

        <p className="mt-2 text-center text-sm text-muted-foreground">
          Login, register, or continue as a guest.
        </p>

        {error ? (
          <p className="mt-4 text-center text-sm font-semibold text-red-500">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white"
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => navigate("/register")}
            className="rounded-xl border px-4 py-3 text-sm font-bold"
          >
            Register
          </button>

          <button
            type="button"
            onClick={handleGuest}
            className="rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground underline"
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
