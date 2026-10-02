import { FormEvent, useState } from "react";
import { register } from "../api";

interface Props {
  onLoginRequested?: () => void;
  onThemeToggle?: () => void;
  theme: "light" | "dark";
  busy?: boolean;
}

interface MessageState {
  type: "error" | "success";
  text: string;
}

export default function RegisterCard({ onLoginRequested, onThemeToggle, theme, busy = false }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [message, setMessage] = useState<MessageState | null>(null);
  const [loading, setLoading] = useState(false);

  const isBusy = loading || busy;
  const normalizedPhoneNumber = phoneNumber.replace(/\D/g, "").slice(0, 10);

  const handleThemeToggle = () => {
    if (onThemeToggle) {
      onThemeToggle();
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const response = await register({
        name,
        email,
        password,
        phone_number: normalizedPhoneNumber,
        company_name: companyName.trim() || undefined,
      });
      setMessage({ type: "success", text: response.detail });
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "Unable to register";
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <form onSubmit={handleSubmit}>
        <label>
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            type="text"
            placeholder="Your name"
            required
          />
        </label>
        <label>
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="you@farmwith.in"
            required
          />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="••••••••"
            minLength={8}
            required
          />
        </label>
        <label>
          Phone number
          <input
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, "").slice(0, 10))}
            type="tel"
            placeholder="9876543210"
            inputMode="numeric"
            maxLength={10}
            required
          />
          <span className="helper">10 digits only, no +91 prefix.</span>
        </label>
        <label>
          Company name
          <input
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            type="text"
            placeholder="Optional"
          />
        </label>
        <button type="submit" disabled={isBusy}>
          {isBusy ? "Creating account..." : "Create account"}
        </button>
      </form>

      <button
        type="button"
        className="link-button"
        onClick={onLoginRequested}
        disabled={isBusy || !onLoginRequested}
      >
        Already have an account? Sign in
      </button>

      <div className="theme-toggle-row">
        <label className="switch">
          <input
            type="checkbox"
            checked={theme === "dark"}
            onChange={handleThemeToggle}
            aria-label="Toggle dark mode"
          />
          <span className="slider" />
        </label>
        <div className="theme-toggle-copy">
          <p className="theme-label">Dark mode</p>
          <p className="helper">Your choice carries into the dashboard.</p>
        </div>
      </div>

      {message && <div className={`alert ${message.type}`}>{message.text}</div>}
    </div>
  );
}
