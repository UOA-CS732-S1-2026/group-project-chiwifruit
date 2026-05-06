import AuthPanel from "./AuthPanel";

export default function AuthModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <AuthPanel
        initialMode="register"
        onSuccess={onClose}
        onBack={onClose}
      />
    </div>
  );
}
