async function discover() {
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${groqKey}` }
      });
      const data = await res.json();
      console.log("Groq available models:", data.data?.map(m => m.id).slice(0, 8));
    } catch (e) {
      console.log("Groq error:", e.message);
    }
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models");
      const data = await res.json();
      const free = data.data?.filter(m => m.id.endsWith(":free")).map(m => m.id);
      console.log("OpenRouter free models:", free?.slice(0, 8));
    } catch (e) {
      console.log("OpenRouter error:", e.message);
    }
  }

  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (nvidiaKey) {
    try {
      const res = await fetch("https://integrate.api.nvidia.com/v1/models", {
        headers: { Authorization: `Bearer ${nvidiaKey}` }
      });
      const data = await res.json();
      console.log("NVIDIA available models:", data.data?.map(m => m.id).slice(0, 8));
    } catch (e) {
      console.log("NVIDIA error:", e.message);
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
      const data = await res.json();
      console.log("Gemini available models:", data.models?.map(m => m.name.replace("models/", "")).slice(0, 8));
    } catch (e) {
      console.log("Gemini error:", e.message);
    }
  }
}

discover();
