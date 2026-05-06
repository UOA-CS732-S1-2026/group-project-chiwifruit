import { useNavigate } from "react-router-dom";
import AuthPanel from "../components/AuthComponent/AuthPanel";

export default function RegisterPage() {
  const navigate = useNavigate();

  return (
    <AuthPanel
      initialMode="register"
      onSuccess={() => navigate("/")}
      onBack={() => navigate("/")}
    />
  );
}
