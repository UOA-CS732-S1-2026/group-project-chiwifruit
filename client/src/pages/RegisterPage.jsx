import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register } from "../api/auth";
import { setStoredAuthSession, getApiErrorMessage } from "../api/axios";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Username and password are required");
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await register({
        username: username.trim(),
        password,
      });

      setStoredAuthSession(data);
      navigate("/");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg"
      >
        <h1 className="text-center text-2xl font-bold text-foreground">
          Create Account
        </h1>

        <div className="mt-6 space-y-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-primary"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-primary"
          />

          {error ? (
            <p className="text-center text-sm font-semibold text-red-500">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {isSubmitting ? "Creating..." : "Register"}
          </button>
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}
