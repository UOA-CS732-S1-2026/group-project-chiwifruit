import { useNavigate } from "react-router-dom";
import AuthPanel from "../components/AuthComponent/AuthPanel";

export default function LoginPage() {
  const navigate = useNavigate();

  return (
    <AuthPanel
      initialMode="login"
      onSuccess={() => navigate("/")}
      onBack={() => navigate("/")}
    />
  );
}
