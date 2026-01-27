import { useState, useEffect } from "react";
import { API_BASE } from "../constants/gameConstants";
import { fetchJson } from "../utils/apiClient";
import AnimatedLogo from "./AnimatedLogo";

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Step states: 'username', 'password', 'confirm-new-user'
  const [step, setStep] = useState('username');
  const [userExists, setUserExists] = useState(false);

  // On component mount, check for saved credentials to pre-fill form
  useEffect(() => {
    const savedUsername = localStorage.getItem("grordle_username");
    const savedRemember = localStorage.getItem("grordle_remember") === "true";

    if (savedUsername && savedRemember) {
      setUsername(savedUsername.toLowerCase());
      setRememberMe(true);
    }
  }, []);

  const attemptLogin = async (user, pass, showMessages = true) => {
    setIsLoading(true);
    setMessage("");

    try {
      const lowerUser = user.toLowerCase();
      const data = await fetchJson(`${API_BASE}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: lowerUser,
          password: pass,
          action: "login"
        })
      });

      if (data.success) {
        if (showMessages) {
          setMessage(data.message || "Login successful!");
        }
        // Save credentials if remember me is checked
        if (rememberMe) {
          localStorage.setItem("grordle_username", lowerUser);
          localStorage.setItem("grordle_password", pass);
          localStorage.setItem("grordle_remember", "true");
        } else {
          // Clear saved credentials
          localStorage.removeItem("grordle_username");
          localStorage.removeItem("grordle_password");
          localStorage.removeItem("grordle_remember");
        }
        // Call the success callback with username
        setTimeout(() => {
          onLoginSuccess(data.user.username);
        }, 500);
      } else if (data.error) {
        // Clear authenticated flag on failed login
        localStorage.removeItem("grordle_authenticated");
        // Handle password reset-required state
        if (data.error.includes("Password reset required")) {
          setMessage("Password reset required. Please enter a new password.");
          setStep('password-reset');
        } else if (data.error.toLowerCase().includes("incorrect password") || data.error.toLowerCase().includes("invalid password")) {
          setMessage("Incorrect Password");
        } else {
          setMessage(data.error);
        }
      }
    } catch (err) {
      console.error("Login error:", err);
      // Clear authenticated flag on error
      localStorage.removeItem("grordle_authenticated");
      // Only show server error if it's a real network/server error
      if (err && (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.message?.includes('timeout'))) {
        setMessage("Error connecting to server. Please try again.");
      } else {
        setMessage("Incorrect Password");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Add a handler for password reset step
  const handlePasswordResetSubmit = async (e) => {
    e.preventDefault();
    const trimmedPassword = password.trim();
    if (!trimmedPassword) {
      setMessage("Please enter a new password");
      return;
    }
    const trimmedUsername = username.trim().toLowerCase();
    setIsLoading(true);
    setMessage("");
    try {
      const data = await fetchJson(`${API_BASE}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: trimmedUsername,
          password: trimmedPassword,
          action: "login"
        })
      });
      if (data.success) {
        setMessage("Password reset successful! Logging you in...");
        setTimeout(() => {
          onLoginSuccess(data.user.username);
        }, 500);
      } else if (data.error) {
        setMessage(data.error);
      }
    } catch (err) {
      console.error("Password reset error:", err);
      setMessage("Error connecting to server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const checkUsername = async (user) => {
    setIsLoading(true);
    setMessage("");

    try {
      const data = await fetchJson(`${API_BASE}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.toLowerCase(),
          action: "check"
        })
      });

      setUserExists(data.exists);
      
      if (data.exists) {
        setStep('password');
        setMessage("");
      } else {
        setStep('confirm-new-user');
        setMessage("");
      }
    } catch (err) {
      console.error("Username check error:", err);
      setMessage("Error connecting to server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUsernameSubmit = (e) => {
    e.preventDefault();
    
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setMessage("Please enter a username");
      return;
    }

    checkUsername(trimmedUsername);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    const trimmedPassword = password.trim();
    if (!trimmedPassword) {
      setMessage("Please enter a password");
      return;
    }

    const trimmedUsername = username.trim();

    if (userExists) {
      // Login existing user
      await attemptLogin(trimmedUsername, trimmedPassword);
    } else {
      // Register new user
      setIsLoading(true);
      setMessage("");

      try {
        const lowerUsername = trimmedUsername.toLowerCase();
        const data = await fetchJson(`${API_BASE}/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: lowerUsername,
            password: trimmedPassword,
            action: "register"
          })
        });

        if (data.success) {
          setMessage("Account created! Logging you in...");
          // Save credentials if remember me is checked
          if (rememberMe) {
            localStorage.setItem("grordle_username", lowerUsername);
            localStorage.setItem("grordle_password", trimmedPassword);
            localStorage.setItem("grordle_remember", "true");
          }
          // Automatically log in after registration
          setTimeout(() => {
            onLoginSuccess(data.user.username);
          }, 1000);
        } else if (data.error) {
          setMessage(data.error);
        }
      } catch (err) {
        console.error("Registration error:", err);
        setMessage("Error creating account. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleNewUserConfirm = (isNewUser) => {
    if (isNewUser) {
      setUserExists(false);
      setStep('password');
      setMessage("");
    } else {
      // Go back to username
      setUsername("");
      setPassword("");
      setStep('username');
      setMessage("");
    }
  };

  const handleBack = () => {
    setUsername("");
    setPassword("");
    setStep('username');
    setMessage("");
    setUserExists(false);
  };

  return (
  <div className="min-h-screen flex items-center justify-center">
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl max-w-md mx-4 w-full">
      <AnimatedLogo />
    <h2 className="text-3xl font-bold text-white my-6 text-center">Login</h2>
      {message && (
        <div className="mb-4 text-center text-purple-200 font-semibold">{message}</div>
      )}
      {step === 'username' && (
        <form onSubmit={handleUsernameSubmit} className="space-y-4">
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase())}
            placeholder="Enter your username"
            className="w-full p-4 rounded-lg text-lg bg-white/20 text-white placeholder-purple-200 border-2 border-white/30 focus:border-white focus:outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-lg transition"
            disabled={isLoading}
          >
            Next
          </button>
        </form>
      )}
      {step === 'password' && (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="w-full p-4 rounded-lg text-lg bg-white/20 text-white placeholder-purple-200 border-2 border-white/30 focus:border-white focus:outline-none"
            disabled={isLoading}
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              id="rememberMe"
              disabled={isLoading}
            />
            <label htmlFor="rememberMe" className="text-purple-200 text-sm">Remember me</label>
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-lg transition"
            disabled={isLoading}
          >
            Login
          </button>
        </form>
      )}
      {step === 'password-reset' && (
        <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
          <div className="text-purple-200 text-center mb-2">
            Password has been reset, enter your new password
          </div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter new password"
            className="w-full p-4 rounded-lg text-lg bg-white/20 text-white placeholder-purple-200 border-2 border-white/30 focus:border-white focus:outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-lg transition"
            disabled={isLoading}
          >
            Set New Password
          </button>
        </form>
      )}
      {step === 'confirm-new-user' && (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="text-purple-200 text-center mb-2">No account found. Create a new account?</div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Set a password"
            className="w-full p-4 rounded-lg text-lg bg-white/20 text-white placeholder-purple-200 border-2 border-white/30 focus:border-white focus:outline-none"
            disabled={isLoading}
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              id="rememberMe2"
              disabled={isLoading}
            />
            <label htmlFor="rememberMe2" className="text-purple-200 text-sm">Remember me</label>
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-lg transition"
            disabled={isLoading}
          >
            Create Account
          </button>
        </form>
      )}
    </div>
</div>
  );
}
