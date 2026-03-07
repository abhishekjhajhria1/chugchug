import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) alert(error.message);
  };

  const handleSignup = async () => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session || !data.user) {
      alert("Please confirm email first");
      return;
    }

    await supabase.from("profiles").insert({
      id: data.user.id,
      username: email.split("@")[0],
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-creamy text-[#4A3B32] p-4">
      <div className="cartoon-card w-full max-w-sm space-y-6">
        <h2 className="text-3xl text-center font-black uppercase tracking-wider text-[#FF7B9C]" style={{ textShadow: '2px 2px 0px #4A3B32' }}>
          Welcome!
        </h2>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="cartoon-input w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="cartoon-input w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="space-y-3 pt-2">
          <button onClick={handleLogin} className="cartoon-btn w-full text-lg">
            Login
          </button>

          <button
            onClick={handleSignup}
            className="cartoon-btn-secondary w-full text-lg"
          >
            Signup
          </button>
        </div>
      </div>
    </div>
  );
}
